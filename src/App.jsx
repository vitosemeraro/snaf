import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Text } from '@react-three/drei';
import * as THREE from 'three';

const MAP_W = 100;
const WALL_HEIGHT = 6;
const PLAYER_RADIUS = 1.2;
const BASE_REQUIRED_SCORE = 10;

const EXIT_ZONE = { x: 40, z: 44.5, w: 12, d: 7 };

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

const TABLES = [
  [-32, -28],
  [-18, -28],
  [18, -28],
  [32, -28],
  [-32, 28],
  [-18, 28],
  [18, 28],
  [32, 28],
  [-30, 6],
  [30, 6],
  [-12, 34],
  [12, 34],
];

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

function collidesWithWalls(x, z) {
  return WALLS.some((wall) => rectContains(wall, x, z, PLAYER_RADIUS));
}

function isInsideTableArea(x, z) {
  return TABLES.some(([tx, tz]) =>
    rectContains({ x: tx, z: tz, w: 5.2, d: 5.2 }, x, z, 1.4)
  );
}

function isInsideCenterIsland(x, z) {
  return rectContains({ x: 0, z: 2, w: 18, d: 10 }, x, z, 0.6);
}

function randomFreeSpot() {
  for (let i = 0; i < 500; i++) {
    const x = THREE.MathUtils.randFloatSpread(80);
    const z = THREE.MathUtils.randFloatSpread(80);

    const blocked =
      collidesWithWalls(x, z) ||
      rectContains(EXIT_ZONE, x, z, 5) ||
      isInsideCenterIsland(x, z) ||
      isInsideTableArea(x, z);

    if (!blocked) return { x, z };
  }
  return { x: 0, z: 0 };
}

