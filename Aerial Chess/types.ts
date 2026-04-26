export enum Player {
  None = 0,
  Black = 1, // Player
  White = 2, // AI
}

export enum GamePhase {
  Idle = 'IDLE',          // Start Screen
  Phase1 = 'PHASE_1',     // Normal Play (0-20s)
  Phase2a = 'PHASE_2A',   // Magnetic Guidance (20-40s)
  Phase2b = 'PHASE_2B',   // AI Takeover (40-65s)
  Ended = 'ENDED',        // Game Over
}

export interface GameState {
  board: Player[][];
  turn: Player;
  phase: GamePhase;
  winner: Player | 'Draw' | null;
  gameTime: number; // Seconds elapsed
  blackMoveHistory: [number, number][]; // Track player moves for "prediction"
  tokens: number; // 自由代币数量
  rebelCount: number; // 叛逆次数
}

export const BOARD_SIZE = 15;

export const INITIAL_TOKENS = 2; // 初始代币数量
export const REBEL_REWARD = 1; // 叛逆奖励代币数量

// 道具类型
export enum ItemType {
  SPYGLASS = 'SPYGLASS',     // 窥镜 - 显示AI下一步落点
  ERASER = 'ERASER',         // 橡皮 - 撤销上一步
  REMOTE = 'REMOTE',         // 遥控器 - 控制AI落子位置
  FREEZE = 'FREEZE',         // 冻结 - 暂停5秒
  TWINS = 'TWINS',           // 双生子 - 连下两子
  LOAN = 'LOAN',             // 自由贷款 - 借贷代币
}

// 道具配置
export interface ItemConfig {
  id: ItemType;
  name: string;
  cost: number;
  description: string;
  icon: string;
  maxUsesPerGame?: number;
}

// 道具状态
export interface ItemState {
  type: ItemType;
  usesRemaining: number;
  isActive: boolean;
}

// 道具效果状态
export interface ItemEffectState {
  spyglassTarget: [number, number] | null;  // 窥镜显示的目标
  freezeEndTime: number | null;             // 冻结结束时间
  twinsActive: boolean;                     // 双生子是否激活
  twinsNextMove: boolean;                   // 双生子的第二次移动
  remoteActive: boolean;                    // 遥控器是否激活
  remoteSelectedWhite: [number, number] | null; // 遥控器选中的白棋位置
  loanSkipNextTurn: boolean;                // 贷款后跳过下一回合
  eraserUses: number;                       // 橡皮使用次数
  remoteUses: number;                       // 遥控器使用次数
  loanUses: number;                         // 贷款使用次数
  eraserSelectMode: boolean;                // 橡皮选择模式（选择消除己方还是对方）
  eraserTargetPlayer: Player | null;        // 橡皮目标玩家
}
