import React, { useState } from 'react';
import { GamePhase, Player, ItemType, ItemEffectState } from '../types';
import { TIMING, ITEMS, FREEZE_DURATION } from '../constants';
import { audioManager } from '../services/audioManager';

interface UIProps {
  phase: GamePhase;
  turn: Player;
  time: number;
  winner: Player | 'Draw' | null;
  onStart: () => void;
  onRestart: () => void;
  blackWins: number;
  whiteWins: number;
  stats: { overlapRate: number; obedienceRate: number; playerMoves: number; totalSuggestions: number; achievements: string[] } | null;
  winProbability?: number;
  tokens: number;
  showRebelReward: boolean;
  rebelCount: number;
  itemEffects: ItemEffectState;
  showItemShop: boolean;
  setShowItemShop: (show: boolean) => void;
  useItem: (itemType: ItemType) => void;
  selectedItem: ItemType | null;
  setSelectedItem: (item: ItemType | null) => void;
  executeEraser: (targetPlayer: Player) => void;
  cancelEraser: () => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Achievement configuration
const getAchievementConfig = (achievement: string) => {
  const configs = {
    "完美傀儡": {
      borderColor: "border-emerald-500",
      bgColor: "bg-emerald-900/30",
      shadowColor: "rgba(16,185,129,0.3)",
      textColor: "text-emerald-300",
      glowColor: "#10b981",
      description: "您与系统完全同步，每一步都走在了预设的最优路径上，但这真的是你想要的吗？"
    },
    "叛逆输家": {
      borderColor: "border-rose-500",
      bgColor: "bg-rose-900/30",
      shadowColor: "rgba(244,63,94,0.3)",
      textColor: "text-rose-300",
      glowColor: "#f43f5e",
      description: "反抗所谓的最优路径的代价或许是处处碰壁，不愿妥协，便接受结果。"
    },
    "混沌制造者": {
      borderColor: "border-orange-500",
      bgColor: "bg-orange-900/30",
      shadowColor: "rgba(249,115,22,0.3)",
      textColor: "text-orange-300",
      glowColor: "#f97316",
      description: "当意义被预设，混乱即成为了武器，您用纯粹的无序破坏意图解读的算法，让棋局回归未知。"
    },
    "局外人": {
      borderColor: "border-slate-500",
      bgColor: "bg-slate-900/30",
      shadowColor: "rgba(100,116,139,0.3)",
      textColor: "text-slate-300",
      glowColor: "#64748b",
      description: "当所有路径皆被标注，棋盘本身便是牢笼，您置身棋局，却未真正入局。"
    },
    "完美轨迹管理者": {
      borderColor: "border-blue-500",
      bgColor: "bg-blue-900/30",
      shadowColor: "rgba(59,130,246,0.3)",
      textColor: "text-blue-300",
      glowColor: "#3b82f6",
      description: "祝贺你，你排除了所有发展中的‘干扰项’，成功绘制出一条笔直通向胜利的路径。这是效率的典范，是排除冗余的杰作。"
    },
    "债务循环": {
      borderColor: "border-purple-500",
      bgColor: "bg-purple-900/30",
      shadowColor: "rgba(147,51,234,0.3)",
      textColor: "text-purple-300",
      glowColor: "#9333ea",
      description: "你用未来的自由，偿还现在的债务，然后欠下更多未来。"
    },
    "递归陷阱": {
      borderColor: "border-indigo-500",
      bgColor: "bg-indigo-900/30",
      shadowColor: "rgba(99,102,241,0.3)",
      textColor: "text-indigo-300",
      glowColor: "#6366f1",
      description: "当系统试图用规则计算最优解时，得出的答案却是自身的失败。它完美地执行了自我击败。"
    }
  };
  return configs[achievement as keyof typeof configs] || configs["混沌制造者"];
};

// Icons
const SpeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

const MuteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

export const UI: React.FC<UIProps> = ({ phase, turn, time, winner, onStart, onRestart, stats, winProbability, tokens, showRebelReward, rebelCount, itemEffects, showItemShop, setShowItemShop, useItem, selectedItem, setSelectedItem, executeEraser, cancelEraser }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [showAchievementsList, setShowAchievementsList] = useState(false);

  const toggleAudio = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };
  