function findSpawnNearPlayer(playerX, playerZ) {
  let chosen = randomFreeSpot();

  for (let i = 0; i < 20; i++) {
    const candidate = randomFreeSpot();
    const dist = Math.hypot(candidate.x - playerX, candidate.z - playerZ);
    if (dist > 10 && dist < 26) {
      chosen = candidate;
      break;
    }
  }

  return chosen;
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
    enemyMax: Math.min(4 + level * 2, 18),
    enemySpawnSeconds: Math.max(7 - level * 0.45, 2.4),
    enemySpeedIdle: 3.2 + level * 0.22,
    enemySpeedAlert: 4.8 + level * 0.48,
    attackRange: 2.8 + (level - 1) * 1.1,
    attackCooldown: Math.max(0.62 - (level - 1) * 0.03, 0.3),
    shieldSpawnCount: level >= 3 ? Math.min(1 + Math.floor((level - 3) / 2), 3) : 0,
  };
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color="#d9d9d9" />
      </mesh>

      {Array.from({ length: 20 }).map((_, ix) =>
        Array.from({ length: 20 }).map((_, iz) => {
          const x = -47.5 + ix * 5;
          const z = -47.5 + iz * 5;
          const dark = (ix + iz) % 2 === 0;

          return (
            <mesh
              key={`${ix}-${iz}`}
              position={[x, 0.01, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[5, 5]} />
              <meshBasicMaterial color={dark ? '#111217' : '#f1f1eb'} />
            </mesh>
          );
        })
      )}
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
    if (glowLightRef.current) glowLightRef.current.intensity = 1.4 + wave * 1.0;
  });

  return (
    <group>
      {WALLS.map((wall, i) => (
        <mesh key={i} position={[wall.x, WALL_HEIGHT / 2, wall.z]} castShadow receiveShadow>
          <boxGeometry args={[wall.w, WALL_HEIGHT, wall.d]} />
          <meshStandardMaterial color={i % 2 ? '#20232a' : '#2a2d34'} />
        </mesh>
      ))}

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
            position={[EXIT_ZONE.x, 3.2, EXIT_ZONE.z]}
            intensity={1.8}
            distance={14}
            color="#56e17f"
          />
          <Text
            position={[EXIT_ZONE.x, 5.4, EXIT_ZONE.z]}
            fontSize={1.2}
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

  return (
    <group>
      <mesh position={[0, 0.75, 2]} castShadow receiveShadow>
        <boxGeometry args={[18, 1.5, 10]} />
        <meshStandardMaterial color="#8e8e8e" />
      </mesh>

      <mesh position={[0, 4.8, 2]}>
        <boxGeometry args={[14, 2, 8]} />
        <meshStandardMaterial color="#9e9e9e" />
      </mesh>

      <mesh position={[0, 1.3, -41]} castShadow receiveShadow>
        <boxGeometry args={[22, 2.6, 6]} />
        <meshStandardMaterial color="#6a4a2d" />
      </mesh>

      {cakes.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[1.15, 1.15, 0.6, 12]} />
            <meshStandardMaterial color="#a9582a" />
          </mesh>
          <mesh position={[0, 0.33, 0]}>
            <cylinderGeometry args={[1.12, 1.12, 0.18, 12]} />
            <meshStandardMaterial color="#f6f1ea" />
          </mesh>
        </group>
      ))}

      {TABLES.map(([x, z], i) => (
        <group key={`table-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[2.2, 2.2, 0.35, 12]} />
            <meshStandardMaterial color="#d9d9d9" />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 1.2, 10]} />
            <meshStandardMaterial color="#777777" />
          </mesh>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <cylinderGeometry args={[1.2, 1.2, 0.1, 10]} />
            <meshStandardMaterial color="#6a5137" />
          </mesh>
        </group>
      ))}

      <Text position={[0, 5.4, -40.8]} fontSize={1.5} color="#ffd36d">
        SNAF PIZZERIA
      </Text>
    </group>
  );
}

function Pickup({ item }) {
  const ref = useRef();
  const beamRef = useRef();
  const floorGlowRef = useRef();

  useFrame((state) => {
    if (!ref.current) return;

    const t = state.clock.elapsedTime;
    ref.current.rotation.y += state.clock.getDelta() * 1.8;
    ref.current.position.y = 2.25 + Math.sin(t * 2 + item.id) * 0.22;

    if (beamRef.current) {
      beamRef.current.material.opacity = 0.2 + ((Math.sin(t * 4 + item.id) + 1) / 2) * 0.18;
    }

    if (floorGlowRef.current) {
      floorGlowRef.current.material.opacity = 0.14 + ((Math.sin(t * 3 + item.id) + 1) / 2) * 0.12;
    }
  });

  if (item.collected) return null;

  const color =
    item.value === 3 ? '#8a5cff' :
    item.value === 2 ? '#44d6ff' :
    '#ffd84d';

  const size =
    item.value === 3 ? 1.35 :
    item.value === 2 ? 1.15 :
    0.95;

  return (
    <group position={[item.x, 0, item.z]}>
      <mesh
        ref={floorGlowRef}
        position={[0, 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[size * 1.1, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={beamRef} position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.18, 0.32, 4.2, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>

      <group ref={ref} position={[0, 2.25, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[size, 0]} />
          <meshBasicMaterial color={color} />
        </mesh>

        <mesh>
          <sphereGeometry args={[size * 0.6, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>

        <pointLight intensity={1.25} distance={6} color={color} />
      </group>
    </group>
  );
}

function ShieldPickup({ item }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y += state.clock.getDelta() * 1.8;
    ref.current.position.y = 1.8 + Math.sin(state.clock.elapsedTime * 2 + item.id) * 0.16;
  });

  if (item.collected) return null;

  return (
    <group ref={ref} position={[item.x, 1.8, item.z]}>
      <mesh>
        <cylinderGeometry args={[0.9, 0.9, 0.2, 16]} />
        <meshStandardMaterial color="#66b8ff" emissive="#17456a" emissiveIntensity={1.0} />
      </mesh>
      <pointLight intensity={0.9} distance={5} color="#66b8ff" />
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
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshBasicMaterial color="#ff3b3b" />
      </mesh>
      <mesh position={[0.26, 2.95, 0.58]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshBasicMaterial color="#ff3b3b" />
      </mesh>

      <pointLight intensity={1.8} distance={7} color="#ff5c5c" />
    </group>
  );
}

function HandsAndWeapon({ camera, level, attackAnimRef }) {
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

    group.add(new THREE.AmbientLight(0xffffff, 1.2));
    group.add(leftHand);
    group.add(rightHand);

    let weapon = null;
    if (level >= 2) {
      weapon = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.9 + (level - 2) * 0.35),
        new THREE.MeshStandardMaterial({ color: level >= 5 ? '#9fd7ff' : '#8f6a45' })
      );
      group.add(weapon);
    }

    camera.add(group);

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
          <button style={padButtonStyle} onTouchStart={(e) => { e.preventDefault(); setDir('forward', true); }} onTouchEnd={(e) => { e.preventDefault(); setDir('forward', false); }} onTouchCancel={(e) => { e.preventDefault(); setDir('forward', false); }}>↑</button>
        </div>
        <div style={{ position: 'absolute', left: 6, top: 63 }}>
          <button style={padButtonStyle} onTouchStart={(e) => { e.preventDefault(); setDir('left', true); }} onTouchEnd={(e) => { e.preventDefault(); setDir('left', false); }} onTouchCancel={(e) => { e.preventDefault(); setDir('left', false); }}>←</button>
        </div>
        <div style={{ position: 'absolute', left: 120, top: 63 }}>
          <button style={padButtonStyle} onTouchStart={(e) => { e.preventDefault(); setDir('right', true); }} onTouchEnd={(e) => { e.preventDefault(); setDir('right', false); }} onTouchCancel={(e) => { e.preventDefault(); setDir('right', false); }}>→</button>
        </div>
        <div style={{ position: 'absolute', left: 63, top: 122 }}>
          <button style={padButtonStyle} onTouchStart={(e) => { e.preventDefault(); setDir('back', true); }} onTouchEnd={(e) => { e.preventDefault(); setDir('back', false); }} onTouchCancel={(e) => { e.preventDefault(); setDir('back', false); }}>↓</button>
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
          color: 'white',
          fontWeight: 800,
          fontSize: 18,
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
            ? `Pulsanti muovono • trascina a destra per guardare • attacco • gyro ${gyroEnabled ? 'ON' : 'OFF'}`
            : 'WASD muovi • mouse guarda • F attacca'}
        </div>
        <div style={{ marginTop: 8, color: canExit ? '#8fffaa' : '#ffd3a1', fontWeight: 700 }}>
          {canExit ? 'Uscita aperta: entra nella zona verde' : 'Raccogli abbastanza punti per aprire l’uscita'}
        </div>
      </div>

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
      if (!p.collected && playerRef.current.position.distanceTo(new THREE.Vector3(p.x, 1.7, p.z)) < 2.4) {
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

    if (canExit && rectContains(EXIT_ZONE, playerRef.current.position.x, playerRef.current.position.z, 0.35)) {
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

      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow />
      <pointLight position={[0, 5, -18]} intensity={0.8} distance={26} color="#ffd89c" />
      <fog attach="fog" args={['#1a171c', 55, 140]} />

      <Ground />
      <Walls canExit={canExit} />
      <KitchenInspiredScene />

      {game.pickups.map((item) => <Pickup key={item.id} item={item} />)}
      {game.shieldPickups.map((item) => <ShieldPickup key={item.id} item={item} />)}
      {game.enemies.map((enemy) => <Enemy key={enemy.id} enemy={enemy} />)}

      <mesh ref={playerRef} visible={false}>
        <capsuleGeometry args={[0.4, 0.6, 4, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

function buildLevelState(name, level, previousState = null) {
  const cfg = getLevelConfig(level);

  const pickups = Array.from({ length: 10 + Math.min(level * 2, 8) }, (_, i) => {
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
        zIndex: 100,
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
        <p>Scappa dalla pizzeria, raccogli tesori e sopravvivi ai mostri.</p>
        {isMobile && (
          <p style={{ color: '#cfe7ff' }}>
            Su mobile: pulsantiera a sinistra, attacco a destra, visuale trascinando a destra.
          </p>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Inserisci il tuo nome"
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: 'none',
            marginTop: 12,
            fontSize: 16,
          }}
        />
        <button
          type="button"
          onClick={() => onStart(name.trim() || 'Player')}
          style={{
            marginTop: 14,
            padding: '14px 18px',
            borderRadius: 12,
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer',
            background: '#ffffff',
            color: '#111',
          }}
        >
          Entra nella pizzeria
        </button>
      </div>
    </div>
  );
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
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
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
