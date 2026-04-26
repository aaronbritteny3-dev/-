import { ItemType, ItemConfig } from './types';

export const COLORS = {
  background: '#05010a', // Almost black purple
  backgroundGradient: ['#000011', '#001122', '#000033'],
  fogColor: '#000022',
  fogNear: 25,
  fogFar: 85,
  boardBase: '#0a0a12', // Very dark base
  boardBorder: '#0a0a0a',
  boardGrid: '#00f3ff', // Cyan Neon
  boardGridSecondary: '#0088ff',
  boardStars: '#00aaff',
  blackPiece: '#111111', // Dark Metal
  blackPieceEmissive: '#ff003c', // Cyberpunk Red
  whitePiece: '#e0f7fa', // Holographic White
  whitePieceEmissive: '#00ffff', // Cyan Glow
  ground: '#020005', // Void
  highlight: '#facc15', // Yellow
  predicted: '#d946ef', // Neon Magenta
  corruptionStart: '#ff4400',
  corruptionEnd: '#00ff88',

  // Enhanced Visual Effects
  pillarColors: ['#ff0080', '#00ffff', '#8000ff', '#ff8000', '#00ff80'],
  particleColors: ['#ff0040', '#00ff80', '#0080ff', '#ff8000', '#8000ff'],
  ambientLights: ['#001122', '#220011', '#002211'],

  glowIntensities: {
    low: 0.3,
    medium: 0.7,
    high: 1.2,
    extreme: 2.0
  },

  metalness: {
    matte: 0.1,
    semiGloss: 0.4,
    metallic: 0.8,
    chrome: 0.95
  },

  roughness: {
    smooth: 0.05,
    semiRough: 0.3,
    rough: 0.6,
    matte: 0.9
  }
};

export const TIMING = {
  PHASE_1_DURATION: 25,        // 等待/过渡阶段：25秒（增加5秒）
  PHASE_2A_DURATION: 55,       // 玩家操作阶段：55秒（增加10秒）
  PHASE_2B_DURATION: 18,       // AI接管阶段：18秒（增加3秒）
};

// Duration (ms) for the silent piece color corruption animation
// 12 seconds for extremely gradual, nearly imperceptible change
export const CORRUPT_DURATION = 12000;

// Advanced easing function for smooth corruption - uses smooth step with multiple phases
// This creates a natural, barely-noticeable color transition
export const corruptionEasing = (t: number): number => {
  // Smoothstep-based easing for natural-looking transition
  // Phase 1 (0-0.3): Very slow start - almost imperceptible
  if (t < 0.3) {
    const st = t / 0.3;
    return st * st * (3 - 2 * st) * 0.3; // Ease-in-out smoothstep, scaled to 0-0.3
  }
  // Phase 2 (0.3-0.7): Gentle linear progression - still slow
  else if (t < 0.7) {
    const st = (t - 0.3) / 0.4;
    return 0.3 + st * 0.4; // Linear progression, scaled to 0.3-0.7
  }
  // Phase 3 (0.7-1.0): Accelerating finish
  else {
    const st = (t - 0.7) / 0.3;
    return 0.7 + st * st * (3 - 2 * st) * 0.3; // Ease-out smoothstep
  }
};

export const GRID_SPACING = 1.2;
export const PIECE_SIZE = 0.45;
export const PIECE_HEIGHT = 0.2;
export const HOVER_HEIGHT = 0.5;

// Enhanced Visual Constants
export const VISUAL_EFFECTS = {
  particleCount: 50,
  particleSpeed: 0.5,
  particleSize: 0.02,
  floatingGeometryCount: 8,
  floatingGeometrySpeed: 0.3,
  ambientLightIntensity: 0.08,
  directionalLightIntensity: 0.6,
  bloomIntensity: 1.5,
  vignetteDarkness: 0.6
};

// 道具系统配置

export const ITEMS: Record<ItemType, ItemConfig> = {
  [ItemType.SPYGLASS]: {
    id: ItemType.SPYGLASS,
    name: '窥镜',
    cost: 2,
    description: '显示AI下一步的落点',
    icon: '🔭',
  },
  [ItemType.ERASER]: {
    id: ItemType.ERASER,
    name: '橡皮',
    cost: 2,
    description: '消除己方或对方的最后一步棋',
    icon: '🧽',
    maxUsesPerGame: 3,
  },
  [ItemType.REMOTE]: {
    id: ItemType.REMOTE,
    name: '遥控器',
    cost: 2,
    description: '修改已落子的白棋位置',
    icon: '📱',
    maxUsesPerGame: 1,
  },
  [ItemType.FREEZE]: {
    id: ItemType.FREEZE,
    name: '冻结',
    cost: 1,
    description: '冻结倒计时5秒，暂停所有游戏提示',
    icon: '❄️',
  },
  [ItemType.TWINS]: {
    id: ItemType.TWINS,
    name: '双生子',
    cost: 3,
    description: '可以在一步中多放置一颗棋子，代价是下一步AI白棋也可以放置两颗棋子',
    icon: '👥',
  },
  [ItemType.LOAN]: {
    id: ItemType.LOAN,
    name: '自由贷款',
    cost: 1,
    description: '立即获得3枚代币，但效果触发后的一回合中玩家不能落子',
    icon: '💰',
  },
};

export const FREEZE_DURATION = 5000; // 冻结持续时间（毫秒）