import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Html, Text } from '@react-three/drei';
import * as THREE from 'three';

const MAP_W = 100;
const WALL_HEIGHT = 6;
const PLAYER_RADIUS = 1.2;
const BASE_REQUIRED_SCORE = 10;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectContains(rect, x, z, margin = 0) {
  return (
    x > rect.x - rect.w / 2 - margin &&
    x < rect.x + rect.w / 2 + margin &&
    z > rect.z - rect.d / 2 - margin &&
    z < rect.z + rect.d / 2 + margin
  );
}

function isProbablyMobileDevice() {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth < 900
  );
}

function getLevelConfig(level) {
  return {
    level,
    requiredScore: BASE_REQUIRED_SCORE + (level - 1) * 3,
    enemyMax: Math.min(4 + level * 2, 20),
    enemySpawnSeconds: Math.max(7 - level * 0.45, 2.2),
    enemySpeedIdle: 3.4 + level * 0.25,
    enemySpeedAlert: 5.2 + level * 0.55,
    attackRange: 2.8 + (level - 1) * 1.15,
    attackCooldown: Math.max(0.6 - (level - 1) * 0.03, 0.28),
    shieldSpawnCount: level >= 3 ? Math.min(1 + Math.floor((level - 3) / 2), 4) : 0,
  };
}

const EXIT_ZONE = { x: 40, z: 44.5, w: 12, d: 7 };

// apertura vera nel muro in alto a destra
const WALLS = [
  { x: 0, z: -48, w: 96, d: 4 },
  { x: -48, z: 0, w: 4, d: 96 },
  { x: 48, z: 0, w: 4, d: 96 },

  { x: -10, z: 48, w: 70, d: 4 },
  { x: 34, z: 48, w: 16, d: 4 },

  { x: -18, z: 0, w: 4, d: 58 },
  { x: 16, z: -8, w: 4, d: 72 },
  { x: 0, z: 18, w: 52, d: 4 },
  { x: 18, z: -24, w: 42, d: 4 },
  { x: -26, z: -22, w: 24, d: 4 },
  { x: -30, z: 22, w: 18, d: 4 },
  { x: 32, z: 24, w: 24, d: 4 },
  { x: -4, z: -38, w: 26, d: 4 },
];

function collidesWithWalls(x, z) {
  return WALLS.some((wall) => rectContains(wall, x, z, PLAYER_RADIUS));
}

function randomFreeSpot() {
  for (let i = 0; i < 500; i++) {
    const x = THREE.MathUtils.randFloatSpread(80);
    const z = THREE.MathUtils.randFloatSpread(80);

    const blocked =
      collidesWithWalls(x, z) ||
      rectContains(EXIT_ZONE, x, z, 5) ||
      rectContains({ x: 0, z: 0, w: 20, d: 12 }, x, z, 2);

    if (!blocked) return { x, z };
  }
  return { x: 0, z: 0 };
}

function findSpawnNearPlayer(playerX, playerZ) {
  let chosen = randomFreeSpot();

  for (let i = 0; i < 25; i++) {
    const candidate = randomFreeSpot();
    const dist = Math.hypot(candidate.x - playerX, candidate.z - playerZ);
    if (dist > 10 && dist < 26) {
      chosen = candidate;
      break;
    }
  }

  return chosen;
}

function Ground() {
  const tiles = [];
  for (let x = -50; x < 50; x += 5) {
    for (let z = -50; z < 50; z += 5) {
      const isWhite = (Math.floor((x + 50) / 5) + Math.floor((z + 50) / 5)) % 2 === 0;
      tiles.push(
        <mesh
          key={`${x}-${z}`}
          position={[x + 2.5, 0, z + 2.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[5, 5]} />
          <meshStandardMaterial color={isWhite ? '#f0f0ea' : '#0f1014'} />
        </mesh>
      );
    }
  }

  return (
    <group>
      {tiles}
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color="#111" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function CeilingLights() {
  const lights = [
    [-25, 5.8, -25],
    [0, 5.8, -25],
    [25, 5.8, -25],
    [-25, 5.8, 5],
    [0, 5.8, 5],
    [25, 5.8, 5],
    [-25, 5.8, 35],
    [0, 5.8, 35],
    [25, 5.8, 35],
  ];

  return (
    <group>
      {lights.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[8, 4]} />
            <meshBasicMaterial color="#ffd89c" />
          </mesh>
          <pointLight intensity={1.2} distance={26} color="#ffd89c" />
        </group>
      ))}
    </group>
  );
}

