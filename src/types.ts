/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameStatus = 'lobby' | 'playing' | 'completed' | 'abandoned';

export type PlayerRole = 'player1' | 'player2';

export interface GameMove {
  player: PlayerRole;
  pitIndex: number;
  timestamp: number;
}

export interface GameRoom {
  id: string; // The 5-letter room code
  player1Id: string;
  player1Name: string;
  player1Ready: boolean;
  player2Id: string | null;
  player2Name: string | null;
  player2Ready: boolean;
  status: GameStatus;
  board: number[]; // Length: 14. 0-5: P1 pits, 6: P1 Hazine, 7-12: P2 pits, 13: P2 Hazine
  turn: PlayerRole;
  winnerId: string | null; // UID, or 'draw'
  lastMove: GameMove | null;
  createdAt: any; // Firestore serverTimestamp
  updatedAt: any; // Firestore serverTimestamp
}

export interface PlayerProfile {
  uid: string;
  name: string;
  isAnonymous: boolean;
}
