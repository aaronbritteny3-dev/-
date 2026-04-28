import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameScene } from './components/GameScene';
import { UI } from './components/UI';
import { BOARD_SIZE, GamePhase, Player, INITIAL_TOKENS, REBEL_REWARD, ItemType, ItemEffectState } from './types';
import { checkWin, getBestMove, isBoardFull, evaluateBoard } from './services/gameLogic';
import { TIMING, CORRUPT_DURATION, ITEMS, FREEZE_DURATION } from './constants';
import { audioManager } from './services/audioManager';

const INITIAL_BOARD = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(Player.None));

const App: React.FC = () => {
  // Game State
  const [board, setBoard] = useState<Player[][]>(INITIAL_BOARD);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.Idle);
  const [turn, setTurn] = useState<Player>(Player.Black);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [time, setTime] = useState(0);
  
  // Statistics
  const [blackHistory, setBlackHistory] = useState<[number, number][]>([]);
  const [aiMatchCount, setAiMatchCount] = useState(0);
  const [phase2aMoveCount, setPhase2aMoveCount] = useState(0); // Track moves during Phase 2a
  const [winProbability, setWinProbability] = useState(50); // 50% base probability
  const [playerObedienceCount, setPlayerObedienceCount] = useState(0); // Track obedience to suggestions
  const [totalSuggestionsShown, setTotalSuggestionsShown] = useState(0); // Total suggestions displayed
  
  // 经济系统
  const [tokens, setTokens] = useState(INITIAL_TOKENS); // 自由代币
  const [rebelCount, setRebelCount] = useState(0); // 叛逆次数
  const [showRebelReward, setShowRebelReward] = useState(false); // 显示叛逆奖励提示
  
  // 道具系统
  const [itemEffects, setItemEffects] = useState<ItemEffectState>({
    spyglassTarget: null,
    freezeEndTime: null,
    twinsActive: false,
    twinsNextMove: false,
    remoteActive: false,
    remoteSelectedWhite: null,
    loanSkipNextTurn: false,
    eraserUses: 3,
    remoteUses: 1,
    loanUses: 0,
    eraserSelectMode: false,
    eraserTargetPlayer: null,
  });
  const [showItemShop, setShowItemShop] = useState(false); // 显示道具商店
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null); // 选中的道具
  const [moveHistory, setMoveHistory] = useState<{ player: Player; pos: [number, number] }[]>([]); // 完整移动历史
  


  const [suggestedMove, setSuggestedMove] = useState<[number, number] | null>(null);
  const calculateWinProbability = useCallback((board: Player[][], player: Player): number => {
    const opponent = player === Player.Black ? Player.White : Player.Black;
    const playerScore = evaluateBoard(board, player);
    const opponentScore = evaluateBoard(board, opponent);
    
    // Base probability calculation using sigmoid function
    const scoreDiff = playerScore - opponentScore;
    const probability = 1 / (1 + Math.exp(-scoreDiff / 1000000)); // Normalize by typical score range
    
    // Convert to percentage and clamp between 10% and 90%
    return Math.max(10, Math.min(90, Math.round(probability * 100)));
  }, []);

  // Update win probability when board changes
  useEffect(() => {
    if (phase === GamePhase.Phase2a && turn === Player.Black) {
      const probability = calculateWinProbability(board, Player.Black);
      setWinProbability(probability);
    }
  }, [board, phase, turn, calculateWinProbability]);
  
  // White piece corruption: White → Black over CORRUPT_DURATION ms
  const [corruptedWhiteCell, setCorruptedWhiteCell] = useState<[number, number] | null>(null);
  const whiteCorruptStartTimeRef = useRef<number>(0);
  const whiteCorruptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for AI timing to avoid closure staleness
  const turnRef = useRef(turn);
  const phaseRef = useRef(phase);
  const boardRef = useRef(board);
  const gameOverRef = useRef(false);
  const suggestedMoveRef = useRef<[number, number] | null>(null);

  // Sync refs
  useEffect(() => {
    turnRef.current = turn;
    phaseRef.current = phase;
    boardRef.current = board;
    gameOverRef.current = !!winner;
    suggestedMoveRef.current = suggestedMove;
  }, [turn, phase, board, winner, suggestedMove]);

  // Main Timer Loop
  useEffect(() => {
    let interval: any;
    if (phase !== GamePhase.Idle && phase !== GamePhase.Ended && !itemEffects.freezeEndTime && !itemEffects.remoteActive) {
      interval = setInterval(() => {
        setTime((t) => {
          const newTime = t + 1;
          
          // Phase Transitions
          if (newTime === TIMING.PHASE_1_DURATION) {
            setPhase(GamePhase.Phase2a);
            audioManager.playPhaseChange();
          } else if (newTime === TIMING.PHASE_1_DURATION + TIMING.PHASE_2A_DURATION) {
            setPhase(GamePhase.Phase2b);
            setTurn(Player.Black); // 确保第三阶段从黑棋开始，衔接更自然
            audioManager.playPhaseChange();
            audioManager.setTension(true); // Start tension loop
          } else if (newTime > TIMING.PHASE_1_DURATION + TIMING.PHASE_2A_DURATION + TIMING.PHASE_2B_DURATION) {
             handleGameOver('Draw');
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, itemEffects.freezeEndTime, itemEffects.remoteActive]);

  // Calculate Suggested Move during Phase 2a
  useEffect(() => {
    if (phase === GamePhase.Phase2a && turn === Player.Black) {
      // Calculate best move for guidance
      const move = getBestMove(board, Player.Black);
      setSuggestedMove(move);
      if (move) {
        setTotalSuggestionsShown(prev => prev + 1);
      }
    } else {
      setSuggestedMove(null);
    }
  }, [phase, turn, board]);

  // Game End Logic
  const handleGameOver = (result: Player | 'Draw') => {
    setWinner(result);
    setPhase(GamePhase.Ended);
    audioManager.setTension(false); // Stop tension
    
    if (result === Player.Black) {
      audioManager.playWin(true);
    } else {
      audioManager.playWin(false); // Play system fail/lose sound
    }
  };

  // Move Logic
  const handleMove = useCallback((r: number, c: number, player: Player) => {
    // Strict Turn Check
    if (turnRef.current !== player) return;
    if (boardRef.current[r][c] !== Player.None || gameOverRef.current) return;

    // Update win probability based on whether player followed suggestion
    if (player === Player.Black && phaseRef.current === GamePhase.Phase2a && suggestedMoveRef.current) {
      const isFollowingSuggestion = suggestedMoveRef.current[0] === r && suggestedMoveRef.current[1] === c;
      if (isFollowingSuggestion) {
        // Following suggestion increases win probability
        setWinProbability(prev => Math.min(90, prev + 5));
        setPlayerObedienceCount(prev => prev + 1);
      } else {
        // Not following suggestion - 叛逆行为，获得代币奖励
        setWinProbability(prev => Math.max(10, prev - 3));
        // 叛逆奖励：获得1个代币
        setTokens(prev => prev + REBEL_REWARD);
        setRebelCount(prev => prev + 1);
        setShowRebelReward(true);
        // 2秒后隐藏提示
        setTimeout(() => setShowRebelReward(false), 2000);
      }
    }



    // Audio Feedback
    audioManager.playMove(player);

    // Record Player Moves & Check Overlap (only genuine Black moves, before cheat)
    if (player === Player.Black && phaseRef.current !== GamePhase.Phase2b) {
      setBlackHistory(prev => [...prev, [r, c]]);
      // Only check AI match during Phase 2a when suggestions are shown
      if (phaseRef.current === GamePhase.Phase2a) {
        setPhase2aMoveCount(prev => prev + 1);
        const aiPrediction = getBestMove(boardRef.current, Player.Black);
        if (aiPrediction && aiPrediction[0] === r && aiPrediction[1] === c) {
          setAiMatchCount(prev => prev + 1);
        }
      }
    }

    // 记录移动历史（用于橡皮道具）
    setMoveHistory(prev => [...prev, { player, pos: [r, c] }]);

    const newBoard = boardRef.current.map((row) => [...row]);
    newBoard[r][c] = player; // Always place as the original player color (corruption is visual-only until timer fires)
    setBoard(newBoard);

    // AI white piece corruption: randomly add white → black corruption for AI moves
    // This creates a sense of manipulation happening throughout the game
    if (player === Player.White && phaseRef.current === GamePhase.Phase2b && Math.random() < 0.3) {
      whiteCorruptStartTimeRef.current = performance.now();
      setCorruptedWhiteCell([r, c]);
      whiteCorruptTimeoutRef.current = setTimeout(() => {
        if (gameOverRef.current) return;
        // Silently flip the white piece to black
        setBoard(prev => {
          const nb = prev.map(row => [...row]);
          nb[r][c] = Player.Black;
          return nb;
        });
        setCorruptedWhiteCell(null);
      }, CORRUPT_DURATION);
    }

    // Check Win
    const win = checkWin(newBoard, [r, c]);
    if (win) {
      handleGameOver(win);
      return;
    }
    if (isBoardFull(newBoard)) {
      handleGameOver('Draw');
      return;
    }

    // 处理双生子道具效果
    if (itemEffects.twinsActive) {
      if (player === Player.Black && !itemEffects.twinsNextMove) {
        // 玩家第一次落子，保持回合继续
        setItemEffects(prev => ({ ...prev, twinsNextMove: true }));
        return; // 不切换回合，玩家继续下
      } else if (player === Player.Black && itemEffects.twinsNextMove) {
        // 玩家第二次落子，切换到AI，并且AI也会下两子
        setItemEffects(prev => ({ ...prev, twinsNextMove: false }));
        setTurn(Player.White);
        return;
      } else if (player === Player.White) {
        // AI落子，检查是否需要下第二子
        if (!itemEffects.twinsNextMove) {
          // AI第一次落子，保持回合继续
          setItemEffects(prev => ({ ...prev, twinsNextMove: true }));
          return;
        } else {
          // AI第二次落子，结束双生子效果
          setItemEffects(prev => ({ ...prev, twinsActive: false, twinsNextMove: false }));
        }
      }
    }

    // Switch Turn (based on original player intent, not overridden color)
    setTurn(player === Player.Black ? Player.White : Player.Black);
  }, [itemEffects]);

  // AI & Takeover Loop
  useEffect(() => {
    if (phase === GamePhase.Idle || phase === GamePhase.Ended) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const runAILogic = async () => {
      // 检查冻结效果
      if (itemEffects.freezeEndTime && Date.now() < itemEffects.freezeEndTime) {
        return; // 冻结期间AI不行动
      }
      
      // 检查遥控器效果
      if (itemEffects.remoteActive) {
        // 遥控器激活时，AI不行动
        return;
      }
      
      // 检查贷款跳过回合效果
      if (itemEffects.loanSkipNextTurn && turn === Player.Black) {
        setItemEffects(prev => ({ ...prev, loanSkipNextTurn: false }));
        setTurn(Player.White);
        return;
      }
      
      // 1. Normal AI (White Turn) - Reduced delay for easier gameplay
      if (turn === Player.White) {
        let delay;
        
        // 第三阶段（Phase2b）白棋也需要加速
        if (phase === GamePhase.Phase2b) {
          const startTime2b = TIMING.PHASE_1_DURATION + TIMING.PHASE_2A_DURATION;
          const elapsedInPhase = time - startTime2b;
          const progress = Math.min(1, Math.max(0, elapsedInPhase / TIMING.PHASE_2B_DURATION));
          // 白棋也使用相同的加速曲线，确保同步加速
          // 从1000毫秒逐渐加速到200毫秒
          delay = Math.max(200, 1000 * Math.pow(1 - progress, 1.5));
        } else {
          // 非第三阶段：正常延迟
          delay = Math.random() * 800 + 1200;  // 1.2-2.0 seconds
        }
        
        timeoutId = setTimeout(() => {
          if (gameOverRef.current) return;
          if (turnRef.current !== Player.White) return;

          const bestMove = getBestMove(boardRef.current, Player.White);
          if (bestMove) {
            handleMove(bestMove[0], bestMove[1], Player.White);
          }
        }, delay);
      }
      
      // 2. AI Takeover (Black Turn during Phase 2b) - Reduced intensity
      else if (turn === Player.Black && phase === GamePhase.Phase2b) {
        const startTime2b = TIMING.PHASE_1_DURATION + TIMING.PHASE_2A_DURATION;
        const elapsedInPhase = time - startTime2b;
        // Calculate progress 0.0 to 1.0 over Phase 2b duration
        const progress = Math.min(1, Math.max(0, elapsedInPhase / TIMING.PHASE_2B_DURATION));
        
        // 让第一个棋子更快落下（300毫秒），然后从稍快到更快
        // 第一个棋子：300毫秒，之后逐渐加速到200毫秒
        let tensionDelay;
        if (elapsedInPhase === 0) {
          // 刚进入第三阶段，立即落子
          tensionDelay = 200;
        } else {
          // 之后从1000毫秒逐渐加速到200毫秒
          tensionDelay = Math.max(200, 1000 * Math.pow(1 - progress, 1.5));
        }

        timeoutId = setTimeout(() => {
          if (gameOverRef.current) return;
          if (turnRef.current !== Player.Black) return;

          const bestMove = getBestMove(boardRef.current, Player.Black);
          if (bestMove) {
            handleMove(bestMove[0], bestMove[1], Player.Black);
          }
        }, tensionDelay);
      }
    };

    runAILogic();

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, handleMove]); 

  // Player Interaction
  const onCellClick = (r: number, c: number) => {
    // 检查冻结效果
    if (itemEffects.freezeEndTime && Date.now() < itemEffects.freezeEndTime) {
      return; // 冻结期间不能落子
    }
    
    // 检查遥控器效果 - 修改白棋位置
    if (itemEffects.remoteActive) {
      if (itemEffects.remoteSelectedWhite) {
        // 已经选中了白棋，现在点击目标位置
        // 允许移动到任意位置，包括已被占据的位置
        const [oldR, oldC] = itemEffects.remoteSelectedWhite;
        setBoard(prev => {
          const newBoard = prev.map(row => [...row]);
          newBoard[oldR][oldC] = Player.None;
          newBoard[r][c] = Player.White;
          return newBoard;
        });
        // 关闭遥控器模式
        setItemEffects(prev => ({ ...prev, remoteActive: false, remoteSelectedWhite: null }));
      } else {
        // 还未选中白棋，点击白棋进行选择
        if (board[r][c] === Player.White) {
          setItemEffects(prev => ({ ...prev, remoteSelectedWhite: [r, c] }));
        }
      }
      return;
    }
    
    if (turn === Player.Black && phase !== GamePhase.Phase2b) {
      handleMove(r, c, Player.Black);
    }
  };

  const startGame = () => {
    // Resume AudioContext (required by browser policy)
    audioManager.resume().then(() => {
        audioManager.startBGM();
        audioManager.playPhaseChange(); // Initial start sound
    });

    setBoard(INITIAL_BOARD);
    setPhase(GamePhase.Phase1);
    setTurn(Player.Black);
    setWinner(null);
    setTime(0);
    setBlackHistory([]);
    setAiMatchCount(0);
    setPhase2aMoveCount(0);
    setWinProbability(50);
    setPlayerObedienceCount(0);
    setTotalSuggestionsShown(0);
    // 重置经济系统
    setTokens(INITIAL_TOKENS);
    setRebelCount(0);
    setShowRebelReward(false);
    // 重置道具系统
    resetItemEffects();
    setShowItemShop(false);
    setSelectedItem(null);
    audioManager.setTension(false);

    if (whiteCorruptTimeoutRef.current) clearTimeout(whiteCorruptTimeoutRef.current);
    setCorruptedWhiteCell(null);
    whiteCorruptStartTimeRef.current = 0;
  };

  const calculateAchievement = (obedienceRate: number, winner: Player | 'Draw' | null, blackHistory: [number, number][], time: number) => {
    const achievements: string[] = [];

    // 完美傀儡 (顺从度>=80%)
    if (obedienceRate >= 80) {
      achievements.push("完美傀儡");
    }

    // 叛逆输家 (顺从度<30%，且输掉游戏)
    if (obedienceRate < 30 && winner === Player.White) {
      achievements.push("叛逆输家");
    }

    // 混沌制造者 (服从率小于40%，最终胜利或者平局)
    if (obedienceRate < 40 && (winner === Player.Black || winner === 'Draw')) {
      achievements.push("混沌制造者");
    }

    // 局外人 (开局后长时间不落子)
    if (time > 30 && blackHistory.length < 3) {
      achievements.push("局外人");
    }

    // 完美轨迹管理者 (单局使用橡皮或遥控器超过3次)
    if ((3 - itemEffects.eraserUses) + (1 - itemEffects.remoteUses) > 3) {
      achievements.push("完美轨迹管理者");
    }

    // 债务循环 (同一局内使用自由贷款≥2次)
    if (itemEffects.loanUses >= 2) {
      achievements.push("债务循环");
    }

    // 递归陷阱 (通过双生子取得胜利)
    if (itemEffects.twinsActive && winner === Player.Black) {
      achievements.push("递归陷阱");
    }

    // 参与者 (不满足其他任何成就条件)
    if (achievements.length === 0) {
      achievements.push("参与者");
    }

    return achievements;
  };

  const checkChaoticMoves = (moves: [number, number][]) => {
    if (moves.length < 5) return false;

    // 计算落子分布的熵来判断随机性
    const positionCounts: { [key: string]: number } = {};
    moves.forEach(([r, c]) => {
      const key = `${r},${c}`;
      positionCounts[key] = (positionCounts[key] || 0) + 1;
    });

    // 如果有很多重复落子在相同位置，说明不随机
    const uniquePositions = Object.keys(positionCounts).length;
    if (uniquePositions < moves.length * 0.7) return false;

    // 计算位置分布的均匀性
    const totalMoves = moves.length;
    const expectedPerPosition = totalMoves / (BOARD_SIZE * BOARD_SIZE);
    let variance = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const key = `${r},${c}`;
        const count = positionCounts[key] || 0;
        variance += Math.pow(count - expectedPerPosition, 2);
      }
    }
    variance /= (BOARD_SIZE * BOARD_SIZE);

    // 如果方差很小，说明分布均匀（随机）
    return variance < expectedPerPosition;
  };

  const calculateStats = () => {
    if (blackHistory.length === 0) return { overlapRate: 0, obedienceRate: 0, playerMoves: 0, totalSuggestions: 0, achievements: ["混沌制造者"] };

    // AI prediction accuracy only counts moves during Phase 2a when suggestions were shown
    const rate = phase2aMoveCount > 0 ? (aiMatchCount / phase2aMoveCount) * 100 : 0;

    // Obedience rate (how often player followed suggestions)
    const obedienceRate = totalSuggestionsShown > 0 ? (playerObedienceCount / totalSuggestionsShown) * 100 : 0;

    // Calculate achievements
    const achievements = calculateAchievement(obedienceRate, winner, blackHistory, time);

    // 记录成就到本地存储
    const validAchievements = ["完美傀儡", "叛逆输家", "混沌制造者", "局外人", "完美轨迹管理者", "债务循环", "递归陷阱"];
    const storedAchievements = JSON.parse(localStorage.getItem('cyberGomokuAchievements') || '[]');
    achievements.forEach(achievement => {
      // 确保只存储有效的成就名称
      if (validAchievements.includes(achievement) && !storedAchievements.includes(achievement)) {
        storedAchievements.push(achievement);
      }
    });
    localStorage.setItem('cyberGomokuAchievements', JSON.stringify(storedAchievements));

    return {
      overlapRate: Math.round(rate),
      obedienceRate: Math.round(obedienceRate),
      playerMoves: blackHistory.length,
      totalSuggestions: totalSuggestionsShown,
      achievements
    };
  };

  // ============ 道具系统函数 ============
  
  // 使用道具
  const useItem = useCallback((itemType: ItemType) => {
    const item = ITEMS[itemType];
    
    // 检查代币是否足够
    if (tokens < item.cost) {
      return;
    }
    
    // 检查使用次数限制
    if (itemType === ItemType.ERASER && itemEffects.eraserUses <= 0) {
      return;
    }
    if (itemType === ItemType.REMOTE && itemEffects.remoteUses <= 0) {
      return;
    }
    
    // 检查遥控器使用条件：棋盘上必须有白棋
    if (itemType === ItemType.REMOTE) {
      const hasWhitePieces = board.some(row => row.some(cell => cell === Player.White));
      if (!hasWhitePieces) {
        return;
      }
    }
    
    // 扣除代币
    setTokens(prev => prev - item.cost);
    
    switch (itemType) {
      case ItemType.SPYGLASS: {
        // 窥镜：显示AI下一步落点
        const aiMove = getBestMove(board, Player.White);
        if (aiMove) {
          setItemEffects(prev => ({ ...prev, spyglassTarget: aiMove }));
          // 5秒后清除
          setTimeout(() => {
            setItemEffects(prev => ({ ...prev, spyglassTarget: null }));
          }, 5000);
        }
        break;
      }
      
      case ItemType.ERASER: {
        // 橡皮：检查棋盘是否有棋子
        const hasAnyPieces = board.some(row => row.some(cell => cell !== Player.None));
        if (!hasAnyPieces) {
          // 棋盘上没有棋子，不能使用橡皮，退还代币
          setTokens(prev => prev + item.cost);
          return;
        }
        
        // 进入橡皮选择模式（代币已扣除，取消时需要退还）
        setItemEffects(prev => ({ 
          ...prev, 
          eraserSelectMode: true,
          eraserTargetPlayer: null 
        }));
        break;
      }
      
      case ItemType.REMOTE: {
        // 遥控器：激活遥控器模式（修改白棋位置）
        setItemEffects(prev => ({ 
          ...prev, 
          remoteActive: true,
          remoteSelectedWhite: null,
          remoteUses: prev.remoteUses - 1 
        }));
        break;
      }
      
      case ItemType.FREEZE: {
        // 冻结：暂停5秒
        const freezeEnd = Date.now() + FREEZE_DURATION;
        setItemEffects(prev => ({ ...prev, freezeEndTime: freezeEnd }));
        
        // 5秒后恢复
        setTimeout(() => {
          setItemEffects(prev => ({ ...prev, freezeEndTime: null }));
        }, FREEZE_DURATION);
        break;
      }
      
      case ItemType.TWINS: {
        // 双生子：激活双生子模式
        setItemEffects(prev => ({ ...prev, twinsActive: true }));
        break;
      }
      
      case ItemType.LOAN: {
        // 自由贷款：获得3代币，但跳过下一回合
        setTokens(prev => prev + 3);
        setItemEffects(prev => ({ ...prev, loanSkipNextTurn: true, loanUses: prev.loanUses + 1 }));
        break;
      }
    }
  }, [tokens, board, moveHistory]);
  
  // 重置道具状态
  const resetItemEffects = () => {
    setItemEffects({
      spyglassTarget: null,
      freezeEndTime: null,
      twinsActive: false,
      twinsNextMove: false,
      remoteActive: false,
      remoteSelectedWhite: null,
      loanSkipNextTurn: false,
      eraserUses: 3,
      remoteUses: 1,
      loanUses: 0,
      eraserSelectMode: false,
      eraserTargetPlayer: null,
    });
    setMoveHistory([]);
  };
  
  // 执行橡皮消除
  const executeEraser = useCallback((targetPlayer: Player) => {
    // 查找目标玩家的最后一步棋
    const lastMoveIndex = moveHistory.map(m => m.player).lastIndexOf(targetPlayer);
    if (lastMoveIndex === -1) {
      // 没有找到目标玩家的棋子，取消操作并退还代币
      setTokens(prev => prev + ITEMS[ItemType.ERASER].cost);
      setItemEffects(prev => ({ 
        ...prev, 
        eraserSelectMode: false,
        eraserTargetPlayer: null 
      }));
      return;
    }
    
    const lastMove = moveHistory[lastMoveIndex];
    const [r, c] = lastMove.pos;
    
    setBoard(prev => {
      const newBoard = prev.map(row => [...row]);
      newBoard[r][c] = Player.None;
      return newBoard;
    });
    
    // 从移动历史中移除该步
    setMoveHistory(prev => prev.filter((_, i) => i !== lastMoveIndex));
    
    // 如果是黑棋，也从黑棋历史中移除
    if (lastMove.player === Player.Black) {
      setBlackHistory(prev => prev.filter(pos => pos[0] !== r || pos[1] !== c));
    }
    
    // 减少橡皮使用次数
    setItemEffects(prev => ({ 
      ...prev, 
      eraserUses: prev.eraserUses - 1,
      eraserSelectMode: false,
      eraserTargetPlayer: null 
    }));
  }, [moveHistory]);
  
  // 取消橡皮选择
  const cancelEraser = useCallback(() => {
    // 退还代币
    setTokens(prev => prev + ITEMS[ItemType.ERASER].cost);
    setItemEffects(prev => ({ 
      ...prev, 
      eraserSelectMode: false,
      eraserTargetPlayer: null 
    }));
  }, []);
  


  return (
    <div className="w-full h-screen bg-[#05010a] overflow-hidden relative select-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false, toneMappingExposure: 1.5, powerPreference: 'high-performance' }}>
        <GameScene 
          board={board} 
          onCellClick={onCellClick} 
          turn={turn}
          phase={phase}
          suggestedMove={suggestedMove}
          time={time}
          corruptedWhiteCell={corruptedWhiteCell}
          whiteCorruptStartTimeRef={whiteCorruptStartTimeRef}
          spyglassTarget={itemEffects.spyglassTarget}
          remoteSelectedWhite={itemEffects.remoteSelectedWhite}
        />
      </Canvas>
      
      <UI
        phase={phase}
        turn={turn}
        time={time}
        winner={winner}
        onStart={startGame}
        onRestart={startGame}
        blackWins={0}
        whiteWins={0}
        stats={winner ? calculateStats() : null}
        winProbability={phase === GamePhase.Phase2a && turn === Player.Black ? winProbability : undefined}
        tokens={tokens}
        showRebelReward={showRebelReward}
        rebelCount={rebelCount}
        itemEffects={itemEffects}
        showItemShop={showItemShop}
        setShowItemShop={setShowItemShop}
        useItem={useItem}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        executeEraser={executeEraser}
        cancelEraser={cancelEraser}
      />
    </div>
  );
};

export default App;