function Walls({ canExit }) {
  const zoneMatRef = useRef();
  const glowLightRef = useRef();

  useFrame((state) => {
    if (!canExit) return;
    const wave = (Math.sin(state.clock.elapsedTime * 6) + 1) / 2;
    if (zoneMatRef.current) zoneMatRef.current.opacity = 0.35 + wave * 0.3;
    if (glowLightRef.current) glowLightRef.current.intensity = 1.8 + wave * 1.5;
  });

  return (
    <group>
      {WALLS.map((wall, i) => (
        <mesh key={i} position={[wall.x, WALL_HEIGHT / 2, wall.z]} castShadow receiveShadow>
          <boxGeometry args={[wall.w, WALL_HEIGHT, wall.d]} />
          <meshStandardMaterial color={i % 2 ? '#20232a' : '#2a2d34'} />
        </mesh>
      ))}

      {/* stripe walls decorative */}
      <mesh position={[0, 2.5, -46]}>
        <boxGeometry args={[88, 2, 0.4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.1, -46]}>
        <boxGeometry args={[88, 0.9, 0.5]} />
        <meshStandardMaterial color="#0d0d10" />
      </mesh>

      <mesh position={[-46, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[88, 2, 0.4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-46, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[88, 0.9, 0.5]} />
        <meshStandardMaterial color="#0d0d10" />
      </mesh>

      <mesh position={[46, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[88, 2, 0.4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[46, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[88, 0.9, 0.5]} />
        <meshStandardMaterial color="#0d0d10" />
      </mesh>

      <mesh position={[EXIT_ZONE.x, 0.05, EXIT_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[EXIT_ZONE.w, EXIT_ZONE.d]} />
        <meshBasicMaterial
          ref={zoneMatRef}
          color={canExit ? '#56e17f' : '#7a2020'}
          transparent
          opacity={canExit ? 0.55 : 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {canExit && (
        <>
          <pointLight
            ref={glowLightRef}
            position={[EXIT_ZONE.x, 3.5, EXIT_ZONE.z]}
            intensity={2.2}
            distance={18}
            color="#56e17f"
          />
          <Text
            position={[EXIT_ZONE.x, 5.7, EXIT_ZONE.z]}
            fontSize={1.45}
            color="#8fffaa"
            anchorX="center"
            anchorY="middle"
          >
            EXIT OPEN
          </Text>
        </>
      )}
    </group>
  );
}

function KitchenInspiredScene() {
  const cakes = [
    [-6, 1.4, -1],
    [0, 1.4, -1],
    [6, 1.4, -1],
    [-6, 1.4, 4],
    [0, 1.4, 4],
    [6, 1.4, 4],
  ];

  const displaySides = [
    [-36, 1.4, -4, 0],
    [36, 1.4, -4, 0],
    [-36, 1.4, 18, 0],
    [36, 1.4, 18, 0],
  ];

  return (
    <group>
      {/* central island */}
      <mesh position={[0, 0.75, 2]} castShadow receiveShadow>
        <boxGeometry args={[18, 1.5, 10]} />
        <meshStandardMaterial color="#8e8e8e" />
      </mesh>

      {/* top extractor-like block */}
      <mesh position={[0, 4.8, 2]}>
        <boxGeometry args={[14, 2, 8]} />
        <meshStandardMaterial color="#9e9e9e" />
      </mesh>

      {/* rear stage / curtains */}
      <mesh position={[0, 1.3, -41]} castShadow receiveShadow>
        <boxGeometry args={[22, 2.6, 6]} />
        <meshStandardMaterial color="#6a4a2d" />
      </mesh>
      <mesh position={[-4, 3.2, -43.8]}>
        <boxGeometry args={[2.8, 4.2, 0.35]} />
        <meshStandardMaterial color="#3d214b" />
      </mesh>
      <mesh position={[0, 3.2, -43.8]}>
        <boxGeometry args={[2.8, 4.2, 0.35]} />
        <meshStandardMaterial color="#24182d" />
      </mesh>
      <mesh position={[4, 3.2, -43.8]}>
        <boxGeometry args={[2.8, 4.2, 0.35]} />
        <meshStandardMaterial color="#3d214b" />
      </mesh>

      {/* side counters */}
      {displaySides.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[10, 2.2, 4]} />
            <meshStandardMaterial color="#f2f2f2" />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[10.2, 0.4, 4.2]} />
            <meshStandardMaterial color="#6a5137" />
          </mesh>
        </group>
      ))}

      {/* cakes / treasures decoration */}
      {cakes.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[1.15, 1.15, 0.6, 16]} />
            <meshStandardMaterial color="#a9582a" />
          </mesh>
          <mesh position={[0, 0.33, 0]}>
            <cylinderGeometry args={[1.12, 1.12, 0.18, 16]} />
            <meshStandardMaterial color="#f6f1ea" />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshStandardMaterial color="#d12c2c" />
          </mesh>
        </group>
      ))}

      <Text position={[0, 5.6, -40.8]} fontSize={1.9} color="#ffd36d">
        SNAF PIZZERIA
      </Text>
    </group>
  );
}

