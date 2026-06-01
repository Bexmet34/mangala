/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  limit,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { GameRoom, PlayerRole, GameMove, UserProfile, DailyQuest } from './types';

export function generateDailyQuests(): DailyQuest[] {
  return [
    { id: 'q1_' + Date.now(), type: 'play_games', target: 3, progress: 0, reward: 50, completed: false },
    { id: 'q2_' + Date.now(), type: 'win_games', target: 1, progress: 0, reward: 100, completed: false },
    { id: 'q3_' + Date.now(), type: 'double_move', target: 5, progress: 0, reward: 75, completed: false }
  ];
}


// Initialize Firebase
if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error("Firebase configuration missing or invalid!");
}
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);


// Authentication services
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google login error: ', error);
    throw error;
  }
}

export async function loginAnonymously() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Anonymous login error: ', error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error: ', error);
    throw error;
  }
}

// Error handling definitions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation test connection
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// GAME ROOM DB INTERACTIONS

const GAMES_COLLECTION = 'games';

export async function findMatchmakingRoom(): Promise<string | null> {
  const path = GAMES_COLLECTION;
  try {
    const q = query(
      collection(db, GAMES_COLLECTION),
      where('status', '==', 'lobby'),
      where('player2Id', '==', null),
      limit(1) // Avoid orderBy to avoid requiring a composite index right away
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error("Matchmaking error", error);
    return null;
  }
}

/**
 * Creates a new game room
 */
export async function createGameRoom(roomId: string, player1Name: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Kullanıcı girişi yapılmamış!');
  }

  const path = `${GAMES_COLLECTION}/${roomId}`;
  const initialBoard = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]; // Standard Mangala start

  const newRoom: GameRoom = {
    id: roomId,
    player1Id: user.uid,
    player1Name: player1Name,
    player1Ready: false,
    player2Id: null,
    player2Name: null,
    player2Ready: false,
    status: 'lobby',
    board: initialBoard,
    turn: 'player1',
    winnerId: null,
    lastMove: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, GAMES_COLLECTION, roomId), newRoom);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Joins an existing game room as player 2
 */