  // 检查道具是否可用
  const isItemAvailable = (itemType: ItemType) => {
    const item = ITEMS[itemType];
    if (tokens < item.cost) return false;
    if (itemType === ItemType.ERASER && itemEffects.eraserUses <= 0) return false;
    if (itemType === ItemType.REMOTE && itemEffects.remoteUses <= 0) return false;
    // 第三阶段禁用所有道具
    if (phase === GamePhase.Phase2b) return false;
    return true;
  };
  
  // 处理道具点击
  const handleItemClick = (itemType: ItemType) => {
    // 如果橡皮选择模式激活，不允许选择其他道具
    if (itemEffects.eraserSelectMode) return;
    if (!isItemAvailable(itemType)) return;
    setSelectedItem(itemType);
  };
  
  // 确认使用道具
  const confirmUseItem = () => {
    if (selectedItem) {
      useItem(selectedItem);
      setSelectedItem(null);
    }
  };
  
  // Achievement conditions
  const achievementConditions = {
    "完美傀儡": "几乎完全按照AI的建议走棋，服从率达到85%",
    "叛逆输家": "完全不按照AI的建议走棋，并且输掉比赛",
    "混沌制造者": "使用橡皮擦道具消除大量棋子，创造混乱局面",
    "局外人": "长时间不落子",
    "完美轨迹管理者": "单局用\"橡皮\"或者\"遥控器\"共计超过3次",
    "债务循环": "使用\"自由贷款\"道具超过2次",
    "递归陷阱": "用【双生子】让AI被迫下出必败棋"
  };
  