function Pickup({ item }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y += state.clock.getDelta() * 1.5;
    ref.current.position.y = 1.05 + Math.sin(state.clock.elapsedTime * 2 + item.id) * 0.18;
  });

  if (item.collected) return null;

  const color =
    item.value === 3 ? '#8a5cff' :
    item.value === 2 ? '#44d6ff' :
    '#ffd84d';

  const emissive =
    item.value === 3 ? '#35107a' :
    item.value === 2 ? '#0b5670' :
    '#b87900';

  const size =
    item.value === 3 ? 1.0 :
    item.value === 2 ? 0.82 :
    0.7;

  return (
    <group ref={ref} position={[item.x, 1.1, item.z]}>
      <mesh castShadow>
        <octahedronGeometry args={[size, 0]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.2} />
      </mesh>
      <pointLight intensity={0.9} distance={5} color={color} />
      <Text position={[0, 1.1, 0]} fontSize={0.48} color="white" anchorX="center" anchorY="middle">
        +{item.value}
      </Text>
    </group>
  );
}

function ShieldPickup({ item }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y += state.clock.getDelta() * 1.9;
    ref.current.position.y = 1.25 + Math.sin(state.clock.elapsedTime * 2 + item.id) * 0.16;
  });

  if (item.collected) return null;

  return (
    <group ref={ref} position={[item.x, 1.2, item.z]}>
      <mesh>
        <cylinderGeometry args={[0.9, 0.9, 0.2, 20]} />
        <meshStandardMaterial color="#66b8ff" emissive="#17456a" emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <ringGeometry args={[0.2, 0.52, 18]} />
        <meshBasicMaterial color="#d4f0ff" side={THREE.DoubleSide} />
      </mesh>
      <pointLight intensity={0.9} distance={5} color="#66b8ff" />
      <Text position={[0, 1.0, 0]} fontSize={0.42} color="white" anchorX="center" anchorY="middle">
        SHIELD
      </Text>
    </group>
  );
}

