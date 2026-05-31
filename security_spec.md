# Firestore Security Specification - Mangala Online

This document outlines the data invariants and adversarial test scenarios for the `/games/{gameId}` collection to prevent unauthorized actions, state bypassing, and identity spoofing.

## 1. Data Invariants
- **Identity Invariant**: Only registered/authenticated players can create or join games.
- **Participation limit**: A game can have at most two players (`player1Id` and `player2Id`). A third user cannot join or modify the game.
- **Turn Enforcement**: A player can only make a move if it is their turn (`game.turn == 'player1'` maps to `request.auth.uid == game.player1Id`).
- **Board Validity**: The board must always be an array of exactly 14 non-negative integers.
- **Ready Lock**: When status is `lobby`, either player can set themselves as ready. When both are ready, status converts to `playing`.
- **Status Progression**: Status cannot backtrack from `playing` to `lobby`, or from `completed`/`abandoned` to anything else.
- **Temporal Integrity**: `createdAt` is immutable; `updatedAt` is updated with `request.time`.

## 2. Dirty Dozen Payloads (Adversarial Scenarios)
1. **Self-Opponent Play**: Creating a game where `player1Id == player2Id` (bypassed with single-player rules, but disallowed in multi-player online matches).
2. **Unauthorized Join**: A third player trying to set themselves as `player2Id` when it is already occupied.
3. **Turn Hijacking**: Player 2 modifying the board or turn when it is Player 1's turn.
4. **Spectator Write**: A non-playing user (neither player 1 nor player 2) attempting to make a move.
5. **Ready State Spoof**: Player 1 trying to toggle Player 2's `player2Ready` status.
6. **Illegal Board State**: Submitting a board with more than 48 stones, negative stones, or in an altered size (not 14).
7. **Status Bypassing**: Updating the game status to `completed` directly without completing the game.
8. **Immutability Breach**: Attempting to alter `player1Id` or `createdAt` after the game is created.
9. **Spam Creation**: Creating a game with a random non-conforming ID string.
10. **Shadow Key Injection**: Injecting arbitrary extra fields like `{ "isCheatEnabled": true }`.
11. **Premature Victory**: Setting `winnerId` while game is still in `playing` status.
12. **Out of Sync Timestamps**: Manually writing a future or past date to `updatedAt` instead of `serverTimestamp()`.

## 3. Security Rules Outline
The active rules will enforce that:
- Any read action (`get`, `list`) is only permitted if the user is authenticated.
- Creation requires the document to follow the `isValidGame` helper.
- Update actions are strictly whitelisted by state transition: `Join`, `Ready Toggle`, `Make Move`, and `Abandon`.
