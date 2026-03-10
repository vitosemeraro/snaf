import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Html, Text } from '@react-three/drei';
import * as THREE from 'three';

const MAP_W = 100;
const PLAYER_RADIUS = 1.2;
const WALL_HEIGHT = 6;
const PICKUP_COUNT = 18;
const REQUIRED_SCORE = 10;
const ENEMY_SPAWN_SECONDS = 8;
const ENEMY_MAX = 5;

const WALLS = [
  { x: 0, z: -48, w: 96, d: 4 },
  { x: 0, z: 48, w: 96, d: 4 },
  { x: -48, z: 0, w: 4, d: 96 },
  { x: 48, z: 0, w: 4, d: 96 },

  { x: -18, z: 0, w: 4, d: 58 },
  { x: 16, z: -8, w: 4, d: 72 },
  { x: 0, z: 18, w: 52, d: 4 },
  { x: 18, z: -24, w: 42, d: 4 },
  { x: -26, z: -22, w: 24, d: 4 },
  { x: -30, z: 22, w: 18, d: 4 },
  { x: 32, z: 24, w: 24, d: 4 },
  { x: -4, z: -38, w: 26, d: 4 },
];

const EXIT_ZONE = { x: 40, z: -40, w: 8, d: 8 };

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

function randomFreeSpot() {
  for (let i = 0; i < 400; i++) {
    const x = THREE.MathUtils.randFloatSpread(80);
    const z = THREE.MathUtils.randFloatSpread(80);
    const blocked = collidesWithWalls(x, z) || rectContains(EXIT_ZONE, x, z, 3);
    if (!blocked) return { x, z };
  }
  return { x: 0, z: 0 };
}

function isProbablyMobileDevice() {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth < 900
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[110, 110, 20, 20]} />
        <meshStandardMaterial color="#3d3a3a" />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 42, 32]} />
        <meshBasicMaterial color="#5c1515" side={THREE.DoubleSide} transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function Walls() {
  return (
    <group>
      {WALLS.map((wall, i) => (
        <mesh key={i} position={[wall.x, WALL_HEIGHT / 2, wall.z]} castShadow receiveShadow>
          <boxGeometry args={[wall.w, WALL_HEIGHT, wall.d]} />
          <meshStandardMaterial color={i % 2 ? '#7b1e1e' : '#5a1010'} />
        </mesh>
      ))}
      <mesh position={[EXIT_ZONE.x, 2.5, EXIT_ZONE.z]}>
        <boxGeometry args={[EXIT_ZONE.w, 5, EXIT_ZONE.d]} />
        <meshStandardMaterial color="#207d36" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function DecorativeProps() {
  const tables = useMemo(
    () => [
      [-35, -35],
      [-35, 35],
      [-2, -10],
      [32, 34],
      [34, -10],
      [-6, 34],
      [24, -34],
      [-28, 4],
      [6, 32],
    ],
    []
  );

  return (
    <group>
      {tables.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[2.1, 2.3, 0.5, 12]} />
            <meshStandardMaterial color="#b98a4d" />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 1.2, 12]} />
            <meshStandardMaterial color="#6b4d2c" />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 2.5, -43]}>
        <boxGeometry args={[18, 5, 1]} />
        <meshStandardMaterial color="#ffcc44" emissive="#aa5522" />
      </mesh>
      <Text position={[0, 2.7, -42.3]} fontSize={2.3} color="black">
        FREDBEAR PIZZA TEST
      </Text>
    </group>
  );
}

function Pickup({ item }) {
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += state.clock.getDelta() * 1.5;
      ref.current.position.y = 1.1 + Math.sin(state.clock.elapsedTime * 2 + item.id) * 0.18;
    }
  });

  if (item.collected) return null;

  return (
    <mesh ref={ref} position={[item.x, 1.1, item.z]} castShadow>
      <octahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#ffd84d" emissive="#b87900" />
    </mesh>
  );
}

