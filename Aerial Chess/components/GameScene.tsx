import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, useCursor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BOARD_SIZE, GamePhase, Player } from '../types';
import { COLORS, CORRUPT_DURATION, GRID_SPACING, HOVER_HEIGHT, PIECE_HEIGHT, PIECE_SIZE, TIMING, corruptionEasing } from '../constants';
import { audioManager } from '../services/audioManager';

interface GameSceneProps {
  board: Player[][];
  onCellClick: (row: number, col: number) => void;
  turn: Player;
  phase: GamePhase;
  suggestedMove: [number, number] | null;
  time: number;
  corruptedWhiteCell?: [number, number] | null;
  whiteCorruptStartTimeRef?: { current: number };
  spyglassTarget?: [number, number] | null; // 窥镜显示的目标
  remoteSelectedWhite?: [number, number] | null; // 遥控器选中的白棋位置
}

// Cyberpunk Structure - memoized for performance
const CyberPillar: React.FC<{ position: [number, number, number]; height?: number; color?: string }> = React.memo(({ position, height = 2, color = '#0ea5e9' }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.8, 0.4, 0.8]} />
        <meshStandardMaterial color="#000" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, height / 2 + 0.4, 0]} castShadow>
        <boxGeometry args={[0.4, height, 0.4]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[0.45, 0.1, 0.45]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, height - 0.5, 0]}>
         <boxGeometry args={[0.45, 0.05, 0.45]} />
         <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}, (prevProps, nextProps) => {
  return prevProps.position === nextProps.position &&
         prevProps.height === nextProps.height &&
         prevProps.color === nextProps.color;
});

