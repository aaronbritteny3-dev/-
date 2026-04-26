import { BOARD_SIZE, Player } from '../types';

// Directions to check: Horizontal, Vertical, Diagonal \, Diagonal /
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

// Heuristic Scores - Reduced for easier gameplay
const SCORES = {
  FIVE: 100000000,
  LIVE_FOUR: 8000000,        // Reduced from 10000000 (easier to defend)
  SLEEP_FOUR: 800000,        // Reduced from 1000000 (less aggressive)
  LIVE_THREE: 80000,         // Reduced from 100000 (less priority)
  SLEEP_THREE: 8000,         // Reduced from 10000
  LIVE_TWO: 800,             // Reduced from 1000
  SLEEP_TWO: 80,             // Reduced from 100
};

export const checkWin = (board: Player[][], lastMove: [number, number]): Player | null => {
  const [r, c] = lastMove;
  const player = board[r][c];
  if (player === Player.None) return null;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;

    // Check forward
    let i = 1;
    while (true) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr][nc] !== player) break;
      count++;
      i++;
    }

    // Check backward
    i = 1;
    while (true) {
      const nr = r - dr * i;
      const nc = c - dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr][nc] !== player) break;
      count++;
      i++;
    }

    if (count >= 5) return player;
  }

  return null;
};

export const isBoardFull = (board: Player[][]): boolean => {
  return board.every(row => row.every(cell => cell !== Player.None));
};

// Analyze a specific direction for patterns
// Converts the line into a string representation for easy matching
// 1 = My Stone, 0 = Empty, 2 = Opponent/Wall
const evaluateDirection = (board: Player[][], r: number, c: number, dr: number, dc: number, player: Player): number => {
  const line: number[] = [];
  
  // Create a window of +/- 4 cells around the candidate
  for (let k = -4; k <= 4; k++) {
    const nr = r + dr * k;
    const nc = c + dc * k;
    
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
      line.push(2); // Treat wall as opponent/block
    } else if (k === 0) {
      line.push(1); // The candidate move is treated as "My Stone"
    } else if (board[nr][nc] === player) {
      line.push(1);
    } else if (board[nr][nc] === Player.None) {
      line.push(0);
    } else {
      line.push(2); // Opponent
    }
  }

  // Convert array to string for pattern matching: e.g., "011110"
  const str = line.join('');

  // --- Pattern Matching Rules (Order matters!) ---

  // 1. FIVE (Win)
  if (str.includes('11111')) return SCORES.FIVE;

  // 2. LIVE FOUR (011110) - Unstoppable
  if (str.includes('011110')) return SCORES.LIVE_FOUR;

  // 3. SLEEP FOUR / GAP FOUR (Requires immediate block)
  // 11110 (blocked), 01111 (blocked)
  // 10111, 11011, 11101 (Gap 4)
  if (
    str.includes('11110') || str.includes('01111') || 
    str.includes('10111') || str.includes('11011') || str.includes('11101')
  ) {
    return SCORES.SLEEP_FOUR;
  }

  // 4. LIVE THREE (01110) or JUMP THREE (011010)
  // These can become Live 4
  if (str.includes('01110') || str.includes('010110') || str.includes('011010')) {
    return SCORES.LIVE_THREE;
  }

  // 5. SLEEP THREE
  // 001112, 211100, 210110 etc.
  if (
    str.includes('11100') || str.includes('00111') || 
    str.includes('11010') || str.includes('01011') || 
    str.includes('10110') || str.includes('01101')
  ) {
    return SCORES.SLEEP_THREE;
  }

  // 6. LIVE TWO
  if (str.includes('0110') || str.includes('01010') || str.includes('010010')) {
    return SCORES.LIVE_TWO;
  }

  // 7. SLEEP TWO
  if (str.includes('11000') || str.includes('00011')) {
    return SCORES.SLEEP_TWO;
  }

  return 0;
};

// Evaluate the total value of placing a stone at (r, c) for `player`
const evaluatePoint = (board: Player[][], r: number, c: number, player: Player): number => {
  let totalScore = 0;
  for (const [dr, dc] of DIRECTIONS) {
    totalScore += evaluateDirection(board, r, c, dr, dc, player);
  }
  return totalScore;
};

// Evaluate entire board for a player
export const evaluateBoard = (board: Player[][], player: Player): number => {
  let totalScore = 0;
  
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        // Add score for each piece on the board
        totalScore += evaluatePoint(board, r, c, player);
      }
    }
  }
  
  return totalScore;
};

export const getBestMove = (board: Player[][], player: Player): [number, number] | null => {
  const opponent = player === Player.Black ? Player.White : Player.Black;
  let maxScore = -1;
  let bestMoves: [number, number][] = [];

  // Optimization: Only check cells that have neighbors within radius 2
  // This reduces the search space significantly from 225 to ~20-30 in early/mid game.
  const candidates: [number, number][] = [];
  const hasPieces = board.flat().some(p => p !== Player.None);

  // If board is empty, play center
  if (!hasPieces) return [7, 7];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === Player.None) {
        let hasNeighbor = false;
        // Check 2-cell radius for neighbors
        for(let rr = Math.max(0, r-2); rr <= Math.min(BOARD_SIZE-1, r+2); rr++) {
           for(let cc = Math.max(0, c-2); cc <= Math.min(BOARD_SIZE-1, c+2); cc++) {
             if (board[rr][cc] !== Player.None) {
               hasNeighbor = true;
               break;
             }
           }
           if (hasNeighbor) break;
        }
        
        if(hasNeighbor) candidates.push([r,c]);
      }
    }
  }

  // Fallback if no neighbors found (shouldn't happen if !hasPieces handled)
  if (candidates.length === 0) {
     for(let r=0; r<BOARD_SIZE; r++) {
       for(let c=0; c<BOARD_SIZE; c++) {
         if(board[r][c] === Player.None) candidates.push([r,c]);
       }
     }
  }

  // Evaluate each candidate
  for (const [r, c] of candidates) {
    // 1. Attack Score: How good is this move for ME?
    const attackScore = evaluatePoint(board, r, c, player);
    
    // 2. Defense Score: How good is this move for OPPONENT? (How much do I block?)
    const defenseScore = evaluatePoint(board, r, c, opponent);

    // Total Score strategy:
    // We sum them up, but we can weight them.
    // Generally, Attack + Defense is a solid greedy heuristic.
    // If I have a Win (Five), AttackScore will be huge.
    // If Opponent has a Win (Five), DefenseScore will be huge.
    
    // Tiny bias towards Attack to prefer winning over blocking if scores are equal.
    let currentScore = attackScore + defenseScore;
    
    // Critical Tweaks:
    // If I can win immediately, that's the absolute priority.
    if (attackScore >= SCORES.FIVE) currentScore = Infinity;
    // If opponent has a guaranteed win (Live 4) and I don't have a Win, I MUST block.
    // But logic handles this because defenseScore will be ~10,000,000.
    
    if (currentScore > maxScore) {
      maxScore = currentScore;
      bestMoves = [[r, c]];
    } else if (currentScore === maxScore) {
      bestMoves.push([r, c]);
    }
  }

  if (bestMoves.length === 0) return null;
  // Return random move from the best ones to vary gameplay slightly
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
};