function Enemy({ enemy }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.set(enemy.x, 1.85, enemy.z);
    ref.current.rotation.y = enemy.rotation;
    ref.current.position.y += Math.sin(state.clock.elapsedTime * 4 + enemy.phase) * 0.08;
  });

  const baseColor =
    enemy.variant === 1 ? '#7e5fff' :
    enemy.variant === 2 ? '#e4a04a' :
    '#c79b6a';

  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <boxGeometry args={[1.6, 2.2, 1.2]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
      <mesh castShadow position={[0, 2.8, 0]}>
        <boxGeometry args={[1.35, 1.25, 1.1]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      <mesh position={[-0.38, 3.55, 0]}>
        <boxGeometry args={[0.34, 0.7, 0.26]} />
        <meshBasicMaterial color="#7a4f1d" />
      </mesh>
      <mesh position={[0.38, 3.55, 0]}>
        <boxGeometry args={[0.34, 0.7, 0.26]} />
        <meshBasicMaterial color="#7a4f1d" />
      </mesh>

      <mesh position={[-0.26, 2.95, 0.58]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial color="#ff3b3b" />
      </mesh>
      <mesh position={[0.26, 2.95, 0.58]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial color="#ff3b3b" />
      </mesh>

      <mesh position={[-1.05, 1.55, 0]}>
        <boxGeometry args={[0.35, 1.4, 0.35]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
      <mesh position={[1.05, 1.55, 0]}>
        <boxGeometry args={[0.35, 1.4, 0.35]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      <mesh position={[-0.4, 0.2, 0]}>
        <boxGeometry args={[0.42, 1.4, 0.42]} />
        <meshBasicMaterial color="#6b4120" />
      </mesh>
      <mesh position={[0.4, 0.2, 0]}>
        <boxGeometry args={[0.42, 1.4, 0.42]} />
        <meshBasicMaterial color="#6b4120" />
      </mesh>

      <pointLight intensity={2.2} distance={8} color="#ff5c5c" />
    </group>
  );
}

function EnemyLabels({ enemies, player }) {
  return (
    <>
      {enemies.map((enemy) => {
        const dist = Math.hypot(player.x - enemy.x, player.z - enemy.z);
        if (dist > 14) return null;

        return (
          <Text
            key={`enemy-label-${enemy.id}`}
            position={[enemy.x, 4.9, enemy.z]}
            fontSize={0.8}
            color="#ff7a7a"
            anchorX="center"
            anchorY="middle"
          >
            {dist < 4 ? 'MOSTRO!' : 'Nemico'}
          </Text>
        );
      })}
    </>
  );
}

function Minimap({ player, pickups, shields, enemies, isMobile }) {
  const size = isMobile ? 132 : 180;
  const scale = size / MAP_W;

  return (
    <div
      style={{
        position: 'absolute',
        right: isMobile ? 10 : 16,
        top: isMobile ? 10 : 16,
        width: size,
        height: size,
        background: 'rgba(0,0,0,0.72)',
        border: '2px solid #ffffff33',
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {WALLS.map((w, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: size / 2 + (w.x - w.w / 2) * scale,
            top: size / 2 + (w.z - w.d / 2) * scale,
            width: w.w * scale,
            height: w.d * scale,
            background: '#8f2a2a',
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: size / 2 + (EXIT_ZONE.x - EXIT_ZONE.w / 2) * scale,
          top: size / 2 + (EXIT_ZONE.z - EXIT_ZONE.d / 2) * scale,
          width: EXIT_ZONE.w * scale,
          height: EXIT_ZONE.d * scale,
          border: '2px solid #56e17f',
          background: 'rgba(86,225,127,0.25)',
        }}
      />

      {pickups.filter((p) => !p.collected).map((p) => {
        const color =
          p.value === 3 ? '#8a5cff' :
          p.value === 2 ? '#44d6ff' :
          '#ffd84d';

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              width: 6 + p.value,
              height: 6 + p.value,
              borderRadius: 999,
              left: size / 2 + p.x * scale - (3 + p.value / 2),
              top: size / 2 + p.z * scale - (3 + p.value / 2),
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        );
      })}

      {shields.filter((s) => !s.collected).map((s) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 999,
            left: size / 2 + s.x * scale - 5,
            top: size / 2 + s.z * scale - 5,
            background: '#66b8ff',
            boxShadow: '0 0 10px #66b8ff',
          }}
        />
      ))}

      {enemies.map((e) => (
        <div
          key={e.id}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: 999,
            left: size / 2 + e.x * scale - 4,
            top: size / 2 + e.z * scale - 4,
            background: '#ff5c5c',
            boxShadow: '0 0 10px #ff5c5c',
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: 999,
          left: size / 2 + player.x * scale - 5,
          top: size / 2 + player.z * scale - 5,
          background: '#67b7ff',
          boxShadow: '0 0 8px #67b7ff',
        }}
      />
    </div>
  );
}

function HandsAndWeapon({ camera, level, attackAnimRef }) {
  const groupRef = useRef();
  const leftHandRef = useRef();
  const rightHandRef = useRef();
  const weaponRef = useRef();

  useEffect(() => {
    const group = new THREE.Group();

    const leftHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.35),
      new THREE.MeshStandardMaterial({ color: '#f1c27d' })
    );

    const rightHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.35),
      new THREE.MeshStandardMaterial({ color: '#f1c27d' })
    );

    let weapon = null;
    if (level >= 2) {
      weapon = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.9 + (level - 2) * 0.4),
        new THREE.MeshStandardMaterial({ color: level >= 5 ? '#9fd7ff' : '#8f6a45' })
      );
      group.add(weapon);
    }

    group.add(new THREE.AmbientLight(0xffffff, 1.4));
    group.add(leftHand);
    group.add(rightHand);

    camera.add(group);

    groupRef.current = group;
    leftHandRef.current = leftHand;
    rightHandRef.current = rightHand;
    weaponRef.current = weapon;

    return () => {
      camera.remove(group);
    };
  }, [camera, level]);

  useFrame(() => {
    const left = leftHandRef.current;
    const right = rightHandRef.current;
    if (!left || !right) return;

    const t = attackAnimRef.current;
    const punch = Math.sin(Math.min(1, t) * Math.PI) * 0.42;
    const sway = Math.sin(Math.min(1, t) * Math.PI) * 0.08;

    left.position.set(-0.38 + sway, -0.33, -0.62 - punch * 0.55);
    right.position.set(0.38 - sway, -0.35, -0.58 - punch);

    left.rotation.set(-0.45, 0.35, 0.15 + punch * 0.3);
    right.rotation.set(-0.5, -0.35, -0.12 - punch * 0.4);

    if (weaponRef.current) {
      weaponRef.current.position.set(0.47, -0.36, -1.02 - punch * 0.9);
      weaponRef.current.rotation.set(-0.3, -0.15, -0.2 - punch * 0.1);
    }
  });

  return null;
}

