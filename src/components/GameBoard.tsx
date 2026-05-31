/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  makeGameMove, 
  toggleReady, 
  abandonGame, 
  deleteGameRoom,
  leaveGameRoom,
  auth,
  db
} from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GameRoom, PlayerRole, GameMove } from '../types';
import { 
  initBoard, 
  executeMove, 
  isGameOver,
  getNextIndex
} from '../mangalaRules';
import { 
  ArrowLeft, 
  User, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Play, 
  Flame, 
  Info,
  ChevronRight,
  ShieldAlert,
  Home,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Synthesizes arcade-quality game sound effects using Web Audio API (No assets/URLs needed!)
 */
const playSound = (type: 'stone' | 'capture' | 'extraTurn' | 'gameOver' | 'tick' | 'timerOut') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'stone') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (type === 'capture') {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.1, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.06 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.25);
      });
    } else if (type === 'extraTurn') {
      const now = ctx.currentTime;
      const freqs = [587.33, 880.00];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.1, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.06 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.32);
      });
    } else if (type === 'tick') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (type === 'timerOut') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (type === 'gameOver') {
      const now = ctx.currentTime;
      const melody = [523.25, 523.25, 523.25, 659.25, 587.33, 783.99];
      const durations = [0.12, 0.12, 0.12, 0.2, 0.15, 0.5];
      let accum = 0;
      melody.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + accum);
        gain.gain.setValueAtTime(0.1, now + accum);
        gain.gain.exponentialRampToValueAtTime(0.01, now + accum + durations[i] - 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + accum);
        osc.stop(now + accum + durations[i]);
        accum += durations[i];
      });
    }
  } catch (e) {
    console.warn('Audio synthesis warning:', e);
  }
};

interface GameBoardProps {
  roomId: string;
  gameMode: 'multiplayer' | 'singleplayer';
  currUserId: string;
  currUserName: string;
  onBackToLobby: () => void;
}

