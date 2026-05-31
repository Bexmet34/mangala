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
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { GameRoom, PlayerRole, GameMove } from './types';

// Initialize Firebase
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