function Enemy({ enemy }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.set(enemy.x, 1.5, enemy.z);
    ref.current.rotation.y = enemy.rotation;
    ref.current.position.y += Math.sin(state.clock.elapsedTime * 4 + enemy.id) * 0.06;
  });

  return (
    <group ref={ref}>
      <mesh castShadow>
        <capsuleGeometry args={[0.8, 1.5, 4, 8]} />
        <meshStandardMaterial color="#d5a46b" />
      </mesh>
      <mesh position={[0, 1.2, 0.72]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh position={[0.45, 1.25, 0.62]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh position={[0.2, 2.2, 0]} rotation={[0, 0, -0.2]}>
        <coneGeometry args={[0.35, 0.8, 12]} />
        <meshStandardMaterial color="#7a4f1d" />
      </mesh>
      <mesh position={[-0.2, 2.2, 0]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.35, 0.8, 12]} />
        <meshStandardMaterial color="#7a4f1d" />
      </mesh>
    </group>
  );
}

function Minimap({ player, pickups, enemies, isMobile }) {
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
        }}
      />

      {pickups
        .filter((p) => !p.collected)
        .map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              width: 6,
              height: 6,
              borderRadius: 999,
              left: size / 2 + p.x * scale - 3,
              top: size / 2 + p.z * scale - 3,
              background: '#ffd84d',
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

      <div style={{ position: 'absolute', left: 10, bottom: 8, color: 'white', fontSize: 12, letterSpacing: 1 }}>
        MAPPA
      </div>
    </div>
  );
}

function HUD({ game, onRestart, isMobile, gyroEnabled }) {
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
        <div>Punti: {game.score} / {REQUIRED_SCORE}</div>
        <div>Mostri attivi: {game.enemies.length}</div>
        <div>Vita: {game.health}</div>
        <div style={{ opacity: 0.8, marginTop: 8 }}>
          {isMobile
            ? `Pulsanti muovono • trascina a destra per guardare • pugno • gyro ${gyroEnabled ? 'ON' : 'OFF'}`
            : 'WASD muovi • mouse guarda • F tira un pugno'}
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

      {(game.status === 'lost' || game.status === 'won') && (
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
            zIndex: 50,
          }}
        >
          <div>
            <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 12 }}>
              {game.status === 'won' ? 'SEI SCAPPATO!' : 'TI HANNO PRESO!'}
            </div>
            <div style={{ maxWidth: 640, lineHeight: 1.5 }}>
              {game.status === 'won'
                ? 'Hai raccolto abbastanza punti e hai trovato l’uscita della pizzeria.'
                : 'I personaggi animati ti hanno raggiunto prima della fuga.'}
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
              Rigioca
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
        background: 'radial-gradient(circle at top, #411, #111)',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: '100%',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid #ffffff20',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 40 }}>Pizzeria Escape Prototype</h1>
        <p>
          Vertical slice giocabile in browser: prima persona, punti da raccogliere, minimappa, mostri buffi ma inquietanti,
          pugni per difendersi e uscita finale.
        </p>
        <p>
          Questa è una <strong>prima demo single-player</strong> delle meccaniche. Il multiplayer reale via URL e nome richiederà un piccolo server Node + WebSocket.
        </p>
        {isMobile && (
          <p style={{ color: '#cfe7ff' }}>
            Su mobile: usa la pulsantiera in basso a sinistra per muoverti, trascina a destra per girarti solo lateralmente,
            oppure attiva il giroscopio.
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

function CameraRig({ playerRef, isMobile, yawRef }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!playerRef.current) return;
    camera.position.copy(playerRef.current.position);

    if (isMobile) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yawRef.current;
      camera.rotation.x = 0;
      camera.rotation.z = 0;
    }
  });

  return isMobile ? null : <PointerLockControls />;
}