export default function GameBoard({ 
  roomId, 
  gameMode, 
  currUserId, 
  currUserName, 
  onBackToLobby 
}: GameBoardProps) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [logMessage, setLogMessage] = useState<string>('Oyun başladı! Hamle bekleniyor.');
  const [botIsThinking, setBotIsThinking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Sowing Animation states
  const [displayBoard, setDisplayBoard] = useState<number[] | null>(null);
  const [animatingPit, setAnimatingPit] = useState<number | null>(null);
  const [isSowing, setIsSowing] = useState(false);

  // Sound sync variables
  const prevBoardRef = useRef<number[] | null>(null);
  const prevTurnRef = useRef<PlayerRole | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  // Singleplayer (offline fallback) states
  const [offlineRoom, setOfflineRoom] = useState<GameRoom | null>(null);
  const botThinkingRef = useRef(false);

  // Determine user's role: P1, P2 or spectator
  const getPlayerRole = (currentRoom: GameRoom): PlayerRole | 'spectator' => {
    if (gameMode === 'singleplayer') return 'player1';
    if (currentRoom.player1Id === currUserId) return 'player1';
    if (currentRoom.player2Id === currUserId) return 'player2';
    return 'spectator';
  };

  const activeRoom = gameMode === 'singleplayer' ? offlineRoom : room;

  // Sync displayBoard with activeRoom when not animating
  useEffect(() => {
    if (!isSowing && activeRoom) {
      setDisplayBoard([...activeRoom.board]);
    }
  }, [activeRoom?.board, isSowing]);

  // Initial load sync
  useEffect(() => {
    if (activeRoom && !displayBoard) {
      setDisplayBoard([...activeRoom.board]);
    }
  }, [activeRoom]);

  // Helper to generate step-by-step state for the sowing (dağıtma) animation
  const getSowingSteps = (
    boardState: number[],
    startIndex: number,
    player: PlayerRole
  ) => {
    interface AnimationStep {
      board: number[];
      currentPit: number;
      soundType: 'stone' | 'capture' | 'extraTurn' | 'none';
    }

    const steps: AnimationStep[] = [];
    let tempBoard = [...boardState];
    const seeds = tempBoard[startIndex];
    if (seeds <= 0) return [];

    // Reset starting pit
    tempBoard[startIndex] = 0;
    let current = startIndex;

    if (seeds === 1) {
      current = getNextIndex(current, player);
      tempBoard[current] += 1;
      steps.push({
        board: [...tempBoard],
        currentPit: current,
        soundType: 'stone'
      });
    } else {
      tempBoard[startIndex] = 1;
      steps.push({
        board: [...tempBoard],
        currentPit: startIndex,
        soundType: 'stone'
      });

      let remaining = seeds - 1;
      while (remaining > 0) {
        current = getNextIndex(current, player);
        tempBoard[current] += 1;
        steps.push({
          board: [...tempBoard],
          currentPit: current,
          soundType: 'stone'
        });
        remaining--;
      }
    }

    // Capture & scoring checks
    const ownStoreIndex = player === 'player1' ? 6 : 13;
    const opponentStoreIndex = player === 'player1' ? 13 : 6;

    if (current === ownStoreIndex) {
      steps.push({
        board: [...tempBoard],
        currentPit: current,
        soundType: 'extraTurn'
      });
    } else {
      const isOwnSide = player === 'player1' ? (current >= 0 && current <= 5) : (current >= 7 && current <= 12);
      
      if (isOwnSide) {
        if (tempBoard[current] === 1) {
          const oppositeIndex = 12 - current;
          const opponentSeeds = tempBoard[oppositeIndex];
          if (opponentSeeds > 0) {
            tempBoard[ownStoreIndex] += 1 + opponentSeeds;
            tempBoard[current] = 0;
            tempBoard[oppositeIndex] = 0;
            steps.push({
              board: [...tempBoard],
              currentPit: ownStoreIndex,
              soundType: 'capture'
            });
          }
        }
      } else if (current !== opponentStoreIndex) {
        if (tempBoard[current] % 2 === 0) {
          const capturedSeeds = tempBoard[current];
          tempBoard[ownStoreIndex] += capturedSeeds;
          tempBoard[current] = 0;
          steps.push({
            board: [...tempBoard],
            currentPit: ownStoreIndex,
            soundType: 'capture'
          });
        }
      }
    }

    // Check game completed sweeping
    const isP1Empty = tempBoard.slice(0, 6).every(val => val === 0);
    const isP2Empty = tempBoard.slice(7, 13).every(val => val === 0);
    if (isP1Empty || isP2Empty) {
      if (isP1Empty) {
        let remainingSeeds = 0;
        for (let i = 7; i <= 12; i++) {
          remainingSeeds += tempBoard[i];
          tempBoard[i] = 0;
        }
        tempBoard[6] += remainingSeeds;
      } else {
        let remainingSeeds = 0;
        for (let i = 0; i < 6; i++) {
          remainingSeeds += tempBoard[i];
          tempBoard[i] = 0;
        }
        tempBoard[13] += remainingSeeds;
      }
      steps.push({
        board: [...tempBoard],
        currentPit: ownStoreIndex,
        soundType: 'none'
      });
    }

    return steps;
  };

  // Sowing step-by-step animator
  const runSowingAnimation = async (
    startIndex: number,
    player: PlayerRole,
    startBoard: number[]
  ): Promise<number[]> => {
    setIsSowing(true);
    const steps = getSowingSteps(startBoard, startIndex, player);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setDisplayBoard(step.board);
      setAnimatingPit(step.currentPit);
      
      if (step.soundType !== 'none') {
        playSound(step.soundType);
      }
      
      const delay = (step.soundType === 'capture' || step.soundType === 'extraTurn') ? 350 : 160;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    setAnimatingPit(null);
    setIsSowing(false);
    return steps.length > 0 ? steps[steps.length - 1].board : startBoard;
  };

  // 1. Sync Room State (Firebase or Local)
  useEffect(() => {
    if (gameMode === 'singleplayer') {
      const initialRoom: GameRoom = {
        id: roomId,
        player1Id: currUserId,
        player1Name: currUserName,
        player1Ready: true,
        player2Id: 'bot',
        player2Name: 'Bilge Bot (AI)',
        player2Ready: true,
        status: 'playing',
        board: initBoard(),
        turn: 'player1',
        winnerId: null,
        lastMove: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setOfflineRoom(initialRoom);
      setDisplayBoard(initialRoom.board);
      setLoading(false);
    } else {
      const roomRef = doc(db, 'games', roomId);
      const unsubscribe = onSnapshot(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
          setError('Oyun odası kapatılmış veya silinmiş.');
          setLoading(false);
          return;
        }
        
        const incomingRoom = snapshot.data() as GameRoom;
        if (incomingRoom) {
          const userRole = getPlayerRole(incomingRoom);
          const lastMov = incomingRoom.lastMove;
          const prevBoard = prevBoardRef.current;
          
          if (prevBoard && lastMov && lastMov.player !== userRole) {
            // Animating Opponent's Move real-time!
            setRoom(incomingRoom);
            const oppName = lastMov.player === 'player1' ? incomingRoom.player1Name : (incomingRoom.player2Name || 'Rakip');
            setLogMessage(`${oppName}, ${lastMov.pitIndex + 1}. kuyuyu seçerek hamlesini tamamladı.`);
            runSowingAnimation(lastMov.pitIndex, lastMov.player, prevBoard);
          } else {
            setRoom(incomingRoom);
            if (!isSowing) {
              setDisplayBoard([...incomingRoom.board]);
            }
          }
          
          prevBoardRef.current = incomingRoom.board;
          prevTurnRef.current = incomingRoom.turn;
          prevStatusRef.current = incomingRoom.status;
          setLoading(false);
        }
      }, (err) => {
        console.error(err);
        setError('Oda verileri senkronize edilemedi.');
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [roomId, gameMode, currUserId, currUserName]);

  // 2. Play Turn (Human)
  const handlePitClick = async (pitIndex: number) => {
    if (!activeRoom) return;
    if (activeRoom.status !== 'playing') return;
    if (isSowing) return;

    const userRole = getPlayerRole(activeRoom);
    if (userRole === 'spectator') return;

    if (activeRoom.turn !== userRole) {
      setLogMessage('Sıra sizde değil! Rakibin oynamasını bekleyin.');
      return;
    }

    const startBoard = [...activeRoom.board];
    
    // Execute visually first
    const animatedFinalBoard = await runSowingAnimation(pitIndex, userRole, startBoard);

    // Calculate core rules move next
    const { nextBoard, nextTurn, message } = executeMove(
      startBoard, 
      pitIndex, 
      userRole
    );

    if (message.includes('kuyuda taş yok') || message.includes('Geçersiz')) {
      setLogMessage(message);
      return;
    }

    setLogMessage(message || `${userRole === 'player1' ? activeRoom.player1Name : activeRoom.player2Name} bir hamle yaptı.`);

    const gameOver = isGameOver(nextBoard);
    let winnerId = null;

    if (gameOver) {
      playSound('gameOver');
      if (nextBoard[6] > nextBoard[13]) {
        winnerId = activeRoom.player1Id;
      } else if (nextBoard[13] > nextBoard[6]) {
        winnerId = activeRoom.player2Id;
      } else {
        winnerId = 'draw';
      }
    }

    const lastMove: GameMove = {
      player: userRole,
      pitIndex,
      timestamp: Date.now()
    };

    if (gameMode === 'singleplayer') {
      setOfflineRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          board: nextBoard,
          turn: nextTurn,
          status: gameOver ? 'completed' : 'playing',
          winnerId,
          lastMove,
          updatedAt: new Date()
        };
      });
    } else {
      await makeGameMove(
        roomId, 
        nextBoard, 
        nextTurn, 
        gameOver, 
        winnerId, 
        lastMove
      );
    }
  };

  // 3. Bot Decider Algorithm (Singleplayer)
  useEffect(() => {
    if (gameMode !== 'singleplayer' || !offlineRoom || isSowing) return;
    if (offlineRoom.status !== 'playing') return;
    if (offlineRoom.turn !== 'player2') {
      botThinkingRef.current = false;
      setBotIsThinking(false);
      return;
    }
    if (botThinkingRef.current) return;

    botThinkingRef.current = true;
    setBotIsThinking(true);

    const thinkingTimer = setTimeout(() => {
      if (!offlineRoom || offlineRoom.status !== 'playing' || offlineRoom.turn !== 'player2') {
        botThinkingRef.current = false;
        setBotIsThinking(false);
        return;
      }

      const board = offlineRoom.board;
      const validPits: number[] = [];
      for (let idx = 7; idx <= 12; idx++) {
        if (board[idx] > 0) validPits.push(idx);
      }

      if (validPits.length === 0) {
        botThinkingRef.current = false;
        setBotIsThinking(false);
        return;
      }

      let chosenPit = -1;

      // Bot Decider Heuristics
      for (const pit of validPits) {
        const seeds = board[pit];
        let current = pit;
        if (seeds === 1) {
          current = getNextIndex(current, 'player2');
        } else {
          let remaining = seeds - 1;
          while (remaining > 0) {
            current = getNextIndex(current, 'player2');
            remaining--;
          }
        }
        if (current === 13) {
          chosenPit = pit;
          break;
        }
      }

      if (chosenPit === -1) {
        for (const pit of validPits) {
          const seeds = board[pit];
          const testBoard = [...board];
          testBoard[pit] = 0;
          
          let current = pit;
          if (seeds === 1) {
            current = getNextIndex(current, 'player2');
            testBoard[current] += 1;
          } else {
            testBoard[pit] = 1;
            let remaining = seeds - 1;
            while (remaining > 0) {
              current = getNextIndex(current, 'player2');
              testBoard[current] += 1;
              remaining--;
            }
          }

          if (current >= 0 && current <= 5 && testBoard[current] % 2 === 0) {
            chosenPit = pit;
            break;
          }
          if (current >= 7 && current <= 12 && testBoard[current] === 1) {
            const opposite = 12 - current;
            if (testBoard[opposite] > 0) {
              chosenPit = pit;
              break;
            }
          }
        }
      }

      if (chosenPit === -1) {
        let maxStones = -1;
        for (const pit of validPits) {
          if (board[pit] > maxStones) {
            maxStones = board[pit];
            chosenPit = pit;
          }
        }
      }

      if (chosenPit !== -1) {
        const { nextBoard, nextTurn, message } = executeMove(
          board,
          chosenPit,
          'player2'
        );

        const gameOver = isGameOver(nextBoard);
        let winnerId = null;

        if (gameOver) {
          if (nextBoard[6] > nextBoard[13]) {
            winnerId = offlineRoom.player1Id;
          } else if (nextBoard[13] > nextBoard[6]) {
            winnerId = offlineRoom.player2Id;
          } else {
            winnerId = 'draw';
          }
        }

        setLogMessage('Bilge Bot: ' + (message || 'Bir hamle yaptı.'));
        
        runSowingAnimation(chosenPit, 'player2', board).then(() => {
          setOfflineRoom(prev => {
            if (!prev) return null;
            return {
              ...prev,
              board: nextBoard,
              turn: nextTurn,
              status: gameOver ? 'completed' : 'playing',
              winnerId,
              lastMove: {
                player: 'player2',
                pitIndex: chosenPit,
                timestamp: Date.now()
              },
              updatedAt: new Date()
            };
          });
          botThinkingRef.current = false;
          setBotIsThinking(false);
        });
      } else {
        botThinkingRef.current = false;
        setBotIsThinking(false);
      }
    }, 1200);

    return () => clearTimeout(thinkingTimer);
  }, [offlineRoom, gameMode, isSowing]);

  const role = getPlayerRole(activeRoom || { player1Id: '', player2Id: '', status: 'lobby' } as any);
  const isP1 = role === 'player1';
  const isP2 = role === 'player2';
  const isMyTurn = activeRoom?.status === 'playing' && activeRoom?.turn === role;

  // Reset timer on turn / board changes
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== 'playing') return;
    setTimeLeft(30);
  }, [activeRoom?.turn, activeRoom?.board]);

  // Turn duration countdown timer effect
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== 'playing') return;

    const tickInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tickInterval);
          // Handle timeout
          setTimeout(() => {
            handleTimeout();
          }, 0);
          return 0;
        }
        // Warning sound on last 6 seconds of MY turn
        if (prev <= 6 && isMyTurn) {
          playSound('tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [activeRoom?.turn, activeRoom?.status, isMyTurn]);

  // Autoplay handler when turn expires
  const handleTimeout = () => {
    if (!activeRoom || activeRoom.status !== 'playing') return;
    
    // Only the active player triggers and executes their autoplay
    if (isMyTurn) {
      playSound('timerOut');
      const startIdx = role === 'player1' ? 0 : 7;
      const endIdx = role === 'player1' ? 5 : 12;
      
      const validPits: number[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        if (activeRoom.board[i] > 0) {
          validPits.push(i);
        }
      }

      if (validPits.length > 0) {
        // Automatically make a random move to keep the momentum going!
        const randomPit = validPits[Math.floor(Math.random() * validPits.length)];
        setLogMessage('Süreniz doldu! Sizin yerinize otomatik hamle yapıldı.');
        handlePitClick(randomPit);
      }
    } else {
      // Not my turn, just play buzzer locally since opponent took too long
      playSound('timerOut');
    }
  };

  // 4. Toggle Ready status (Multiplayer)
  const handleToggleReady = async () => {
    if (!activeRoom || gameMode === 'singleplayer') return;
    const userRole = getPlayerRole(activeRoom);
    if (userRole === 'spectator') return;

    const readyState = userRole === 'player1' ? !activeRoom.player1Ready : !activeRoom.player2Ready;
    await toggleReady(roomId, userRole, readyState, activeRoom);
  };

  // 5. Restart local game singleplayer
  const handleRestartOffline = () => {
    setOfflineRoom({
      id: roomId,
      player1Id: currUserId,
      player1Name: currUserName,
      player1Ready: true,
      player2Id: 'bot',
      player2Name: 'Bilge Bot (AI)',
      player2Ready: true,
      status: 'playing',
      board: initBoard(),
      turn: 'player1',
      winnerId: null,
      lastMove: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    setLogMessage('Yeni oyun başladı! Hamle sırası sizde.');
  };

  // Abandon Multiplayer Game
  const handleAbandon = async () => {
    if (gameMode === 'singleplayer') {
      onBackToLobby();
      return;
    }
    if (activeRoom) {
      await leaveGameRoom(roomId, role, activeRoom.status);
    }
    onBackToLobby();
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Marble renderer
  const renderStones = (count: number) => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i * 137.5) * (Math.PI / 180); // golden spiral
      const radius = Math.min(22, 6 + Math.sqrt(i) * 5.2);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      const colors = [
        'bg-[#14b8a6] border-[#2dd4bf]', // cyan/turquoise
        'bg-[#64748b] border-[#94a3b8]', // deep slate
        'bg-[#cbd5e1] border-[#f1f5f9]', // smooth light
        'bg-[#f59e0b] border-[#fbbf24]', // glowing amber
        'bg-[#f97316] border-[#fb923c]'  // orange copper
      ];
      const colorClass = colors[i % colors.length];

      return (
        <span
          key={i}
          className={`w-3.5 h-3.5 rounded-full border shadow-inner absolute ${colorClass} transition-all duration-300`}
          style={{
            transform: `translate(${x}px, ${y}px)`,
            top: 'calc(50% - 7px)',
            left: 'calc(50% - 7px)',
          }}
        />
      );
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-slate-400">Oda bağlantısı senkronize ediliyor...</p>
      </div>
    );
  }

  if (error || !activeRoom) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl text-center space-y-4 mt-12">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-white">Bağlantı Hatası</h3>
        <p className="text-sm text-slate-400">{error || 'Beklenmeyen bir hata oluştu veya oda kapatıldı.'}</p>
        <button
          onClick={onBackToLobby}
          className="w-full py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-xl transition text-slate-200 cursor-pointer text-sm font-semibold flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Lobiye Geri Dön
        </button>
      </div>
    );
  }

  const isSpectator = role === 'spectator';

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-4 md:py-8 space-y-6">
      
      {/* Header controls */}
      <div className="flex md:flex-row flex-col items-center justify-between gap-4 bg-slate-850 p-4 rounded-2xl border border-slate-750">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleAbandon}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition border border-slate-700 cursor-pointer"
            title="Geri Dön / Oyunu Terk Et"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{gameMode === 'singleplayer' ? 'Yapay Zeka Maçı' : 'Çevrimiçi Karşılaşma'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-mono text-amber-500">
                {roomId}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {gameMode === 'singleplayer' ? 'Bilge Bot\'un becerikli taktiklerine meydan okuyun.' : 'Eş zamanlı multi-player eşleşmesi.'}
            </p>
          </div>
        </div>

        {/* Room Code Share Card */}
        {activeRoom.status === 'lobby' && (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-xl w-full md:w-auto justify-between shadow-inner">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Oda Kodu:</span>
            <span className="font-mono font-extrabold text-amber-400 tracking-wider text-sm mx-2 select-all">{roomId}</span>
            <button
              onClick={copyRoomCode}
              className="p-1 text-slate-400 hover:text-amber-500 rounded transition active:scale-90 cursor-pointer"
              title="Kodu Kopyala"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {isSpectator && (
            <span className="px-3 py-1 bg-indigo-950 border border-indigo-800 text-indigo-400 text-xs font-bold rounded-lg uppercase">
              İzleyici Modu
            </span>
          )}
          {gameMode === 'multiplayer' && (
            <span className="text-xs text-slate-400 bg-slate-900/60 p-2 border border-slate-700 rounded-xl">
              ● Senkronize Edildi
            </span>
          )}
        </div>
      </div>

      {/* Lobby waiting layout */}
      {activeRoom.status === 'lobby' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-850 border border-slate-750 rounded-2xl p-6 md:p-12 text-center shadow-xl space-y-6"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white">Oyuncular Hazırlanıyor...</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Her iki oyuncu da "Hazır" durumuna geçtiğinde oyun kurallara uygun olarak otomatik olarak başlayacaktır.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto pt-4">
            {/* Player 1 Card */}
            <div className={`p-5 rounded-2xl border ${activeRoom.player1Ready ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-slate-900 border-slate-755'} text-center space-y-2`}>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-white font-black">
                P1
              </div>
              <h4 className="font-bold text-white block text-sm">{activeRoom.player1Name}</h4>
              <span className={`inline-block py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider ${activeRoom.player1Ready ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-slate-850 border border-slate-750 text-slate-400'}`}>
                {activeRoom.player1Ready ? 'HAZIR ✓' : 'BEKLİYOR...'}
              </span>
            </div>

            {/* Player 2 Card */}
            <div className={`p-5 rounded-2xl border ${activeRoom.player2Id ? (activeRoom.player2Ready ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-slate-900 border-slate-755') : 'bg-slate-950/50 border-slate-800 border-dashed'} text-center space-y-2`}>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-white font-black">
                P2
              </div>
              <h4 className="font-bold text-white block text-sm">
                {activeRoom.player2Name || 'Bir rakip bekleniyor...'}
              </h4>
              <span className={`inline-block py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider ${activeRoom.player2Id ? (activeRoom.player2Ready ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-slate-850 border border-slate-750 text-slate-400') : 'bg-slate-900 text-slate-500'}`}>
                {activeRoom.player2Id ? (activeRoom.player2Ready ? 'HAZIR ✓' : 'BEKLİYOR...') : 'LOBİ BOŞ'}
              </span>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-750 max-w-md mx-auto">
            {isSpectator ? (
              <p className="text-xs text-amber-500/80 font-bold italic">
                Oyunun yaratıcısı ve eşleşen rakibin hazırlanması bekleniyor...
              </p>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`w-full py-4 text-base font-bold rounded-xl shadow-lg transition active:scale-95 cursor-pointer ${
                  (role === 'player1' ? activeRoom.player1Ready : activeRoom.player2Ready)
                    ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {(role === 'player1' ? activeRoom.player1Ready : activeRoom.player2Ready)
                  ? 'HAZIR DURUMUNU KALDIR'
                  : 'HAZIRIM! BAŞLAT'}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Main active game view */}
      {(activeRoom.status === 'playing' || activeRoom.status === 'completed' || activeRoom.status === 'abandoned') && (
        <div className="flex flex-col gap-6">

          {/* Action Log Ticker & Turn State Banner */}
          <div className="flex flex-col justify-between md:flex-row items-center bg-slate-900/80 border border-slate-750 rounded-2xl p-4 gap-3 shadow-md relative overflow-hidden">
            {/* Visual countdown progress line */}
            {activeRoom.status === 'playing' && (
              <div 
                className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${
                  timeLeft <= 6 ? 'bg-red-500 animate-pulse' : timeLeft <= 15 ? 'bg-amber-500' : 'bg-[#14b8a6]'
                }`}
                style={{ width: `${(timeLeft / 30) * 100}%` }}
              />
            )}

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-xs text-slate-400 font-semibold font-mono rounded">
                AKTİVİTE
              </div>
              <p className="text-slate-300 text-sm leading-relaxed truncate font-medium">
                {logMessage}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {activeRoom.status === 'playing' ? (
                <>
                  {/* Visual remaining turn timer */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all ${
                    timeLeft <= 6 
                      ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-pulse' 
                      : timeLeft <= 15
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-[#14b8a6]/10 border-[#14b8a6]/30 text-[#14b8a6]'
                  }`}>
                    <Clock className={`w-3.5 h-3.5 ${timeLeft <= 6 ? 'animate-bounce' : ''}`} />
                    <span>{timeLeft}s</span>
                  </div>

                  <span className="text-xs text-slate-400 uppercase font-semibold hidden sm:inline text-[10px]">Sıra:</span>
                  <div className={`px-4 py-1.5 rounded-lg border text-xs font-black uppercase flex items-center gap-1.5 ${
                    isMyTurn 
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 active-turn-glow' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-amber-400' : 'bg-slate-505'}`} />
                    {isMyTurn 
                      ? 'SİZDE' 
                      : (activeRoom.turn === 'player1' ? activeRoom.player1Name : activeRoom.player2Name)}
                  </div>
                </>
              ) : (
                <div className="px-4 py-1 bg-red-950/40 border border-red-800 text-red-200 font-bold rounded-lg text-xs uppercase text-center">
                  OYUN TAMAMLANDI
                </div>
              )}
            </div>
          </div>

          {/* Opponent player info (P2 - Visual Top Row) */}
          <div className="flex justify-between items-center px-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 tracking-wider font-mono">P2</span>
              <h4 className="text-md font-bold text-slate-200">
                {activeRoom.player2Name}
              </h4>
              {gameMode === 'singleplayer' && (
                <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-850 font-semibold rounded text-[10px] uppercase font-mono">
                  BOT
                </span>
              )}
            </div>
            {activeRoom.status === 'playing' && activeRoom.turn === 'player2' && (
              <span className="text-xs text-amber-400 flex items-center gap-2 animate-pulse bg-amber-950/20 border border-amber-900/40 px-3 py-1 rounded-lg">
                <Flame className="w-3.5 h-3.5" />
                {botIsThinking ? 'Bilge Bot düşünüyor...' : 'Hamle Yapıyor...'}
              </span>
            )}
          </div>

          {/* PHYSICAL WOODEN BOARD - THE HEARTS OF THE GAME */}
          <div className="wood-grain wood-bezel w-full rounded-2xl md:rounded-3xl p-3 md:p-8 flex flex-col md:flex-row relative gap-3 md:gap-4 border border-[#4d2106] select-none shadow-2xl">
            {/* Small decorative corner rivets */}
            <div className="hidden md:block w-3 h-3 bg-zinc-800 rounded-full absolute top-3 left-3 border border-zinc-950 opacity-40 shadow" />
            <div className="hidden md:block w-3 h-3 bg-zinc-800 rounded-full absolute top-3 right-3 border border-zinc-950 opacity-40 shadow" />
            <div className="hidden md:block w-3 h-3 bg-zinc-800 rounded-full absolute bottom-3 left-3 border border-zinc-950 opacity-40 shadow" />
            <div className="hidden md:block w-3 h-3 bg-zinc-800 rounded-full absolute bottom-3 right-3 border border-zinc-950 opacity-40 shadow" />

            {/* LAYOUT: Player 2 Store (Hazine) - index 13 */}
            {/* Visual LEFT end for Player 1 perspective or Top on mobile */}
            <div className={`flex flex-row md:flex-col md:w-36 w-full h-16 sm:h-20 md:h-80 shrink-0 bg-[#451e05] pit-bezel rounded-xl md:rounded-2xl p-3 items-center justify-between text-center relative border gap-2 transition-all duration-300 ${
              animatingPit === 13 
                ? 'border-indigo-400 ring-4 ring-indigo-500/50 bg-[#542406] scale-102 z-10' 
                : 'border-amber-950/40'
            }`}>
              {animatingPit === 13 && (
                <span className="absolute inset-0 rounded-xl md:rounded-2xl border-4 border-indigo-400 animate-ping opacity-75 pointer-events-none" />
              )}
              <span className="text-[9px] md:text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono text-left md:text-center shrink-0">
                {activeRoom.player2Name}'in Haznesi
              </span>
              
              {/* Stones area */}
              <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center min-h-[24px]">
                <div className="absolute inset-0 flex items-center justify-center scale-75 sm:scale-95 md:scale-100 transform origin-center transition-transform">
                  {renderStones(displayBoard ? displayBoard[13] : activeRoom.board[13])}
                </div>
              </div>

              <div className="font-mono text-xl md:text-3xl font-extrabold text-indigo-400 drop-shadow shadow-indigo-950 pb-0.5 px-1 shrink-0">
                {displayBoard ? displayBoard[13] : activeRoom.board[13]}
              </div>
            </div>

            {/* Pits Matrix Column */}
            <div className="flex-1 flex flex-col justify-between gap-3 sm:gap-4 md:gap-6">
              
              {/* TOP ROW: Player 2 pits (Indices: 12, 11, 10, 9, 8, 7) */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-3 md:gap-4">
                {[12, 11, 10, 9, 8, 7].map((idx) => {
                  const seeds = displayBoard ? displayBoard[idx] : activeRoom.board[idx];
                  const clickable = activeRoom.status === 'playing' && activeRoom.turn === 'player2' && seeds > 0 && isP2 && !isSowing;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => clickable && handlePitClick(idx)}
                      disabled={!clickable}
                      className={`h-16 xs:h-20 sm:h-24 md:h-32 bg-[#4c1f03] pit-bezel rounded-xl md:rounded-2xl flex flex-col items-center justify-between p-1.5 sm:p-2 relative transition-all duration-300 border ${
                        idx === animatingPit
                          ? 'border-indigo-400 ring-4 ring-indigo-500/50 bg-[#5e2604] scale-105 z-10'
                          : 'border-amber-950/20'
                      } ${
                        clickable 
                          ? 'hover:bg-[#5a2504] cursor-pointer hover:ring-2 hover:ring-indigo-500/40' 
                          : 'cursor-not-allowed opacity-90'
                      } ${
                        activeRoom.status === 'playing' && activeRoom.turn === 'player2' && seeds > 0 && !isSowing
                          ? 'ring-1 ring-indigo-500/30' 
                          : ''
                      }`}
                    >
                      {idx === animatingPit && (
                        <span className="absolute inset-0 rounded-xl md:rounded-2xl border-4 border-indigo-400 animate-ping opacity-75 pointer-events-none" />
                      )}
                      <span className="text-[8px] md:text-[9px] font-bold font-mono text-indigo-400 absolute top-1 md:top-1.5 left-1 md:left-2">
                        {13 - idx}
                      </span>

                      {/* Stones Container */}
                      <div className="flex-1 w-full relative overflow-hidden mt-1">
                        <div className="absolute inset-0 flex items-center justify-center scale-65 sm:scale-95 md:scale-100 transform origin-center transition-transform">
                          {renderStones(seeds)}
                        </div>
                      </div>

                      <span className="font-mono text-xs sm:text-md md:text-xl font-bold text-indigo-400 pb-0.5 sm:pb-1 pt-0.5 md:pt-0">
                        {seeds}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* BOTTOM ROW: Player 1 pits (Indices: 0, 1, 2, 3, 4, 5) */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-3 md:gap-4">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const seeds = displayBoard ? displayBoard[idx] : activeRoom.board[idx];
                  const clickable = activeRoom.status === 'playing' && activeRoom.turn === 'player1' && seeds > 0 && isP1 && !isSowing;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => clickable && handlePitClick(idx)}
                      disabled={!clickable}
                      className={`h-16 xs:h-20 sm:h-24 md:h-32 bg-[#4c1f03] pit-bezel rounded-xl md:rounded-2xl flex flex-col items-center justify-between p-1.5 sm:p-2 relative transition-all duration-300 border ${
                        idx === animatingPit
                          ? 'border-amber-400 ring-4 ring-amber-500/50 bg-[#5e2604] scale-105 z-10'
                          : 'border-amber-950/20'
                      } ${
                        clickable 
                          ? 'hover:bg-[#5a2504] cursor-pointer ring-1 ring-amber-500/40 hover:ring-2 hover:ring-amber-500 active-turn-glow' 
                          : 'cursor-not-allowed opacity-90'
                      }`}
                    >
                      {idx === animatingPit && (
                        <span className="absolute inset-0 rounded-xl md:rounded-2xl border-4 border-amber-400 animate-ping opacity-75 pointer-events-none" />
                      )}
                      <span className="text-[8px] md:text-[9px] font-bold font-mono text-amber-500 absolute top-1 md:top-1.5 left-1 md:left-2">
                        {idx + 1}
                      </span>

                      {/* Stones Container */}
                      <div className="flex-1 w-full relative overflow-hidden mt-1">
                        <div className="absolute inset-0 flex items-center justify-center scale-65 sm:scale-95 md:scale-100 transform origin-center transition-transform">
                          {renderStones(seeds)}
                        </div>
                      </div>

                      <span className="font-mono text-xs sm:text-md md:text-xl font-bold text-amber-500 pb-0.5 sm:pb-1 pt-0.5 md:pt-0">
                        {seeds}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LAYOUT: Player 1 Store (Hazine) - index 6 */}
            {/* Visual RIGHT end for Player 1 perspective or Bottom on mobile */}
            <div className={`flex flex-row md:flex-col md:w-36 w-full h-16 sm:h-20 md:h-80 shrink-0 bg-[#451e05] pit-bezel rounded-xl md:rounded-2xl p-3 items-center justify-between text-center relative border gap-2 transition-all duration-300 ${
              animatingPit === 6 
                ? 'border-amber-400 ring-4 ring-amber-500/50 bg-[#542406] scale-102 z-10' 
                : 'border-amber-950/40'
            }`}>
              {animatingPit === 6 && (
                <span className="absolute inset-0 rounded-xl md:rounded-2xl border-4 border-amber-400 animate-ping opacity-75 pointer-events-none" />
              )}
              <span className="text-[9px] md:text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono text-left md:text-center shrink-0">
                {activeRoom.player1Name}'in Haznesi
              </span>
              
              {/* Stones area */}
              <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center min-h-[24px]">
                <div className="absolute inset-0 flex items-center justify-center scale-75 sm:scale-95 md:scale-100 transform origin-center transition-transform">
                  {renderStones(displayBoard ? displayBoard[6] : activeRoom.board[6])}
                </div>
              </div>

              <div className="font-mono text-xl md:text-3xl font-extrabold text-amber-500 drop-shadow shadow-amber-950 pb-0.5 px-1 shrink-0">
                {displayBoard ? displayBoard[6] : activeRoom.board[6]}
              </div>
            </div>

          </div>

          {/* Bottom player info (P1 - Visual Bottom Row) */}
          <div className="flex justify-between items-center px-4 bg-slate-900/40 border border-slate-750/30 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-500 tracking-wider font-mono">P1</span>
              <h4 className="text-md font-bold text-slate-200">
                {activeRoom.player1Name} (Siz)
              </h4>
            </div>
            {activeRoom.status === 'playing' && activeRoom.turn === 'player1' && (
              <span className="text-xs text-amber-400 flex items-center gap-2 animate-pulse bg-amber-950/20 border border-amber-900/40 px-3 py-1 rounded-lg font-semibold">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Hamle Yapmanız Bekleniyor...
              </span>
            )}
          </div>

        </div>
      )}

      {/* GAME OVER CARD OVERLAY */}
      <AnimatePresence>
        {activeRoom.status === 'completed' && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-705 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 text-center space-y-6"
            >
              <div className="space-y-2">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/30 text-amber-500 mx-auto">
                  <Sparkles className="w-8 h-8 animate-bounce" />
                </div>
                <h2 className="text-2xl font-extrabold text-white">Karşılaşma Tamamlandı!</h2>
                <p className="text-xs text-slate-400">
                  48 taşın tamamı hanelere taşındı. Kazanan belirlendi.
                </p>
              </div>

              {/* Score comparisons */}
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-750 space-y-3">
                <div className="flex justify-between text-sm text-slate-400 font-semibold border-b border-slate-700 pb-2">
                  <span>Oyuncu</span>
                  <span>Toplam Skor</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-500 font-extrabold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {activeRoom.player1Name}
                  </span>
                  <span className="font-mono text-base font-bold text-white">{activeRoom.board[6]} Taş</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-indigo-400 font-extrabold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    {activeRoom.player2Name}
                  </span>
                  <span className="font-mono text-base font-bold text-white">{activeRoom.board[13]} Taş</span>
                </div>
              </div>

              {/* Status declaration */}
              <div>
                {activeRoom.winnerId === 'draw' ? (
                  <div className="bg-slate-900 border border-slate-75 w-full py-3.5 rounded-xl font-extrabold text-slate-200">
                    OYUN BERABERE BİTTİ (24 - 24)
                  </div>
                ) : (
                  <div className={`w-full py-3.5 rounded-xl font-black text-white ${
                    activeRoom.winnerId === currUserId 
                      ? 'bg-emerald-600 border border-emerald-500' 
                      : 'bg-indigo-950 border border-indigo-900'
                  }`}>
                    {activeRoom.winnerId === currUserId 
                      ? 'TEBRİKLER, OYUNU KAZANDINIZ 🎉' 
                      : `${activeRoom.winnerId === 'bot' ? 'YAPAY ZEKA' : 'RAKİP'} MAÇI KAZANDI`}
                  </div>
                )}
              </div>

              {/* Play again or exit */}
              <div className="flex gap-3">
                {gameMode === 'singleplayer' ? (
                  <button
                    onClick={handleRestartOffline}
                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition font-bold text-sm cursor-pointer"
                  >
                    Tekrar Oyna
                  </button>
                ) : null}
                
                <button
                  onClick={onBackToLobby}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition font-medium text-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Home className="w-4 h-4 text-amber-500" />
                  Lobiye Dön
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GAME ABANDONED OVERLAY */}
      <AnimatePresence>
        {activeRoom.status === 'abandoned' && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-705 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl p-6 text-center space-y-6"
            >
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-500 mx-auto">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Karşılaşma Yarıda Kaldı</h3>
                <p className="text-xs text-slate-400">
                  Odadaki rakiplerden biri oyundan ayrıldı veya karşılaşmayı terk etti.
                </p>
              </div>

              <button
                onClick={onBackToLobby}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-white transition text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Lobiye Geri Dön
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