export async function joinGameRoom(roomId: string, player2Name: string): Promise<void> {
  const user = auth.currentUser;
  const path = `${GAMES_COLLECTION}/${roomId}`;
  if (!user) {
    throw new Error('Kullanıcı girişi yapılmamış!');
  }

  try {
    const roomRef = doc(db, GAMES_COLLECTION, roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      throw new Error('Oyun odası bulunamadı!');
    }

    const room = roomSnap.data() as GameRoom;
    if (room.player1Id === user.uid) {
      // Rejoining as creator is fine/handled in board component
      return;
    }

    if (room.player2Id && room.player2Id !== user.uid) {
      throw new Error('Bu oyun odası dolu!');
    }

    // Join action: specifies player2Id, player2Name, player2Ready to false
    await updateDoc(roomRef, {
      player2Id: user.uid,
      player2Name: player2Name,
      player2Ready: false,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Toggles a player's ready state
 */
export async function toggleReady(
  roomId: string, 
  role: PlayerRole, 
  readyState: boolean,
  currentRoom: GameRoom
): Promise<void> {
  const path = `${GAMES_COLLECTION}/${roomId}`;
  
  try {
    const roomRef = doc(db, GAMES_COLLECTION, roomId);
    
    // Determine the next status. If both are ready, game becomes 'playing'
    let nextStatus = currentRoom.status;
    let p1Ready = currentRoom.player1Ready;
    let p2Ready = currentRoom.player2Ready;

    if (role === 'player1') {
      p1Ready = readyState;
    } else {
      p2Ready = readyState;
    }

    if (p1Ready && p2Ready) {
      nextStatus = 'playing';
    } else {
      nextStatus = 'lobby';
    }

    if (role === 'player1') {
      await updateDoc(roomRef, {
        player1Ready: p1Ready,
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(roomRef, {
        player2Ready: p2Ready,
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Submit board move
 */
export async function makeGameMove(
  roomId: string,
  newBoard: number[],
  nextTurn: PlayerRole,
  gameOver: boolean,
  winnerId: string | null,
  lastMove: GameMove | null
): Promise<void> {
  const path = `${GAMES_COLLECTION}/${roomId}`;
  
  try {
    const roomRef = doc(db, GAMES_COLLECTION, roomId);
    
    if (gameOver) {
      await updateDoc(roomRef, {
        board: newBoard,
        status: 'completed',
        winnerId: winnerId,
        lastMove: lastMove,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(roomRef, {
        board: newBoard,
        turn: nextTurn,
        lastMove: lastMove,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Abandons the active game
 */
export async function abandonGame(roomId: string): Promise<void> {
  const path = `${GAMES_COLLECTION}/${roomId}`;
  try {
    const roomRef = doc(db, GAMES_COLLECTION, roomId);
    await updateDoc(roomRef, {
      status: 'abandoned',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Leaves or abandons/deletes the room based on the current user position and status
 */
export async function leaveGameRoom(roomId: string, role: PlayerRole | 'spectator', currentStatus: string): Promise<void> {
  const path = `${GAMES_COLLECTION}/${roomId}`;
  try {
    const roomRef = doc(db, GAMES_COLLECTION, roomId);
    
    if (currentStatus === 'lobby') {
      if (role === 'player1') {
        // Host left lobby: delete the room completely from Firebase
        await deleteDoc(roomRef);
      } else if (role === 'player2') {
        // P2 left: reset P2 slot so other players can join
        await updateDoc(roomRef, {
          player2Id: null,
          player2Name: null,
          player2Ready: false,
          updatedAt: serverTimestamp()
        });
      }
    } else if (currentStatus === 'playing') {
      // Active game: mark abandoned so the other player sees the overlay
      await updateDoc(roomRef, {
        status: 'abandoned',
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a game room (only creator)
 */
export async function deleteGameRoom(roomId: string): Promise<void> {
  const path = `${GAMES_COLLECTION}/${roomId}`;
  try {
    await deleteDoc(doc(db, GAMES_COLLECTION, roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Retrieves list of active games waiting in the lobby
 */
export async function getActiveLobbies(): Promise<GameRoom[]> {
  const path = GAMES_COLLECTION;
  try {
    const q = query(
      collection(db, GAMES_COLLECTION),
      where('status', '==', 'lobby')
    );
    const snap = await getDocs(q);
    const rooms: GameRoom[] = [];
    snap.forEach(docSnap => {
      rooms.push(docSnap.data() as GameRoom);
    });
    // Sort descending by createdAt or local fallback
    return rooms.sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

const USERS_COLLECTION = 'users';

/**
 * Fetches user profile for a given userId
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      let needsUpdate = false;
      // Retrofit for old profiles lacking new fields
      if (data.coins === undefined) {
        data.coins = 0;
        data.unlockedBoards = ['classic'];
        data.unlockedStones = ['classic'];
        data.equippedBoard = 'classic';
        data.equippedStone = 'classic';
        data.dailyQuests = [];
        data.lastQuestDate = '';
        needsUpdate = true;
      }

      const today = new Date().toISOString().split('T')[0];
      if (data.lastQuestDate !== today) {
        data.lastQuestDate = today;
        data.dailyQuests = generateDailyQuests();
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(doc(db, USERS_COLLECTION, userId), {
          coins: data.coins,
          unlockedBoards: data.unlockedBoards,
          unlockedStones: data.unlockedStones,
          equippedBoard: data.equippedBoard,
          equippedStone: data.equippedStone,
          dailyQuests: data.dailyQuests,
          lastQuestDate: data.lastQuestDate,
          updatedAt: serverTimestamp()
        });
      }
      return data;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}


/**
 * Initializes a new user profile in Firestore
 */
export async function createUserProfile(userId: string, name: string, isAnonymous: boolean): Promise<UserProfile> {
  const path = `${USERS_COLLECTION}/${userId}`;
  const profile: UserProfile = {
    uid: userId,
    name: name,
    isAnonymous: isAnonymous,
    score: 0,
    gamesWon: 0,
    gamesPlayed: 0,
    coins: 0,
    unlockedBoards: ['classic'],
    unlockedStones: ['classic'],
    equippedBoard: 'classic',
    equippedStone: 'classic',
    dailyQuests: generateDailyQuests(),
    lastQuestDate: new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, USERS_COLLECTION, userId), profile);
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates user display name in database
 */
export async function updateUserProfileName(userId: string, newName: string): Promise<void> {
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      name: newName,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Retrieves the global leaderboard (all players with score > 0 ordered by score descending)
 */
export async function getLeaderboard(): Promise<UserProfile[]> {
  const path = USERS_COLLECTION;
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('score', '>', 0),
      orderBy('score', 'desc')
    );
    const snap = await getDocs(q);
    const users: UserProfile[] = [];
    snap.forEach(docSnap => {
      users.push(docSnap.data() as UserProfile);
    });
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Awards points and updates stats for a user
 */
export async function awardPoints(
  userId: string, 
  pointsEarned: number, 
  won: boolean,
  gameMode?: string,
  difficulty?: string
): Promise<{ pointsAwarded: number; capped: boolean; oldScore: number; newScore: number }> {
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userRef);
    let scoreToAward = pointsEarned;
    let capped = false;
    let oldScore = 0;

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      oldScore = data.score || 0;

      // Rule: In singleplayer easy difficulty, if they are already >= 30 score, they cannot win any more points.
      if (gameMode === 'singleplayer' && difficulty === 'easy') {
        if (oldScore >= 30) {
          scoreToAward = 0;
          capped = true;
        } else if (oldScore + scoreToAward > 30) {
          scoreToAward = 30 - oldScore;
          capped = true;
        }
      }

      await updateDoc(userRef, {
        score: oldScore + scoreToAward,
        coins: (data.coins || 0) + scoreToAward * 2, // Coins = points * 2
        gamesPlayed: (data.gamesPlayed || 0) + 1,
        gamesWon: (data.gamesWon || 0) + (won ? 1 : 0),
        updatedAt: serverTimestamp()
      });

      return {
        pointsAwarded: scoreToAward,
        capped,
        oldScore,
        newScore: oldScore + scoreToAward
      };
    } else {
      // Create user profile real-time if it somehow wasn't initialized
      const defaultName = localStorage.getItem('mangala_nickname') || `Oyuncu_${userId.substring(0, 4)}`;
      const profile: UserProfile = {
        uid: userId,
        name: defaultName,
        isAnonymous: auth.currentUser?.isAnonymous ?? true,
        score: scoreToAward,
        gamesWon: won ? 1 : 0,
        gamesPlayed: 1,
        coins: scoreToAward * 2,
        unlockedBoards: ['classic'],
        unlockedStones: ['classic'],
        equippedBoard: 'classic',
        equippedStone: 'classic',
        dailyQuests: generateDailyQuests(),
        lastQuestDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(userRef, profile);

      return {
        pointsAwarded: scoreToAward,
        capped: false,
        oldScore: 0,
        newScore: scoreToAward
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function sendEmote(roomId: string, emoteId: string, senderId: string): Promise<void> {
  try {
    const roomRef = doc(db, GAMES_COLLECTION, roomId);
    await updateDoc(roomRef, {
      latestEmote: {
        emoteId,
        senderId,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error("Failed to send emote", error);
  }
}

export async function submitDisconnect(roomId: string, role: PlayerRole, currentRoom: GameRoom): Promise<void> {
  const roomRef = doc(db, GAMES_COLLECTION, roomId);
  const statusToSet = role === 'player1' ? 'p1_disconnected' : 'p2_disconnected';
  try {
    await updateDoc(roomRef, {
      status: statusToSet,
      disconnectTimestamp: Date.now(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Disconnect error", error);
  }
}

export async function submitReconnect(roomId: string): Promise<void> {
  const roomRef = doc(db, GAMES_COLLECTION, roomId);
  try {
    await updateDoc(roomRef, {
      status: 'playing',
      disconnectTimestamp: null,
      updatedAt: serverTimestamp()
    });
  } catch(error) {
    console.error("Reconnect error", error);
  }
}

export async function checkAbandonGame(roomId: string, currentRoom: GameRoom): Promise<void> {
  const now = Date.now();
  if (currentRoom.disconnectTimestamp && now - currentRoom.disconnectTimestamp > 60000) {
    if (currentRoom.status === 'p1_disconnected') {
      await updateDoc(doc(db, GAMES_COLLECTION, roomId), { status: 'abandoned', winnerId: currentRoom.player2Id });
    } else if (currentRoom.status === 'p2_disconnected') {
      await updateDoc(doc(db, GAMES_COLLECTION, roomId), { status: 'abandoned', winnerId: currentRoom.player1Id });
    }
  }
}