// Mechanical Piece Component
const MechPiece: React.FC<{ player: Player; position: [number, number, number]; whiteCorruptStartTime?: number }> = React.memo(({ player, position, whiteCorruptStartTime }) => {
  const isWhite = player === Player.White;
  const groupRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const targetY = position[1];
  const startY = targetY + 8;
  const isInitialized = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    if (!isInitialized.current) {
      groupRef.current.position.y = startY;
      groupRef.current.rotation.y = Math.random() * Math.PI;
      groupRef.current.scale.set(0.1, 0.1, 0.1);
      isInitialized.current = true;
    }

    const currentY = groupRef.current.position.y;
    const isSettled = Math.abs(currentY - targetY) < 0.05;
    const bobOffset = isSettled ? Math.sin(t * 2 + position[0]) * 0.05 : 0;
    const effectiveTargetY = targetY + bobOffset;

    if (!isSettled) {
      const pSpeed = 12 * delta;
      groupRef.current.position.y = THREE.MathUtils.lerp(currentY, targetY, pSpeed);
    } else {
      groupRef.current.position.y = effectiveTargetY;
    }

    const currentScale = groupRef.current.scale.x;
    if (Math.abs(currentScale - 1) > 0.01) {
       const sSpeed = 10 * delta;
       const newScale = THREE.MathUtils.lerp(currentScale, 1, sSpeed);
       groupRef.current.scale.set(newScale, newScale, newScale);
    }

    groupRef.current.rotation.y += 0.5 * delta;

    // White piece corruption: White → Black
    if (whiteCorruptStartTime && bodyMatRef.current && ringMatRef.current && lightRef.current) {
      const rawProgress = Math.min(1, (performance.now() - whiteCorruptStartTime) / CORRUPT_DURATION);
      const p = corruptionEasing(rawProgress);
      
      // Reverse the colors: from white/cyan back to black/red
      bodyMatRef.current.color.lerpColors(_C_WHITE_BODY, _C_BLACK_BODY, p);
      bodyMatRef.current.emissive.lerpColors(_C_CYAN, _C_RED, p);
      bodyMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(2.5, 0.2, p);
      bodyMatRef.current.metalness = THREE.MathUtils.lerp(0.1, 0.9, p);
      ringMatRef.current.color.lerpColors(_C_CYAN, _C_RED, p);
      lightRef.current.color.lerpColors(_C_CYAN, _C_RED, p);
      lightRef.current.intensity = THREE.MathUtils.lerp(5.2, 3.8, p);
    }
  });
  
  // Revised Sizes
  // PIECE_SIZE is 0.45.
  const baseSize = PIECE_SIZE; 
  const whiteSize = baseSize * 0.85; // Slightly smaller
  const blackSize = baseSize * 0.95; // Standard size

  return (
    <group ref={groupRef} position={[position[0], startY, position[2]]}>
      {isWhite ? (
        // White Piece: Hologram - Round (optimized segments)
        <group>
           <mesh castShadow position={[0, PIECE_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[whiteSize, whiteSize, PIECE_HEIGHT, 24]} />
            <meshPhysicalMaterial 
              color={COLORS.whitePiece}
              emissive={COLORS.whitePieceEmissive}
              emissiveIntensity={2.8}
              toneMapped={false}
              metalness={0.15}
              roughness={0.1}
              transmission={0.85}
              thickness={1.5}
              transparent={true}
              opacity={0.85}
            />
          </mesh>
          <mesh position={[0, PIECE_HEIGHT/2, 0]}>
             <sphereGeometry args={[whiteSize * 0.4, 12, 12]} />
             <meshBasicMaterial color={COLORS.whitePieceEmissive} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0.5, 0]} distance={3} intensity={5.2} color={COLORS.whitePieceEmissive} decay={2} />
        </group>
      ) : (
        // Black Piece: Red Neon Core - designed for smooth color transition
        <group>
          <mesh castShadow receiveShadow position={[0, PIECE_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[blackSize, blackSize, PIECE_HEIGHT, 24]} />
            <meshStandardMaterial 
              ref={bodyMatRef}
              color="#0a0a0a"
              metalness={0.9}
              roughness={0.15}
              emissive="#1a0a0a"
            />
          </mesh>
          <mesh position={[0, PIECE_HEIGHT + 0.01, 0]} rotation={[-Math.PI/2, 0, 0]}>
             {/* Circular Stripe: 24 segments (reduced from 32) */}
             <ringGeometry args={[blackSize * 0.5, blackSize * 0.8, 24]} />
             <meshBasicMaterial ref={ringMatRef} color={COLORS.blackPieceEmissive} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <pointLight ref={lightRef} position={[0, 0.5, 0]} distance={3} intensity={3.8} color={COLORS.blackPieceEmissive} decay={2} />
        </group>
      )}
    </group>
  );
});

// Module-level color constants to avoid per-frame allocations
const _C_BLACK_BODY = new THREE.Color('#0a0a0a');  // Slightly lighter black for subtle transition
const _C_WHITE_BODY = new THREE.Color(COLORS.whitePiece);
const _C_RED       = new THREE.Color(COLORS.blackPieceEmissive);
const _C_CYAN      = new THREE.Color(COLORS.whitePieceEmissive);

const STAR_POINTS = [
  [3, 3], [3, 11],
  [7, 7],
  [11, 3], [11, 11]
];