function HUD({ game, onRestart, onNextLevel, isMobile, gyroEnabled, canExit }) {
  const levelCfg = getLevelConfig(game.level);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          color: 'white',
          fontFamily: 'sans-serif',
          zIndex: 20,
          maxWidth: isMobile ? '58vw' : 'none',
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800 }}>{game.name || 'Player'}</div>
        <div>Livello: {game.level}</div>
        <div>Punti: {game.score} / {levelCfg.requiredScore}</div>
        <div>Mostri attivi: {game.enemies.length}</div>
        <div>Vita: {game.health}</div>
        <div>Scudi: {game.shieldsCount}</div>
        <div>Portata arma: {levelCfg.attackRange.toFixed(1)}</div>
        <div style={{ opacity: 0.85, marginTop: 8 }}>
          {isMobile
            ? `Pulsanti muovono • trascina a destra per guardare • pugno • gyro ${gyroEnabled ? 'ON' : 'OFF'}`
            : 'WASD muovi • mouse guarda • F attacca'}
        </div>
        <div style={{ marginTop: 8, color: canExit ? '#8fffaa' : '#ffd3a1', fontWeight: 700 }}>
          {canExit ? 'Uscita aperta: entra nella zona verde' : 'Raccogli abbastanza punti per aprire l’uscita'}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.88 }}>
          Tesori: giallo +1 • azzurro +2 • viola +3
        </div>
      </div>

      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 20,
            transform: 'translateX(-50%)',
            color: 'white',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <div style={{ fontSize: 28 }}>+</div>
        </div>
      )}

      {game.status === 'levelComplete' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: 24,
            zIndex: 60,
          }}
        >
          <div>
            <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 10 }}>
              LIVELLO {game.level} COMPLETATO
            </div>
            <div style={{ lineHeight: 1.5, maxWidth: 640 }}>
              Passi al livello {game.level + 1}. I mostri saranno più numerosi e veloci.
              La tua arma guadagnerà più portata.
              {game.level + 1 >= 3 ? ' Dal prossimo livello potranno comparire anche gli scudi.' : ''}
            </div>
            <button
              onClick={onNextLevel}
              style={{
                marginTop: 18,
                padding: '12px 18px',
                background: '#ffffff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Vai al livello successivo
            </button>
          </div>
        </div>
      )}

      {game.status === 'lost' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: 24,
            zIndex: 60,
          }}
        >
          <div>
            <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 12 }}>
              TI HANNO PRESO!
            </div>
            <div style={{ maxWidth: 640, lineHeight: 1.5 }}>
              Sei arrivato al livello {game.level}.
            </div>
            <button
              onClick={onRestart}
              style={{
                marginTop: 18,
                padding: '12px 18px',
                background: '#ffffff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Rigioca dal livello 1
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Intro({ onStart, isMobile }) {
  const [name, setName] = useState('');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at top, #3c1d1d, #111)',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: '100%',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid #ffffff20',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 40 }}>SNAF Pizzeria Escape</h1>
        <p>
          Scappa dalla pizzeria, raccogli tesori, sopravvivi ai mostri e supera livelli sempre più difficili.
        </p>
        <p>
          A ogni livello aumentano velocità e numero dei mostri. Dalla seconda arena ottieni un’arma più lunga.
          Dal terzo livello possono apparire anche gli scudi.
        </p>
        {isMobile && (
          <p style={{ color: '#cfe7ff' }}>
            Su mobile: pulsantiera in basso a sinistra, attacco a destra, visuale laterale trascinando a destra.
          </p>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Inserisci il tuo nome"
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 12, fontSize: 16 }}
        />
        <button
          onClick={() => onStart(name.trim() || 'Player')}
          style={{ marginTop: 14, padding: '14px 18px', borderRadius: 12, border: 'none', fontWeight: 800, cursor: 'pointer' }}
        >
          Entra nella pizzeria
        </button>
      </div>
    </div>
  );
}

function CameraRig({ playerRef, isMobile, yawRef, level, attackAnimRef }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!playerRef.current) return;
    camera.position.copy(playerRef.current.position);

    if (isMobile) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yawRef.current;
      camera.rotation.x = 0;
      camera.rotation.z = 0;
    }

    if (attackAnimRef.current > 0) {
      attackAnimRef.current = Math.max(0, attackAnimRef.current - delta * 3.2);
    }
  });

  return (
    <>
      {isMobile ? null : <PointerLockControls />}
      <HandsAndWeapon camera={camera} level={level} attackAnimRef={attackAnimRef} />
    </>
  );
}