function MobileControls({ mobileInputRef, gyroEnabled, onRequestGyro }) {
  const lookPadRef = useRef({
    active: false,
    touchId: null,
    lastX: 0,
  });

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

        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: -24,
            width: '100%',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            fontFamily: 'sans-serif',
          }}
        >
          MOVIMENTO
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
        PUGNO
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

      <div
        style={{
          position: 'absolute',
          right: 18,
          bottom: 144,
          color: 'rgba(255,255,255,0.8)',
          fontSize: 12,
          fontFamily: 'sans-serif',
          zIndex: 25,
          textAlign: 'right',
          maxWidth: 140,
        }}
      >
        {gyroEnabled ? 'Muovi il telefono a destra e sinistra' : 'Trascina a destra solo orizzontalmente'}
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 8,
          transform: 'translateX(-50%)',
          width: 24,
          height: 24,
          borderRadius: 999,
          border: '2px solid rgba(255,255,255,0.9)',
          zIndex: 20,
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
  const attackCooldown = useRef(0);
  const yawRef = useRef(0);
  const gyroBaseRef = useRef(null);

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
  }, []);

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

    attackCooldown.current -= delta;
    hitCooldown.current -= delta;

    let nextPickups = game.pickups;
    let gained = 0;

    nextPickups = nextPickups.map((p) => {
      if (!p.collected && playerRef.current.position.distanceTo(new THREE.Vector3(p.x, 1.7, p.z)) < 2.2) {
        gained += 1;
        return { ...p, collected: true };
      }
      return p;
    });

    let nextEnemies = game.enemies.map((enemy) => {
      const dx = playerRef.current.position.x - enemy.x;
      const dz = playerRef.current.position.z - enemy.z;
      const dist = Math.hypot(dx, dz) || 1;
      const speed = enemy.alert ? 8 : 5;
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
    if (wantsAttack && attackCooldown.current <= 0) {
      attackCooldown.current = 0.55;
      nextEnemies = nextEnemies.filter((enemy) => {
        const dist = Math.hypot(playerRef.current.position.x - enemy.x, playerRef.current.position.z - enemy.z);
        return dist > 3.1;
      });
    }

    let nextHealth = game.health;
    if (hitCooldown.current <= 0) {
      const touchingEnemy = nextEnemies.some(
        (enemy) => Math.hypot(playerRef.current.position.x - enemy.x, playerRef.current.position.z - enemy.z) < 1.6
      );
      if (touchingEnemy) {
        nextHealth -= 1;
        hitCooldown.current = 1.1;
      }
    }

    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastSpawnRef.current > ENEMY_SPAWN_SECONDS && nextEnemies.length < ENEMY_MAX) {
      lastSpawnRef.current = elapsed;
      const spot = randomFreeSpot();
      nextEnemies = nextEnemies.concat({
        id: Math.random().toString(36).slice(2),
        x: spot.x,
        z: spot.z,
        alert: false,
        rotation: 0,
      });
    }

    let nextStatus = game.status;
    if (nextHealth <= 0) nextStatus = 'lost';

    if (game.score + gained >= REQUIRED_SCORE && rectContains(EXIT_ZONE, playerRef.current.position.x, playerRef.current.position.z, 0)) {
      nextStatus = 'won';
    }

    setGame((prev) => ({
      ...prev,
      health: nextHealth,
      score: prev.score + gained,
      pickups: nextPickups,
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
      <CameraRig playerRef={playerRef} isMobile={isMobile} yawRef={yawRef} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 16, 5]} intensity={1.4} castShadow />
      <fog attach="fog" args={['#130c0c', 35, 90]} />
      <Ground />
      <Walls />
      <DecorativeProps />
      {game.pickups.map((item) => <Pickup key={item.id} item={item} />)}
      {game.enemies.map((enemy) => <Enemy key={enemy.id} enemy={enemy} />)}
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

function createGame(name) {
  const pickups = Array.from({ length: PICKUP_COUNT }, (_, i) => {
    const pos = randomFreeSpot();
    return { id: i + 1, x: pos.x, z: pos.z, collected: false };
  });

  return {
    name,
    status: 'playing',
    score: 0,
    health: 6,
    player: { x: -40, z: 40 },
    pickups,
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

  if (!game) {
    return <Intro onStart={(name) => setGame(createGame(name))} isMobile={isMobile} />;
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
        onRestart={() => setGame(createGame(game.name))}
        isMobile={isMobile}
        gyroEnabled={gyroEnabled}
      />

      <Minimap
        player={game.player}
        pickups={game.pickups}
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