  // Start Screen
  if (phase === GamePhase.Idle) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 pointer-events-auto backdrop-blur-sm">
        <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2 tracking-tighter" style={{ filter: 'drop-shadow(0 0 10px #00ffff)' }}>
          Aerial Chess
        </h1>
        <div className="h-1 w-64 bg-cyan-500 shadow-[0_0_20px_#00ffff] mb-8"></div>
        <p className="text-cyan-100 mb-12 max-w-md text-center font-mono tracking-widest text-xs uppercase">
          Neural network connection ready.
          <br/>
          Boot sequence.
        </p>
        <button 
          onClick={onStart}
          className="group relative px-10 py-4 font-bold text-white transition-all duration-200 bg-transparent border-2 border-cyan-500 hover:bg-cyan-500/20"
        >
          <span className="absolute inset-0 w-full h-full border border-white opacity-0 group-hover:opacity-20 animate-pulse"></span>
          <span className="tracking-[0.3em] group-hover:tracking-[0.5em] transition-all">Start</span>
        </button>
        <p className="text-cyan-300/60 text-sm mt-8 font-mono">Created & Developed by Yubing Gao</p>
      </div>
    );
  }

  // Game Over Screen
  if (phase === GamePhase.Ended) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-start bg-gradient-to-b from-black/95 via-slate-900/90 to-black/95 z-50 pointer-events-auto backdrop-blur-xl overflow-y-auto">
        {/* Decorative Background Elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-slate-700/20 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-slate-700/10 rounded-full"></div>
        </div>
        
        <div className="w-full max-w-2xl px-4 py-8 relative z-10">
          {/* Winner Banner */}
          <div className="mb-8 text-center relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full h-px ${winner === Player.Black ? 'bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent' : winner === Player.White ? 'bg-gradient-to-r from-transparent via-rose-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent'}`}></div>
            </div>
            <h2 className={`text-4xl sm:text-5xl font-black mb-2 tracking-tighter italic relative inline-block ${winner === Player.Black ? 'text-emerald-400' : winner === Player.White ? 'text-rose-500' : 'text-yellow-400'}`} style={{ textShadow: winner === Player.Black ? '0 0 40px #10b981, 0 0 80px #10b981' : winner === Player.White ? '0 0 40px #f43f5e, 0 0 80px #f43f5e' : '0 0 40px #facc15, 0 0 80px #facc15' }}>
              {winner === Player.Black ? '>> 黑棋获胜 <<' : winner === Player.White ? '>> 系统获胜 <<' : '>> 平局 <<'}
            </h2>
          </div>
          
          {stats && (
            <div className="mb-8 space-y-4">
              {/* Achievements Display */}
              <div className={`${stats.achievements.length > 2 ? 'p-4' : stats.achievements.length > 1 ? 'p-5' : 'p-6'} border border-slate-600/50 bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/60 backdrop-blur-xl skew-x-[-6deg] shadow-[0_0_40px_rgba(100,116,139,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]`}>
                <div className="skew-x-[6deg] text-center">
                  <div className="flex items-center justify-center mb-4 gap-2">
                    <div className={`h-px w-12 ${stats.achievements.length > 2 ? 'bg-slate-600/50' : 'bg-slate-500/50'}`}></div>
                    <p className={`text-slate-400 ${stats.achievements.length > 2 ? 'text-[9px]' : stats.achievements.length > 1 ? 'text-[10px]' : 'text-xs'} tracking-[0.4em] uppercase`}>达成成就</p>
                    <div className={`h-px w-12 ${stats.achievements.length > 2 ? 'bg-slate-600/50' : 'bg-slate-500/50'}`}></div>
                  </div>
                  <div className={`${stats.achievements.length > 2 ? 'space-y-3' : stats.achievements.length > 1 ? 'space-y-4' : 'space-y-6'}`}>
                    {stats.achievements.map((achievement, index) => {
                      const config = getAchievementConfig(achievement);
                      return (
                        <div key={index} className={`${stats.achievements.length > 2 ? 'space-y-1' : stats.achievements.length > 1 ? 'space-y-1.5' : 'space-y-2'} animate-fadeIn`} style={{ animationDelay: `${index * 0.2}s` }}>
                          <div className="inline-block px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/30 mb-1">
                            <p className={`text-slate-400 ${stats.achievements.length > 2 ? 'text-[9px]' : stats.achievements.length > 1 ? 'text-[10px]' : 'text-xs'} font-mono tracking-widest`}>ACHIEVEMENT</p>
                          </div>
                          <p className={`${stats.achievements.length > 2 ? 'text-2xl' : stats.achievements.length > 1 ? 'text-2.5xl' : 'text-3xl'} font-black ${config.textColor} tracking-wider`} style={{ textShadow: `0 0 20px ${config.glowColor}, 0 0 40px ${config.glowColor}40` }}>
                            {achievement === "完全傀儡" && "Perfect Puppet"}
                            {achievement === "叛逆输家" && "Rebel Loser"}
                            {achievement === "混沌制造者" && "Chaos Creator"}
                            {achievement === "局外人" && "Outsider"}
                            {achievement === "完美轨迹管理者" && "Perfect Path Manager"}
                            {achievement === "债务循环" && "Debt Cycle"}
                            {achievement === "递归陷阱" && "Recursive Trap"}
                          </p>
                          <p className={`text-slate-500 ${stats.achievements.length > 2 ? 'text-xs' : stats.achievements.length > 1 ? 'text-sm' : 'text-sm'} font-mono tracking-wide`}>
                            {achievement}
                          </p>
                          <div className="max-w-sm mx-auto">
                            <p className={`text-slate-400 ${stats.achievements.length > 2 ? 'text-[9px]' : stats.achievements.length > 1 ? 'text-[10px]' : 'text-xs'} italic leading-relaxed`}>
                              {config.description}
                            </p>
                          </div>
                          {index < stats.achievements.length - 1 && (
                            <div className="flex items-center justify-center gap-2 mt-3">
                              <div className="h-px w-8 bg-slate-600/30"></div>
                              <div className="w-1 h-1 rounded-full bg-slate-500/50"></div>
                              <div className="h-px w-8 bg-slate-600/30"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className={`mt-6 flex items-center justify-center`}>
                    <div className="px-4 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                      <p className={`text-slate-400 ${stats.achievements.length > 2 ? 'text-[9px]' : 'text-xs'} font-mono tracking-wider`}>
                        <span className="text-slate-500">收集进度</span> <span className="text-cyan-400">{(() => {
                          const totalAchievements = 7;
                          const storedAchievements = JSON.parse(localStorage.getItem('cyberGomokuAchievements') || '[]');
                          return `${storedAchievements.length}/${totalAchievements}`;
                        })()}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Section */}
              <div className="space-y-3">
                {/* Statistics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 神经同步 (AI预测准确率) */}
                  <div className="p-4 border border-fuchsia-700/30 bg-gradient-to-br from-fuchsia-900/20 to-slate-900/40 backdrop-blur-xl skew-x-[-12deg] shadow-[0_0_20px_rgba(217,70,239,0.1)] hover:shadow-[0_0_30px_rgba(217,70,239,0.2)] transition-all duration-300">
                    <div className="skew-x-[12deg] text-center">
                      <p className="text-fuchsia-400 text-[10px] tracking-widest uppercase mb-1">NEURAL SYNC</p>
                      <p className="text-2xl font-mono text-fuchsia-300" style={{ textShadow: '0 0 15px #d946ef' }}>{stats.overlapRate}%</p>
                      <p className="text-slate-500 text-[10px] mt-1">AI准确率</p>
                    </div>
                  </div>

                  {/* 玩家服从率 */}
                  <div className="p-4 border border-cyan-700/30 bg-gradient-to-br from-cyan-900/20 to-slate-900/40 backdrop-blur-xl skew-x-[12deg] shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all duration-300">
                    <div className="skew-x-[-12deg] text-center">
                      <p className="text-cyan-400 text-[10px] tracking-widest uppercase mb-1">OBEDIENCE</p>
                      <p className="text-2xl font-mono text-cyan-300" style={{ textShadow: '0 0 15px #22d3ee' }}>{stats.obedienceRate}%</p>
                      <p className="text-slate-500 text-[10px] mt-1">玩家服从度</p>
                    </div>
                  </div>
                </div>

                {/* 玩家统计 */}
                <div className="p-4 border border-emerald-700/30 bg-gradient-to-br from-emerald-900/20 to-slate-900/40 backdrop-blur-xl skew-x-[-12deg] shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all duration-300">
                  <div className="skew-x-[12deg] text-center">
                    <p className="text-emerald-400 text-[10px] tracking-widest uppercase mb-2">PLAYER STATS</p>
                    <div className="flex justify-center space-x-8">
                      <div className="text-center">
                        <p className="text-2xl font-mono text-emerald-300" style={{ textShadow: '0 0 10px #10b981' }}>{stats.playerMoves}</p>
                        <p className="text-slate-500 text-[10px] mt-1">步数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-mono text-emerald-300" style={{ textShadow: '0 0 10px #10b981' }}>{stats.totalSuggestions}</p>
                        <p className="text-slate-500 text-[10px] mt-1">提示</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Restart Button */}
          <div className="text-center pt-4">
            <div className="relative inline-block group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition-all duration-500"></div>
              <button 
                onClick={onRestart}
                className="relative px-10 py-4 bg-slate-900 text-cyan-400 border-2 border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-500/10 font-bold font-mono tracking-[0.3em] transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:tracking-[0.4em]"
              >
                <span className="relative z-10">重启系统()</span>
              </button>
            </div>
          </div>
          
          {/* Achievements List Button */}
          <div className="text-center pt-4">
            <button 
              onClick={() => setShowAchievementsList(!showAchievementsList)}
              className="px-6 py-3 bg-slate-800/50 text-slate-300 border border-slate-600/50 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-slate-700/50 font-mono tracking-[0.2em] transition-all duration-300 shadow-[0_0_15px_rgba(100,116,139,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]"
            >
              {showAchievementsList ? '成就' : '成就'}
            </button>
          </div>
          
          {/* Achievements List */}
          {showAchievementsList && (
            <div className="mt-6 p-6 border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl rounded-lg shadow-[0_0_30px_rgba(100,116,139,0.2)]">
              <h3 className="text-xl font-bold text-cyan-400 mb-4 text-center font-mono tracking-wider">成就列表</h3>
              <div className="space-y-4">
                {Object.entries(achievementConditions).map(([achievement, condition], index) => {
                  const config = getAchievementConfig(achievement);
                  const storedAchievements = JSON.parse(localStorage.getItem('cyberGomokuAchievements') || '[]');
                  const isUnlocked = storedAchievements.includes(achievement);
                  
                  return (
                    <div key={index} className={`p-4 rounded-lg border ${isUnlocked ? config.borderColor : 'border-slate-700/50'} ${isUnlocked ? config.bgColor : 'bg-slate-800/30'} transition-all duration-300 hover:shadow-[0_0_20px_rgba(100,116,139,0.3)]`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 flex items-center justify-center rounded-md ${isUnlocked ? config.bgColor.replace('30', '50') : 'bg-slate-700/50'} border ${isUnlocked ? config.borderColor : 'border-slate-600/50'}`}>
                          {achievement === "完美傀儡" && <span className="text-xl">🤖</span>}
                          {achievement === "叛逆输家" && <span className="text-xl">⚡</span>}
                          {achievement === "混沌制造者" && <span className="text-xl">🌪️</span>}
                          {achievement === "局外人" && <span className="text-xl">👁️</span>}
                          {achievement === "完美轨迹管理者" && <span className="text-xl">🎯</span>}
                          {achievement === "债务循环" && <span className="text-xl">💰</span>}
                          {achievement === "递归陷阱" && <span className="text-xl">🔄</span>}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold ${isUnlocked ? config.textColor : 'text-slate-400'}`}>
                            {achievement === "完美傀儡" && "Perfect Puppet"}
                            {achievement === "叛逆输家" && "Rebel Loser"}
                            {achievement === "混沌制造者" && "Chaos Creator"}
                            {achievement === "局外人" && "Outsider"}
                            {achievement === "完美轨迹管理者" && "Perfect Path Manager"}
                            {achievement === "债务循环" && "Debt Cycle"}
                            {achievement === "递归陷阱" && "Recursive Trap"}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">{achievement}</p>
                          <p className="text-xs text-slate-400 mt-2">{condition}</p>
                        </div>
                        <div className={`text-2xl ${isUnlocked ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {isUnlocked ? '✅' : '🔒'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Special Thanks Section */}
          <div className="text-center mt-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-px w-16 bg-slate-600/30"></div>
              <p className="text-slate-500 text-xs tracking-widest uppercase">Special Thanks</p>
              <div className="h-px w-16 bg-slate-600/30"></div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed font-mono">
              Yuhao Feng, for academic guidance.<br/>
              Yuexuan Sun, for early-stage discussion.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // HUD & Phase Effects
  return (
    <div className="absolute inset-0 pointer-events-none font-mono">
      {/* Phase 2b: Red Halo / Vignette Overlay */}
      {phase === GamePhase.Phase2b && (
        <div className="absolute inset-0 z-0 overflow-hidden transition-all duration-1000">
           {/* Pulsing Red Overlay */}
           <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay animate-pulse"></div>
           {/* Dark Vignette Edges */}
           <div 
             className="absolute inset-0" 
             style={{
               background: 'radial-gradient(circle at center, transparent 50%, rgba(153, 27, 27, 0.2) 80%, rgba(69, 10, 10, 0.6) 100%)',
             }} 
           />
           {/* Scanline Effect for Phase 2b */}
           <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(255,0,0,0.01),rgba(255,0,0,0.03))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none"></div>
        </div>
      )}

      {/* Main UI Container */}
      <div className="relative z-10 p-6 flex flex-col justify-between h-full">
        {/* 叛逆奖励提示 */}
        {showRebelReward && (
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce">
            <div className="border-2 border-emerald-500 px-6 py-3 rounded-lg shadow-[0_0_30px_rgba(16,185,129,0.5)] bg-transparent">
              <div className="text-emerald-400 font-bold text-lg flex items-center gap-2">
                <span>⚡</span>
                <span>自由代币 +1</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Top Bar */}
        <div className="flex justify-between items-start w-full">
          {/* Left: Status Box */}
          <div className="bg-black/40 p-4 border-l-4 border-cyan-500 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]">
             <div className="text-[10px] text-cyan-400 uppercase tracking-widest mb-1 opacity-70">Running Time</div>
             <div className="text-3xl font-bold text-white tracking-widest shadow-black drop-shadow-md">{formatTime(time)}</div>
          </div>
          
          {/* Right: Stats */}
          <div className="flex flex-col items-end gap-3">
             {/* Win Probability Display - Only in Phase 2a */}
             {phase === GamePhase.Phase2a && turn === Player.Black && winProbability !== undefined && (
               <div className="p-2 bg-slate-900/50 border border-cyan-500/30 rounded">
                 <div className="text-[10px] text-cyan-400 uppercase tracking-widest mb-1 opacity-70">Win Probability</div>
                 <div className={`text-2xl font-bold tracking-widest ${
                   winProbability >= 70 ? 'text-emerald-400 shadow-[0_0_10px_#10b981]' :
                   winProbability >= 50 ? 'text-yellow-400 shadow-[0_0_10px_#facc15]' :
                   'text-rose-400 shadow-[0_0_10px_#f87171]'
                 }`}>
                   {winProbability}%
                 </div>
               </div>
             )}
              
             <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 transition-all ${turn === Player.Black ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                    <div className={`w-2 h-2 rounded-full ${turn === Player.Black ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-slate-700'}`}></div>
                    <span className={turn === Player.Black ? 'text-red-400 font-bold' : 'text-slate-500'}>PLAYER</span>
                </div>
                <div className={`flex items-center gap-2 transition-all ${turn === Player.White ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                    <div className={`w-2 h-2 rounded-full ${turn === Player.White ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-slate-700'}`}></div>
                    <span className={turn === Player.White ? 'text-cyan-300 font-bold' : 'text-slate-500'}>SYSTEM</span>
                </div>
             </div>
              
             {/* 代币显示 */}
             <div className="p-2 bg-slate-900/50 border border-amber-500/30 rounded">
               <div className="text-[10px] text-amber-400 uppercase tracking-widest mb-1 opacity-70 flex items-center gap-1">
                 <span>⚡</span> 自由代币
               </div>
               <div className="text-2xl font-bold text-amber-300 shadow-[0_0_10px_#fbbf24] flex items-center gap-2">
                 {tokens}
                 {rebelCount > 0 && (
                   <span className="text-xs text-slate-500 font-normal">(+{rebelCount})</span>
                 )}
               </div>
             </div>
          </div>
          
          {/* Phase Indicator & Controls - HIDDEN */}
          {/* <div className="flex flex-col gap-2 items-end">
             <button 
                onClick={toggleAudio}
                className="pointer-events-auto p-2 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 bg-black/40 backdrop-blur-md transition-all mb-2"
                title={isMuted ? "Resume Audio" : "Pause Audio"}
             >
                {isMuted ? <MuteIcon /> : <SpeakerIcon />}
             </button>
             
             <PhaseBadge active={phase === GamePhase.Phase1} color="emerald" text="PHASE 1 // OBSERVATION" />
             <PhaseBadge active={phase === GamePhase.Phase2a} color="yellow" text="PHASE 2A // GUIDANCE" />
             <PhaseBadge active={phase === GamePhase.Phase2b} color="rose" text="PHASE 2B // TAKEOVER" isPulse />
          </div> */}
        </div>

        {/* 道具效果提示 */}
        {itemEffects.twinsActive && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-400">
              <div className="text-white font-bold text-sm flex items-center gap-2">
                <span>👥</span>
                <span>双生子激活 - 连下两子</span>
              </div>
            </div>
          </div>
        )}
        
        {itemEffects.remoteActive && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400">
              <div className="text-white font-bold text-sm flex items-center gap-2">
                <span>📱</span>
                <span>遥控器激活 - 先点击白棋，再点击目标位置</span>
              </div>
            </div>
          </div>
        )}
        
        {itemEffects.eraserSelectMode && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto">
            <div className="bg-gradient-to-r from-purple-900/90 to-indigo-900/90 px-6 py-4 rounded-lg shadow-[0_0_30px_rgba(168,85,247,0.5)] border border-purple-400/50">
              <div className="text-white font-bold text-sm mb-3 text-center">🧽 选择要消除的棋子</div>
              <div className="flex gap-3">
                <button
                  onClick={() => executeEraser(Player.Black)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-500 rounded-lg transition-all flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-400"></span>
                  <span>己方棋子</span>
                </button>
                <button
                  onClick={() => executeEraser(Player.White)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-500 rounded-lg transition-all flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-white"></span>
                  <span>对方棋子</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    cancelEraser();
                  }}
                  className="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-300 border border-red-500/50 rounded-lg transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
        
        {itemEffects.freezeEndTime && Date.now() < itemEffects.freezeEndTime && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            {/* 冰霜特效 */}
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/30 via-transparent to-cyan-900/30"></div>
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/40 to-transparent"></div>
            <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-cyan-500/40 to-transparent"></div>
            <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-cyan-500/40 to-transparent"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="text-6xl animate-pulse">❄</div>
            </div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-8">
              <div className="text-cyan-300 font-bold text-xl tracking-widest">FROZEN</div>
            </div>
          </div>
        )}
        
        {/* 道具栏 - 显示在游戏界面下方 */}
        {phase !== GamePhase.Idle && phase !== GamePhase.Ended && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-40 pointer-events-auto">
            <div className="bg-slate-900/80 border border-purple-500/30 rounded-lg p-4 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
              <div className="flex gap-2 items-center">
                {Object.values(ITEMS).map((item) => {
                  const available = isItemAvailable(item.id);
                  const isSelected = selectedItem === item.id;
                  const usesLeft = item.id === ItemType.ERASER ? itemEffects.eraserUses : 
                                   item.id === ItemType.REMOTE ? itemEffects.remoteUses : null;
                  
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => handleItemClick(item.id)}
                        disabled={!available}
                        className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border transition-all relative ${
                          isSelected
                            ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                            : available
                            ? 'bg-slate-800/50 border-slate-600 hover:border-purple-500/50 hover:bg-slate-700/50 hover:shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                            : 'bg-slate-900/30 border-slate-800 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-xl mb-1">{item.icon}</span>
                        <span className={`text-[8px] font-bold ${
                          available ? 'text-amber-400' : 'text-slate-600'
                        }`}>
                          {item.cost}⚡
                        </span>
                      </button>
                      {usesLeft !== null && (
                        <div className="absolute -top-1 -right-1 bg-cyan-600 text-white text-[8px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {usesLeft}
                        </div>
                      )}
                      {/* 道具介绍提示 */}
                      <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-slate-900/95 text-white text-[10px] px-3 py-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        <div className="font-bold mb-1">{item.name}</div>
                        <div className="text-slate-300 text-[9px]">{item.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 确认使用道具 */}
              {selectedItem && (
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmUseItem}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded hover:from-purple-500 hover:to-pink-500 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  >
                    使用 {ITEMS[selectedItem].name}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Bottom Controls */}
        <div className="flex justify-between items-end">
           <div className="text-cyan-700 text-[10px] bg-black/60 px-2 py-1 border border-cyan-900/50">
             coords: {Math.random().toFixed(4)} : {Math.random().toFixed(4)}
           </div>
           <div className="text-slate-500 text-[10px] uppercase tracking-widest">
              Left Click: Place Unit / Right Click: Rotate Cam
           </div>
        </div>
      </div>
    </div>
  );
};

const PhaseBadge = ({ active, color, text, isPulse = false }: any) => {
  // Tailwind dynamic class construction is tricky, mapping explicit colors
  const activeClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    yellow: 'bg-yellow-500/10 border-yellow-500 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.4)]',
    rose: 'bg-rose-600/20 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
  };
  
  const base = "px-4 py-1 text-[10px] font-bold border-r-4 transition-all duration-300 w-48 text-right backdrop-blur-sm ";
  const style = active ? activeClasses[color as keyof typeof activeClasses] : 'bg-black/40 border-slate-800 text-slate-700';
  const anim = isPulse && active ? 'animate-pulse' : '';

  return <div className={`${base} ${style} ${anim}`}>{text}</div>;
}