function MobileControls({ mobileInputRef, gyroEnabled, onRequestGyro }) {
  const lookPadRef = useRef({ active: false, touchId: null, lastX: 0 });

  const setDir = (key, value) => {
    mobileInputRef.current[key] = value;
  };

  const handleLookStart = (e) => {
    if (gyroEnabled) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    lookPadRef.current.active = true;
    lookPadRef.current.touchId = touch.identifier;
    lookPadRef.current.lastX = touch.clientX;
  };

  const handleLookMove = (e) => {
    if (gyroEnabled || !lookPadRef.current.active) return;
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === lookPadRef.current.touchId);
    if (!touch) return;
    const dx = touch.clientX - lookPadRef.current.lastX;
    mobileInputRef.current.lookDeltaX += dx;
    lookPadRef.current.lastX = touch.clientX;
  };

  const handleLookEnd = (e) => {
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === lookPadRef.current.touchId);
    if (!touch) return;
    lookPadRef.current.active = false;
    lookPadRef.current.touchId = null;
  };

  const padButtonStyle = {
    width: 54,
    height: 54,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.12)',
    color: 'white',
    fontSize: 22,
    fontWeight: 700,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 14,
          width: 180,
          height: 180,
          borderRadius: 18,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 25,
          touchAction: 'none',
        }}
      >
        <div style={{ position: 'absolute', left: 63, top: 4 }}>
          <button
            style={padButtonStyle}
            onTouchStart={(e) => { e.preventDefault(); setDir('forward', true); }}
            onTouchEnd={(e) => { e.preventDefault(); setDir('forward', false); }}
            onTouchCancel={(e) => { e.preventDefault(); setDir('forward', false); }}
          >
            ↑
          </button>
        </div>
        <div style={{ position: 'absolute', left: 6, top: 63 }}>
          <button
            style={padButtonStyle}
            onTouchStart={(e) => { e.preventDefault(); setDir('left', true); }}
            onTouchEnd={(e) => { e.preventDefault(); setDir('left', false); }}
            onTouchCancel={(e) => { e.preventDefault(); setDir('left', false); }}
          >
            ←
          </button>
        </div>
        <div style={{ position: 'absolute', left: 120, top: 63 }}>
          <button
            style={padButtonStyle}
            onTouchStart={(e) => { e.preventDefault(); setDir('right', true); }}
            onTouchEnd={(e) => { e.preventDefault(); setDir('right', false); }}
            onTouchCancel={(e) => { e.preventDefault(); setDir('right', false); }}
          >
            →
          </button>
        </div>
        <div style={{ position: 'absolute', left: 63, top: 122 }}>
          <button
            style={padButtonStyle}
            onTouchStart={(e) => { e.preventDefault(); setDir('back', true); }}
            onTouchEnd={(e) => { e.preventDefault(); setDir('back', false); }}
            onTouchCancel={(e) => { e.preventDefault(); setDir('back', false); }}
          >
            ↓
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 14,
          width: 120,
          height: 120,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.25)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 25,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          color: 'white',
          fontWeight: 800,
          fontSize: 22,
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          mobileInputRef.current.attack = true;
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          mobileInputRef.current.attack = false;
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          mobileInputRef.current.attack = false;
        }}
      >
        ATTACCA
      </div>

      <button
        onClick={onRequestGyro}
        style={{
          position: 'absolute',
          right: 10,
          top: 152,
          zIndex: 25,
          border: '1px solid rgba(255,255,255,0.25)',
          background: gyroEnabled ? 'rgba(86,225,127,0.22)' : 'rgba(255,255,255,0.12)',
          color: 'white',
          borderRadius: 12,
          padding: '10px 12px',
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {gyroEnabled ? 'GYRO ON' : 'ATTIVA GIROSCOPIO'}
      </button>

      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '55vw',
          height: '100vh',
          zIndex: 15,
          touchAction: 'none',
        }}
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={() => {
          lookPadRef.current.active = false;
          lookPadRef.current.touchId = null;
        }}
      />
    </>
  );
}

