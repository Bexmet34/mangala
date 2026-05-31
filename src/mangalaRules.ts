/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerRole } from './types';

/**
 * Initializes a new Mangala board.
 * Index 0-5: Player 1 pits
 * Index 6: Player 1 Store (Hazine)
 * Index 7-12: Player 2 pits
 * Index 13: Player 2 Store (Hazine)
 * Seeds are initialized to 4 in each playable pit.
 */
export function initBoard(): number[] {
  const board = Array(14).fill(0);
  for (let i = 0; i < 6; i++) {
    board[i] = 4;
    board[i + 7] = 4;
  }
  return board;
}

/**
 * Gets the next pit index counter-clockwise, skipping the opponent's store.
 */
export function getNextIndex(current: number, player: PlayerRole): number {
  let next = (current + 1) % 14;
  if (player === 'player1' && next === 13) {
    next = 0; // Skip Player 2's Treasury
  } else if (player === 'player2' && next === 6) {
    next = 7; // Skip Player 1's Treasury
  }
  return next;
}

/**
 * Executes a single move in the Mangala game.
 * 
 * @param board Current board state
 * @param startIndex The index of the pit selected by the player
 * @param player The role of the player making the move ('player1' or 'player2')
 * @returns Object containing the next board state, the next turn, and a text feedback log.
 */
export function executeMove(
  board: number[],
  startIndex: number,
  player: PlayerRole
): { nextBoard: number[]; nextTurn: PlayerRole; message: string } {
  const nextBoard = [...board];
  const seeds = nextBoard[startIndex];

  if (seeds <= 0) {
    return { nextBoard, nextTurn: player, message: 'Seçilen kuyuda taş yok!' };
  }

  // Validate starting area based on player role
  if (player === 'player1' && (startIndex < 0 || startIndex > 5)) {
    return { nextBoard, nextTurn: player, message: 'Geçersiz kuyu seçimi!' };
  }
  if (player === 'player2' && (startIndex < 7 || startIndex > 12)) {
    return { nextBoard, nextTurn: player, message: 'Geçersiz kuyu seçimi!' };
  }

  let message = '';
  nextBoard[startIndex] = 0;

  let current = startIndex;

  if (seeds === 1) {
    // If only 1 seed, it just moves to the next pit
    current = getNextIndex(current, player);
    nextBoard[current] += 1;
  } else {
    // If > 1 seeds, 1 seed is left in the starting pit, rest distributed
    nextBoard[startIndex] = 1;
    let remaining = seeds - 1;
    while (remaining > 0) {
      current = getNextIndex(current, player);
      nextBoard[current] += 1;
      remaining--;
    }
  }

  // Check where the last seed landed (index: `current`)
  let nextTurn: PlayerRole = player === 'player1' ? 'player2' : 'player1';

  const ownStoreIndex = player === 'player1' ? 6 : 13;
  const opponentStoreIndex = player === 'player1' ? 13 : 6;

  // Rule 1: lands in player's own store -> gets a free turn
  if (current === ownStoreIndex) {
    nextTurn = player; // keep same turn
    message = 'Son taş hazneye düştü! Tekrar oynama hakkı kazandınız.';
  } else {
    // Check which side the last seed landed on
    const isOwnSide = player === 'player1' ? (current >= 0 && current <= 5) : (current >= 7 && current <= 12);
    
    if (isOwnSide) {
      // Rule 2: Own empty pit capture (Boş Kuyu Kuralı)
      // If it lands in an empty pit (was empty before, meaning it now has exactly 1 seed)
      if (nextBoard[current] === 1) {
        const oppositeIndex = 12 - current;
        const opponentSeeds = nextBoard[oppositeIndex];
        if (opponentSeeds > 0) {
          // Capture both the last seed and opponent's opposite seeds
          nextBoard[ownStoreIndex] += 1 + opponentSeeds;
          nextBoard[current] = 0;
          nextBoard[oppositeIndex] = 0;
          message = `Boş kuyu kuralı! Rakibin ${opponentSeeds} taşını ve kendi taşınızı kazandınız.`;
        }
      }
    } else if (current !== opponentStoreIndex) {
      // lands on opponent's playable pit
      // Rule 3: Opponent pit even score capture
      if (nextBoard[current] % 2 === 0) {
        const capturedSeeds = nextBoard[current];
        nextBoard[ownStoreIndex] += capturedSeeds;
        nextBoard[current] = 0;
        message = `Çift kuralı! Rakibin ${capturedSeeds} taşını kazandınız.`;
      }
    }
  }

  // Check if either side is fully emptied
  const isP1Empty = nextBoard.slice(0, 6).every(val => val === 0);
  const isP2Empty = nextBoard.slice(7, 13).every(val => val === 0);

  if (isP1Empty || isP2Empty) {
    message = message ? message + ' Oyun bitti!' : 'Bir tarafın taşları bitti, oyun sonlandı!';
    
    // The player who emptied first gathers all remaining seeds from opponent's side
    if (isP1Empty) {
      // Gather Player 2's remaining seeds for Player 1
      let remainingSeeds = 0;
      for (let i = 7; i <= 12; i++) {
        remainingSeeds += nextBoard[i];
        nextBoard[i] = 0;
      }
      nextBoard[6] += remainingSeeds;
    } else {
      // Gather Player 1's remaining seeds for Player 2
      let remainingSeeds = 0;
      for (let i = 0; i < 6; i++) {
        remainingSeeds += nextBoard[i];
        nextBoard[i] = 0;
      }
      nextBoard[13] += remainingSeeds;
    }
  }

  return { nextBoard, nextTurn, message };
}

/**
 * Checks if game is fully completed
 */
export function isGameOver(board: number[]): boolean {
  const isP1Empty = board.slice(0, 6).every(val => val === 0);
  const isP2Empty = board.slice(7, 13).every(val => val === 0);
  return isP1Empty || isP2Empty;
}