export const GameScene: React.FC<GameSceneProps> = ({ board, onCellClick, turn, phase, suggestedMove, time, corruptedWhiteCell, whiteCorruptStartTimeRef, spyglassTarget, remoteSelectedWhite }) => {
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const controlsRef = useRef<any>(null);

  useCursor(!!hoveredCell, 'pointer', 'auto');

  const boardWidth = BOARD_SIZE * GRID_SPACING;
  const offset = (boardWidth - GRID_SPACING) / 2;

  // Static Grid Lines - memoized for performance
  const gridLines = useMemo(() => {
    const lines = [];
    const fullSize = boardWidth;
    const thickness = 0.02;

    for (let i = 0; i < BOARD_SIZE; i++) {
      const pos = i * GRID_SPACING - offset;
      lines.push(
        <mesh key={`v-${i}`} position={[pos, 0.01, 0]} receiveShadow={false}>
          <boxGeometry args={[thickness, 0.01, fullSize]} />
          <meshBasicMaterial color={COLORS.boardGrid} toneMapped={false} />
        </mesh>
      );
      lines.push(
        <mesh key={`h-${i}`} position={[0, 0.01, pos]} receiveShadow={false}>
          <boxGeometry args={[fullSize, 0.01, thickness]} />
          <meshBasicMaterial color={COLORS.boardGrid} toneMapped={false} />
        </mesh>
      );
    }
    return lines;
  }, [boardWidth, offset]);

  const handlePointerMove = (e: any) => {
    if (phase === GamePhase.Ended || (turn === Player.White && phase !== GamePhase.Phase2b)) {
      if (hoveredCell !== null) setHoveredCell(null);
      return;
    }
    
    const x = e.point.x + offset;
    const z = e.point.z + offset;
    
    let c = Math.round(x / GRID_SPACING);
    let r = Math.round(z / GRID_SPACING);

    // Magnetic Attraction Logic
        if (suggestedMove && phase === GamePhase.Phase2a) {
            const [sr, sc] = suggestedMove;
            
            // Calculate dynamic radius based on time in phase
            const startTime = TIMING.PHASE_1_DURATION;
            const elapsed = Math.max(0, time - startTime);
            const progress = Math.min(1, elapsed / TIMING.PHASE_2A_DURATION);
            
            // Start very weak (0.5 cells) -> End weak (2 cells) - Minimal influence
            const radius = THREE.MathUtils.lerp(0.5, 2, progress);
            const radiusSq = radius * radius;

            const dx = r - sr;
            const dy = c - sc;
            
            // If within the small radius, snap to suggested move
            if ((dx * dx + dy * dy) < radiusSq) {
                r = sr;
                c = sc;
            }
        }

    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      if (board[r][c] === Player.None) {
        if (!hoveredCell || hoveredCell[0] !== r || hoveredCell[1] !== c) {
            setHoveredCell([r, c]);
            // Trigger hover sound only when cell changes
            audioManager.playHover();
        }
      } else {
        if (hoveredCell !== null) setHoveredCell(null);
      }
    } else {
      if (hoveredCell !== null) setHoveredCell(null);
    }
  };

  const handleClick = (e: any) => {
    if (e.button !== 0) return;
    if (phase === GamePhase.Phase2b && turn === Player.Black) return; 
    
    // 计算点击位置对应的棋盘坐标
    const x = e.point.x + offset;
    const z = e.point.z + offset;
    
    let c = Math.round(x / GRID_SPACING);
    let r = Math.round(z / GRID_SPACING);
    
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      onCellClick(r, c);
    }
  };

  const pieces = useMemo(() => {
    const p: React.ReactElement[] = [];
    for(let r=0; r<BOARD_SIZE; r++){
        for(let c=0; c<BOARD_SIZE; c++){
            if(board[r][c] !== Player.None){
                const x = c * GRID_SPACING - offset;
                const z = r * GRID_SPACING - offset;
                
                // Check if this white piece is being corrupted to black
                const isWhiteCorrupted = corruptedWhiteCell && corruptedWhiteCell[0] === r && corruptedWhiteCell[1] === c;
                const whiteCorruptStartTime = isWhiteCorrupted && whiteCorruptStartTimeRef ? whiteCorruptStartTimeRef.current : undefined;
                
                // Raised y-position to 0.4 to create a floating effect with a visible gap
                p.push(<MechPiece key={`${r}-${c}`} player={board[r][c]} position={[x, 0.4, z]} whiteCorruptStartTime={whiteCorruptStartTime} />);
            }
        }
    }
    return p;
  }, [board, offset, corruptedWhiteCell, whiteCorruptStartTimeRef]);

  return (
    <>
      <OrthographicCamera 
        makeDefault 
        position={[20, 20, 20]} 
        zoom={35} 
        near={-50} 
        far={200}
        onUpdate={c => c.lookAt(0, 0, 0)}
      />
      
      <OrbitControls 
        ref={controlsRef}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN, 
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        }}
        enableZoom={true}
        enablePan={true}
        enableDamping={true} 
        dampingFactor={0.05}
        minZoom={20}
        maxZoom={100}
      />

      {/* Lighting - Optimized for performance */}
      <ambientLight intensity={0.05} color="#000" /> 
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={0.4} 
        castShadow 
        color="#00ffff"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      
      {/* Background */}
      <color attach="background" args={[COLORS.background]} />
      <fog attach="fog" args={[COLORS.background, 30, 80]} />

      <group>
        {/* Board Base */}
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <boxGeometry args={[boardWidth + 1, 1, boardWidth + 1]} />
          <meshStandardMaterial 
            color="#050505" 
            metalness={0.8} 
            roughness={0.4} 
          />
        </mesh>
        
        {/* Glowing Board Border */}
        <mesh position={[0, -0.1, 0]}>
           <boxGeometry args={[boardWidth + 1.1, 0.25, boardWidth + 1.1]} />
           <meshBasicMaterial color={COLORS.boardGrid} transparent opacity={0.3} toneMapped={false} />
        </mesh>

        {/* Static Grid & Stars */}
        <group position={[0, 0, 0]}>
          {gridLines}
          {STAR_POINTS.map(([r, c], i) => (
             <mesh key={`star-${i}`} position={[c * GRID_SPACING - offset, 0.03, r * GRID_SPACING - offset]} rotation={[-Math.PI/2, 0, 0]}>
                <circleGeometry args={[0.12, 12]} />
                <meshBasicMaterial color={COLORS.boardGrid} toneMapped={false} />
             </mesh>
          ))}
        </group>

        {/* Floor */}
        <mesh position={[0, -2, 0]} receiveShadow rotation={[-Math.PI/2, 0, 0]}>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#000" metalness={0.9} roughness={0.1} />
        </mesh>
        <gridHelper args={[100, 40, '#222', '#111']} position={[0, -1.9, 0]} />

        {/* Pillars */}
        <CyberPillar position={[-10, -1.5, -10]} height={3} />
        <CyberPillar position={[10, -1.5, -10]} height={3} />
        <CyberPillar position={[-10, -1.5, 10]} height={3} />
        <CyberPillar position={[10, -1.5, 10]} height={3} />
        <CyberPillar position={[-14, -1.5, 0]} height={3.5} />
        <CyberPillar position={[14, -1.5, 0]} height={3.5} />
        <CyberPillar position={[0, -1.5, -14]} height={3.5} />
        <CyberPillar position={[0, -1.5, 14]} height={3.5} />
        
        {/* Interaction Plane */}
        <mesh 
          position={[0, 0.1, 0]} 
          rotation={[-Math.PI / 2, 0, 0]} 
          visible={false}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredCell(null)}
          onClick={handleClick}
        >
          <planeGeometry args={[boardWidth, boardWidth]} />
        </mesh>

        {pieces}

        {/* Hover/Ghost Piece */}
        {hoveredCell && phase !== GamePhase.Phase2b && (
           <group position={[
             hoveredCell[1] * GRID_SPACING - offset, 
             HOVER_HEIGHT, 
             hoveredCell[0] * GRID_SPACING - offset
           ]}>
             <mesh rotation={[-Math.PI/2, 0, 0]}>
               <ringGeometry args={[PIECE_SIZE * 0.8, PIECE_SIZE, 32]} />
               <meshBasicMaterial 
                 color={COLORS.highlight} 
                 toneMapped={false}
                 transparent 
                 opacity={0.8}
                 side={THREE.DoubleSide}
               />
             </mesh>
             {phase === GamePhase.Phase2a && (
                <group position={[0, 1, 0]}>
                   <mesh>
                      <octahedronGeometry args={[0.3, 0]} />
                      <meshBasicMaterial color={COLORS.highlight} wireframe toneMapped={false} />
                   </mesh>
                </group>
             )}
           </group>
        )}

        {/* Suggested Move Glow - Enhanced for Phase 2a */}
        {suggestedMove && phase === GamePhase.Phase2a && (
          <group position={[
            suggestedMove[1] * GRID_SPACING - offset,
            0.05,
            suggestedMove[0] * GRID_SPACING - offset
          ]}>
            {/* Pulsing outer ring */}
            <mesh rotation={[-Math.PI/2, 0, 0]}>
              <ringGeometry args={[PIECE_SIZE * 1.2, PIECE_SIZE * 1.5, 32]} />
              <meshBasicMaterial
                color="#00ffff"
                toneMapped={false}
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Inner glow ring */}
            <mesh rotation={[-Math.PI/2, 0, 0]}>
              <ringGeometry args={[PIECE_SIZE * 0.9, PIECE_SIZE * 1.1, 24]} />
              <meshBasicMaterial
                color="#00ffff"
                toneMapped={false}
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Central indicator */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.2, 8]} />
              <meshBasicMaterial
                color="#00ffff"
                toneMapped={false}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Floating particles around suggestion */}
            {Array.from({ length: 6 }, (_, i) => (
              <mesh
                key={i}
                position={[
                  Math.cos((i / 6) * Math.PI * 2) * PIECE_SIZE * 1.8,
                  0.3 + Math.sin(time * 2 + i) * 0.1,
                  Math.sin((i / 6) * Math.PI * 2) * PIECE_SIZE * 1.8
                ]}
              >
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial
                  color="#00ffff"
                  toneMapped={false}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            ))}
          </group>
        )}
        
        {/* 窥镜效果 - 显示AI下一步落点的白棋虚影 */}
        {spyglassTarget && (
          <group position={[
            spyglassTarget[1] * GRID_SPACING - offset,
            0.5,
            spyglassTarget[0] * GRID_SPACING - offset
          ]}>
            {/* 白棋虚影 */}
            <mesh position={[0, PIECE_HEIGHT / 2, 0]}>
              <cylinderGeometry args={[PIECE_SIZE * 0.85, PIECE_SIZE * 0.85, PIECE_HEIGHT, 24]} />
              <meshPhysicalMaterial 
                color={COLORS.whitePiece}
                emissive={COLORS.whitePieceEmissive}
                emissiveIntensity={1.5}
                toneMapped={false}
                metalness={0.15}
                roughness={0.1}
                transmission={0.6}
                thickness={1.5}
                transparent={true}
                opacity={0.4}
              />
            </mesh>
            {/* 脉冲光环 */}
            <mesh rotation={[-Math.PI/2, 0, 0]}>
              <ringGeometry args={[PIECE_SIZE * 1.1, PIECE_SIZE * 1.4, 32]} />
              <meshBasicMaterial
                color="#ff00ff"
                toneMapped={false}
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* 标签 */}
            <mesh position={[0, 1.2, 0]}>
              <planeGeometry args={[1.5, 0.4]} />
              <meshBasicMaterial color="#000" transparent opacity={0.7} />
            </mesh>
          </group>
        )}
        
        {/* 遥控器选中白棋效果 */}
        {remoteSelectedWhite && (
          <group position={[
            remoteSelectedWhite[1] * GRID_SPACING - offset,
            0.5,
            remoteSelectedWhite[0] * GRID_SPACING - offset
          ]}>
            {/* 粉色光框 */}
            <mesh rotation={[-Math.PI/2, 0, 0]}>
              <ringGeometry args={[PIECE_SIZE * 1.2, PIECE_SIZE * 1.5, 32]} />
              <meshBasicMaterial
                color="#ff00ff"
                toneMapped={false}
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* 粉色脉冲效果 */}
            <mesh rotation={[-Math.PI/2, 0, 0]}>
              <ringGeometry args={[PIECE_SIZE * 1.6, PIECE_SIZE * 1.8, 32]} />
              <meshBasicMaterial
                color="#ff00ff"
                toneMapped={false}
                transparent
                opacity={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Post Processing - Optimized for performance */}
      <EffectComposer enableNormalPass={false}>
        <Bloom 
            luminanceThreshold={1.2} 
            mipmapBlur 
            intensity={1.2} 
            radius={0.4}
        />
        <Noise opacity={0.02} />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
};