function Scene({ game, setGame, isMobile, mobileInputRef, gyroEnabled }) {
  const [keys, setKeys] = useState({});
  const playerRef = useRef(new THREE.Object3D());
  const lastSpawnRef = useRef(0);
  const hitCooldown = useRef(0);
  const attackCooldownRef = useRef(0);
  const yawRef = useRef(0);
  const gyroBaseRef = useRef(null);
  const attackAnimRef = useRef(0);

  const levelCfg = getLevelConfig(game.level);
  const canExit = game.score >= levelCfg.requiredScore;

  useEffect(() => {
    if (isMobile) return undefined;

    const down = (e) => setKeys((k) => ({ ...k, [e.code]: true }));
    const up = (e) => setKeys((k) => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [isMobile]);

  useEffect(() => {
    playerRef.current.position.set(-40, 1.7, 40);
  }, [game.level]);

  useEffect(() => {
    if (!isMobile || !gyroEnabled) {
      gyroBaseRef.current = null;
      return undefined;
    }

    const handleOrientation = (event) => {
      const gamma = typeof event.gamma === 'number' ? event.gamma : null;
      if (gamma == null) return;

      if (!gyroBaseRef.current) {
        gyroBaseRef.current = { gamma };
      }

      const gammaDelta = clamp(gamma - gyroBaseRef.current.gamma, -45, 45);
      yawRef.current = -gammaDelta * 0.025;
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isMobile, gyroEnabled]);

  useFrame((state, delta) => {
    if (game.status !== 'playing') return;

    if (isMobile && !gyroEnabled) {
      yawRef.current += mobileInputRef.current.lookDeltaX * 0.006;
      mobileInputRef.current.lookDeltaX = 0;
    }

    if (isMobile) {
      state.camera.rotation.order = 'YXZ';
      state.camera.rotation.y = yawRef.current;
      state.camera.rotation.x = 0;
      state.camera.rotation.z = 0;
    }

    const forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    const moveForward = isMobile ? mobileInputRef.current.forward : keys['KeyW'];
    const moveBack = isMobile ? mobileInputRef.current.back : keys['KeyS'];
    const moveLeft = isMobile ? mobileInputRef.current.left : keys['KeyA'];
    const moveRight = isMobile ? mobileInputRef.current.right : keys['KeyD'];

    if (moveForward) move.add(forward);
    if (moveBack) move.sub(forward);
    if (moveLeft) move.sub(right);
    if (moveRight) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar((isMobile ? 15 : 18) * delta);
    }

    const nextX = playerRef.current.position.x + move.x;
    const nextZ = playerRef.current.position.z + move.z;

    if (!collidesWithWalls(nextX, playerRef.current.position.z)) {
      playerRef.current.position.x = clamp(nextX, -46, 46);
    }
    if (!collidesWithWalls(playerRef.current.position.x, nextZ)) {
      playerRef.current.position.z = clamp(nextZ, -46, 46);
    }
    playerRef.current.position.y = 1.7;

    attackCooldownRef.current -= delta;

    let nextPickups = game.pickups;
    let gained = 0;

    nextPickups = nextPickups.map((p) => {
      if (!p.collected && playerRef.current.position.distanceTo(new THREE.Vector3(p.x, 1.7, p.z)) < 2.2) {
        gained += p.value;
        return { ...p, collected: true };
      }
      return p;
    });

    let nextShields = game.shieldPickups;
    let gainedShields = 0;
    nextShields = nextShields.map((s) => {
      if (!s.collected && playerRef.current.position.distanceTo(new THREE.Vector3(s.x, 1.7, s.z)) < 2.2) {
        gainedShields += 1;
        return { ...s, collected: true };
      }
      return s;
    });

    let nextEnemies = game.enemies.map((enemy) => {
      const dx = playerRef.current.position.x - enemy.x;
      const dz = playerRef.current.position.z - enemy.z;
      const dist = Math.hypot(dx, dz) || 1;
      const speed = enemy.alert ? levelCfg.enemySpeedAlert : levelCfg.enemySpeedIdle;
      const nx = enemy.x + (dx / dist) * speed * delta;
      const nz = enemy.z + (dz / dist) * speed * delta;
      const blocked = collidesWithWalls(nx, nz);
      const seen = dist < 20;

      return {
        ...enemy,
        x: blocked ? enemy.x : nx,
        z: blocked ? enemy.z : nz,
        alert: seen || enemy.alert,
        rotation: Math.atan2(dx, dz),
      };
    });

    const wantsAttack = isMobile ? mobileInputRef.current.attack : keys['KeyF'];
    if (wantsAttack && attackCooldownRef.current <= 0) {
      attackCooldownRef.current = levelCfg.attackCooldown;
      attackAnimRef.current = 1;

      nextEnemies = nextEnemies.filter((enemy) => {
        const dist = Math.hypot(playerRef.current.position.x - enemy.x, playerRef.current.position.z - enemy.z);
        return dist > levelCfg.attackRange;
      });
    }

    let nextHealth = game.health;
    let nextShieldCount = game.shieldsCount + gainedShields;

    const touchingEnemy = nextEnemies.some(
      (enemy) => Math.hypot(playerRef.current.position.x - enemy.x, playerRef.current.position.z - enemy.z) < 1.5
    );

    if (touchingEnemy && hitCooldown.current <= 0) {
      if (nextShieldCount > 0) {
        nextShieldCount -= 1;
      } else {
        nextHealth -= 1;
      }
      hitCooldown.current = 1.1;
    } else {
      hitCooldown.current -= delta;
    }

    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastSpawnRef.current > levelCfg.enemySpawnSeconds && nextEnemies.length < levelCfg.enemyMax) {
      lastSpawnRef.current = elapsed;
      const spot = findSpawnNearPlayer(playerRef.current.position.x, playerRef.current.position.z);
      nextEnemies = nextEnemies.concat({
        id: Math.random().toString(36).slice(2),
        x: spot.x,
        z: spot.z,
        alert: false,
        rotation: 0,
        phase: Math.random() * 10,
        variant: Math.floor(Math.random() * 3),
      });
    }

    let nextStatus = game.status;
    if (nextHealth <= 0) nextStatus = 'lost';

    if (
      canExit &&
      rectContains(EXIT_ZONE, playerRef.current.position.x, playerRef.current.position.z, 0.35)
    ) {
      nextStatus = 'levelComplete';
    }

    setGame((prev) => ({
      ...prev,
      health: nextHealth,
      score: prev.score + gained,
      shieldsCount: nextShieldCount,
      pickups: nextPickups,
      shieldPickups: nextShields,
      enemies: nextEnemies,
      status: nextStatus,
      player: {
        x: playerRef.current.position.x,
        z: playerRef.current.position.z,
      },
    }));
  });

  return (
    <>
      <CameraRig
        playerRef={playerRef}
        isMobile={isMobile}
        yawRef={yawRef}
        level={game.level}
        attackAnimRef={attackAnimRef}
      />

      <ambientLight intensity={0.9} />
      <directionalLight position={[10, 16, 5]} intensity={1.6} castShadow />
      <fog attach="fog" args={['#1a171c', 45, 120]} />

      <Ground />
      <CeilingLights />
      <Walls canExit={canExit} />
      <KitchenInspiredScene />

      {game.pickups.map((item) => <Pickup key={item.id} item={item} />)}
      {game.shieldPickups.map((item) => <ShieldPickup key={item.id} item={item} />)}
      {game.enemies.map((enemy) => <Enemy key={enemy.id} enemy={enemy} />)}
      <EnemyLabels enemies={game.enemies} player={game.player} />

      <mesh ref={playerRef} visible={false}>
        <capsuleGeometry args={[0.4, 0.6, 4, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {game.status !== 'playing' && (
        <Html position={[0, 8, 0]} center>
          <div />
        </Html>
      )}
    </>
  );
}

function buildLevelState(name, level, previousState = null) {
  const cfg = getLevelConfig(level);

  const pickups = Array.from({ length: PICKUP_COUNT + Math.min(level * 2, 12) }, (_, i) => {
    const pos = randomFreeSpot();
    const roll = Math.random();
    const value = roll < 0.55 ? 1 : roll < 0.85 ? 2 : 3;
    return {
      id: `${level}-p-${i + 1}`,
      x: pos.x,
      z: pos.z,
      collected: false,
      value,
    };
  });

  const shieldPickups = Array.from({ length: cfg.shieldSpawnCount }, (_, i) => {
    const pos = randomFreeSpot();
    return {
      id: `${level}-s-${i + 1}`,
      x: pos.x,
      z: pos.z,
      collected: false,
    };
  });

  return {
    name,
    level,
    status: 'playing',
    score: 0,
    health: previousState ? Math.min(previousState.health + 1, 8) : 6,
    shieldsCount: previousState ? previousState.shieldsCount : 0,
    player: { x: -40, z: 40 },
    pickups,
    shieldPickups,
    enemies: [],
  };
}

export default function App() {
  const [game, setGame] = useState(null);
  const [isMobile, setIsMobile] = useState(isProbablyMobileDevice());
  const [gyroEnabled, setGyroEnabled] = useState(false);

  const mobileInputRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    attack: false,
    lookDeltaX: 0,
  });

  useEffect(() => {
    const onResize = () => setIsMobile(isProbablyMobileDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const requestGyro = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        setGyroEnabled(result === 'granted');
      } else {
        setGyroEnabled(true);
      }
    } catch (error) {
      console.error('Gyroscope permission error:', error);
      setGyroEnabled(false);
    }
  };

  const startGame = (name) => {
    setGame(buildLevelState(name, 1));
  };

  const restartGame = () => {
    setGame(buildLevelState(game?.name || 'Player', 1));
  };

  const goToNextLevel = () => {
    setGame((prev) => buildLevelState(prev.name, prev.level + 1, prev));
  };

  if (!game) {
    return <Intro onStart={startGame} isMobile={isMobile} />;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <Canvas shadows camera={{ fov: 75, position: [-40, 1.7, 40] }}>
        <Scene
          game={game}
          setGame={setGame}
          isMobile={isMobile}
          mobileInputRef={mobileInputRef}
          gyroEnabled={gyroEnabled}
        />
      </Canvas>

      <HUD
        game={game}
        onRestart={restartGame}
        onNextLevel={goToNextLevel}
        isMobile={isMobile}
        gyroEnabled={gyroEnabled}
        canExit={game.score >= getLevelConfig(game.level).requiredScore}
      />

      <Minimap
        player={game.player}
        pickups={game.pickups}
        shields={game.shieldPickups}
        enemies={game.enemies}
        isMobile={isMobile}
      />

      {isMobile && game.status === 'playing' && (
        <MobileControls
          mobileInputRef={mobileInputRef}
          gyroEnabled={gyroEnabled}
          onRequestGyro={requestGyro}
        />
      )}
    </div>
  );
}
