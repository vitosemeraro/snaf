import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls, Html, Text } from '@react-three/drei'
import * as THREE from 'three'

const MAP_W = 100
const PLAYER_RADIUS = 1.15
const WALL_HEIGHT = 6
const PICKUP_COUNT = 18
const REQUIRED_SCORE = 10
const ENEMY_SPAWN_SECONDS = 8
const ENEMY_MAX = 5

const WALLS = [
  { x: 0, z: -48, w: 96, d: 4 },
  { x: -48, z: 0, w: 4, d: 96 },
  { x: 48, z: 0, w: 4, d: 96 },
  { x: 0, z: 48, w: 60, d: 4 },
  { x: -32, z: 48, w: 28, d: 4 },
  { x: -18, z: 0, w: 4, d: 58 },
  { x: 16, z: -8, w: 4, d: 72 },
  { x: 0, z: 18, w: 52, d: 4 },
  { x: 18, z: -24, w: 42, d: 4 },
  { x: -26, z: -22, w: 24, d: 4 },
  { x: -30, z: 22, w: 18, d: 4 },
  { x: 32, z: 24, w: 24, d: 4 },
  { x: -4, z: -38, w: 26, d: 4 }
]

const EXIT_ZONE = { x: 40, z: 44.5, w: 12, d: 9 }
const EXIT_DOOR = { x: 40, z: 48, w: 10, d: 0.8 }

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function rectContains(rect, x, z, margin = 0) {
  return (
    x > rect.x - rect.w / 2 - margin &&
    x < rect.x + rect.w / 2 + margin &&
    z > rect.z - rect.d / 2 - margin &&
    z < rect.z + rect.d / 2 + margin
  )
}

function collidesWithWalls(x, z) {
  return WALLS.some((wall) => rectContains(wall, x, z, PLAYER_RADIUS))
}

function randomFreeSpot() {
  for (let i = 0; i < 500; i++) {
    const x = THREE.MathUtils.randFloatSpread(80)
    const z = THREE.MathUtils.randFloatSpread(80)
    const blocked =
      collidesWithWalls(x, z) ||
      rectContains(EXIT_ZONE, x, z, 4) ||
      rectContains({ x: 0, z: -42, w: 26, d: 10 }, x, z, 3)

    if (!blocked) return { x, z }
  }

  return { x: 0, z: 0 }
}

function Ground() {
  const tiles = []

  for (let x = -50; x < 50; x += 5) {
    for (let z = -50; z < 50; z += 5) {
      const dark = (Math.floor((x + 50) / 5) + Math.floor((z + 50) / 5)) % 2 === 0
      tiles.push(
        <mesh key={`${x}-${z}`} position={[x + 2.5, 0, z + 2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[5, 5]} />
          <meshStandardMaterial color={dark ? '#2c2c30' : '#111114'} />
        </mesh>
      )
    }
  }

  return (
    <group>
      {tiles}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color="#111" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

function Walls({ canExit }) {
  const doorMatRef = useRef()
  const zoneMatRef = useRef()
  const glowLightRef = useRef()
  const sideLightLeftRef = useRef()
  const sideLightRightRef = useRef()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const wave = (Math.sin(t * 6) + 1) / 2

    if (doorMatRef.current) {
      doorMatRef.current.emissiveIntensity = canExit ? 1.2 + wave * 1.8 : 0.12
      doorMatRef.current.opacity = canExit ? 0.58 + wave * 0.32 : 0.9
    }

    if (zoneMatRef.current) {
      zoneMatRef.current.opacity = canExit ? 0.35 + wave * 0.45 : 0.7
    }

    if (glowLightRef.current) {
      glowLightRef.current.intensity = canExit ? 2.8 + wave * 2.2 : 0
    }

    if (sideLightLeftRef.current) {
      sideLightLeftRef.current.intensity = canExit ? 1.3 + wave * 1.0 : 0
    }

    if (sideLightRightRef.current) {
      sideLightRightRef.current.intensity = canExit ? 1.3 + wave * 1.0 : 0
    }
  })

  return (
    <group>
      {WALLS.map((wall, i) => (
        <mesh
          key={i}
          position={[wall.x, WALL_HEIGHT / 2, wall.z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wall.w, WALL_HEIGHT, wall.d]} />
          <meshStandardMaterial color={i % 2 ? '#6b1717' : '#4b0f0f'} />
        </mesh>
      ))}

      <mesh position={[EXIT_DOOR.x, 2.5, EXIT_DOOR.z]}>
        <boxGeometry args={[EXIT_DOOR.w, 5, EXIT_DOOR.d]} />
        <meshStandardMaterial
          ref={doorMatRef}
          color={canExit ? '#39d66f' : '#7a2020'}
          emissive={canExit ? '#39d66f' : '#220000'}
          emissiveIntensity={canExit ? 1.2 : 0.12}
          transparent
          opacity={canExit ? 0.7 : 0.9}
        />
      </mesh>

      <mesh position={[EXIT_ZONE.x, 0.05, EXIT_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[EXIT_ZONE.w, EXIT_ZONE.d]} />
        <meshBasicMaterial
          ref={zoneMatRef}
          color={canExit ? '#56ff8b' : '#8a2b2b'}
          transparent
          opacity={canExit ? 0.55 : 0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        ref={glowLightRef}
        position={[EXIT_DOOR.x, 4.4, EXIT_DOOR.z - 1.2]}
        intensity={canExit ? 3.2 : 0}
        distance={18}
        color="#56ff8b"
      />
      <pointLight
        ref={sideLightLeftRef}
        position={[EXIT_DOOR.x - 4.2, 2.4, EXIT_DOOR.z - 1]}
        intensity={canExit ? 1.8 : 0}
        distance={8}
        color="#7dffb0"
      />
      <pointLight
        ref={sideLightRightRef}
        position={[EXIT_DOOR.x + 4.2, 2.4, EXIT_DOOR.z - 1]}
        intensity={canExit ? 1.8 : 0}
        distance={8}
        color="#7dffb0"
      />

      <Text
        position={[EXIT_DOOR.x, 5.8, EXIT_DOOR.z - 0.2]}
        fontSize={1.6}
        color={canExit ? '#7dff9d' : '#ff8d8d'}
        anchorX="center"
        anchorY="middle"
      >
        {canExit ? 'EXIT OPEN' : `COLLECT ${REQUIRED_SCORE} POINTS`}
      </Text>
    </group>
  )
}

function StageArea() {
  return (
    <group>
      <mesh position={[0, 0.8, -42]} receiveShadow castShadow>
        <boxGeometry args={[24, 1.6, 8]} />
        <meshStandardMaterial color="#5b3a1e" />
      </mesh>

      <mesh position={[-8, 3.2, -46.1]}>
        <boxGeometry args={[5, 6, 0.4]} />
        <meshStandardMaterial color="#7a1010" />
      </mesh>

      <mesh position={[0, 3.2, -46.1]}>
        <boxGeometry args={[5, 6, 0.4]} />
        <meshStandardMaterial color="#5c0d0d" />
      </mesh>

      <mesh position={[8, 3.2, -46.1]}>
        <boxGeometry args={[5, 6, 0.4]} />
        <meshStandardMaterial color="#7a1010" />
      </mesh>

      <Text position={[0, 5.8, -41]} fontSize={2.1} color="#ffd65a">
        FREDBEAR PIZZA
      </Text>

      <group position={[-6, 1.8, -42]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.9, 1.7, 4, 8]} />
          <meshStandardMaterial color="#b28c55" />
        </mesh>
        <mesh position={[0, 1.35, 0.72]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color="black" />
        </mesh>
        <mesh position={[0.42, 1.35, 0.72]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color="black" />
        </mesh>
      </group>

      <group position={[0, 1.8, -42]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.9, 1.7, 4, 8]} />
          <meshStandardMaterial color="#8b61c5" />
        </mesh>
      </group>

      <group position={[6, 1.8, -42]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.9, 1.7, 4, 8]} />
          <meshStandardMaterial color="#d89b43" />
        </mesh>
      </group>
    </group>
  )
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
      [18, 8],
      [-8, 8]
    ],
    []
  )

  const posters = useMemo(
    () => [
      { x: -46, y: 3, z: -20, r: Math.PI / 2, color: '#ffe082', text: 'PARTY!' },
      { x: -46, y: 3, z: 16, r: Math.PI / 2, color: '#ff9e80', text: 'SMILE!' },
      { x: 46, y: 3, z: -8, r: -Math.PI / 2, color: '#ce93d8', text: 'PLAY!' },
      { x: 46, y: 3, z: 28, r: -Math.PI / 2, color: '#80cbc4', text: 'PIZZA!' }
    ],
    []
  )

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

      {posters.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} rotation={[0, p.r, 0]}>
          <mesh>
            <boxGeometry args={[0.3, 4, 6]} />
            <meshStandardMaterial color="#eee3c8" />
          </mesh>
          <Text position={[0.2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.9} color={p.color}>
            {p.text}
          </Text>
        </group>
      ))}

      <mesh position={[0, 2.6, 44]}>
        <boxGeometry args={[16, 4, 1]} />
        <meshStandardMaterial color="#ffcc44" emissive="#8a4d00" emissiveIntensity={0.8} />
      </mesh>
      <Text position={[0, 2.9, 44.7]} fontSize={1.8} color="black">
        MAIN HALL
      </Text>
    </group>
  )
}

function Pickup({ item }) {
  const ref = useRef()

  useFrame((state) => {
    if (ref.current) {
      const delta = state.clock.getDelta()
      ref.current.rotation.y += delta * 1.5
      ref.current.position.y =
        1.1 + Math.sin(state.clock.elapsedTime * 2 + item.id) * 0.18
    }
  })

  if (item.collected) return null

  return (
    <group ref={ref} position={[item.x, 1.1, item.z]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#ffd84d" emissive="#b87900" emissiveIntensity={1.2} />
      </mesh>
      <pointLight intensity={0.8} distance={4} color="#ffd84d" />
    </group>
  )
}

function Enemy({ enemy }) {
  const ref = useRef()

  useFrame((state) => {
    if (!ref.current) return
    ref.current.position.set(enemy.x, 1.5, enemy.z)
    ref.current.rotation.y = enemy.rotation
    ref.current.position.y += Math.sin(state.clock.elapsedTime * 4 + enemy.phase) * 0.06
  })

  return (
    <group ref={ref}>
      <mesh castShadow>
        <capsuleGeometry args={[0.9, 1.7, 4, 8]} />
        <meshStandardMaterial
          color={enemy.variant === 0 ? '#cba06f' : enemy.variant === 1 ? '#ad7cff' : '#e2a24e'}
          emissive={enemy.alert ? '#441111' : '#000000'}
          emissiveIntensity={enemy.alert ? 0.8 : 0}
        />
      </mesh>

      <mesh position={[0, 1.25, 0.78]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshBasicMaterial color={enemy.alert ? '#ff4040' : 'black'} />
      </mesh>

      <mesh position={[0.45, 1.25, 0.68]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshBasicMaterial color={enemy.alert ? '#ff4040' : 'black'} />
      </mesh>

      <mesh position={[0.2, 2.25, 0]} rotation={[0, 0, -0.2]}>
        <coneGeometry args={[0.38, 0.9, 12]} />
        <meshStandardMaterial color="#7a4f1d" />
      </mesh>

      <mesh position={[-0.2, 2.25, 0]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.38, 0.9, 12]} />
        <meshStandardMaterial color="#7a4f1d" />
      </mesh>

      <pointLight intensity={enemy.alert ? 1.2 : 0.3} distance={5} color={enemy.alert ? '#ff4040' : '#552222'} />
    </group>
  )
}

function EnemyBillboard({ enemies, player }) {
  return (
    <>
      {enemies.map((enemy) => {
        const dist = Math.hypot(player.x - enemy.x, player.z - enemy.z)
        if (dist > 10) return null

        return (
          <Text
            key={`label-${enemy.id}`}
            position={[enemy.x, 4.2, enemy.z]}
            fontSize={0.8}
            color="#ff7777"
            anchorX="center"
            anchorY="middle"
          >
            {dist < 3 ? 'ATTENTO!' : 'MOSTRO'}
          </Text>
        )
      })}
    </>
  )
}

function Minimap({ player, pickups, enemies }) {
  const size = 180
  const scale = size / MAP_W

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: 16,
        width: size,
        height: size,
        background: 'rgba(0,0,0,0.78)',
        border: '2px solid #ffffff33',
        borderRadius: 10,
        overflow: 'hidden'
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
            background: '#8f2a2a'
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
          background: '#2ecc71',
          boxShadow: '0 0 12px #2ecc71'
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
              background: '#ffd84d'
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
            boxShadow: '0 0 10px #ff5c5c'
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
          boxShadow: '0 0 8px #67b7ff'
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 8,
          color: 'white',
          fontSize: 12,
          letterSpacing: 1
        }}
      >
        MAPPA
      </div>
    </div>
  )
}

function HUD({ game, onRestart, canExit }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          color: 'white'
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800 }}>
          {game.name || 'Player'}
        </div>
        <div>Punti: {game.score} / {REQUIRED_SCORE}</div>
        <div>Mostri attivi: {game.enemies.length}</div>
        <div>Vita: {game.health}</div>
        <div style={{ marginTop: 8, color: canExit ? '#7dff9d' : '#ffd3a1', fontWeight: 700 }}>
          {canExit ? 'USCITA APERTA: entra nella zona verde lampeggiante' : 'Raccogli ancora punti per aprire l’uscita'}
        </div>
        <div style={{ opacity: 0.8, marginTop: 8 }}>
          W A S D muovi • mouse guarda • F tira un pugno
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 20,
          transform: 'translateX(-50%)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: 28, textShadow: '0 0 6px #fff' }}>+</div>
      </div>

      {(game.status === 'lost' || game.status === 'won') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            textAlign: 'center',
            padding: 24
          }}
        >
          <div>
            <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 12 }}>
              {game.status === 'won' ? 'SEI SCAPPATO!' : 'TI HANNO PRESO!'}
            </div>

            <div style={{ maxWidth: 640, lineHeight: 1.5 }}>
              {game.status === 'won'
                ? 'Hai raccolto abbastanza punti e hai raggiunto la porta di uscita.'
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
                cursor: 'pointer'
              }}
            >
              Rigioca
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Intro({ onStart }) {
  const [name, setName] = useState('')

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at top, #411, #111)',
        color: 'white',
        padding: 24
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: '100%',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid #ffffff20',
          borderRadius: 20,
          padding: 24
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 40 }}>
          Pizzeria Escape Prototype
        </h1>

        <p>
          Demo iniziale: prima persona, punti da raccogliere, minimappa,
          mostri buffi ma inquietanti, pugni per difendersi e uscita finale.
        </p>

        <p>
          In questa versione la porta di uscita si apre dopo aver raccolto abbastanza punti.
        </p>

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
            fontSize: 16
          }}
        />

        <button
          onClick={() => onStart(name.trim() || 'Player')}
          style={{
            marginTop: 14,
            padding: '14px 18px',
            borderRadius: 12,
            border: 'none',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Entra nella pizzeria
        </button>
      </div>
    </div>
  )
}

function CameraRig({ playerRef, attackAnim }) {
  const { camera, scene } = useThree()
  const fistsGroupRef = useRef()

  useEffect(() => {
    const fistsGroup = new THREE.Group()
    const light = new THREE.AmbientLight(0xffffff, 1.3)
    fistsGroup.add(light)

    const left = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: '#f1c27d' })
    )
    const right = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: '#f1c27d' })
    )

    left.position.set(-0.42, -0.38, -0.72)
    right.position.set(0.42, -0.42, -0.7)

    fistsGroup.add(left)
    fistsGroup.add(right)
    camera.add(fistsGroup)
    scene.add(camera)

    fistsGroupRef.current = { group: fistsGroup, left, right }

    return () => {
      camera.remove(fistsGroup)
    }
  }, [camera, scene])

  useFrame((_, delta) => {
    if (!playerRef.current) return
    camera.position.copy(playerRef.current.position)

    if (attackAnim.current > 0) {
      attackAnim.current = Math.max(0, attackAnim.current - delta * 3.2)
    }

    if (fistsGroupRef.current) {
      const t = attackAnim.current
      const punchOffset = Math.sin(Math.min(1, t) * Math.PI) * 0.45
      const sideSwing = Math.sin(Math.min(1, t) * Math.PI) * 0.12

      fistsGroupRef.current.left.position.set(-0.42 + sideSwing, -0.38, -0.72 - punchOffset)
      fistsGroupRef.current.right.position.set(0.42 - sideSwing, -0.42, -0.7 - punchOffset)

      fistsGroupRef.current.left.rotation.set(-0.5, 0.3, 0.15 + punchOffset * 0.5)
      fistsGroupRef.current.right.rotation.set(-0.55, -0.3, -0.15 - punchOffset * 0.5)
    }
  })

  return <PointerLockControls />
}

function Scene({ game, setGame }) {
  const [keys, setKeys] = useState({})
  const playerRef = useRef(new THREE.Object3D())
  const lastSpawnRef = useRef(0)
  const hitCooldown = useRef(0)
  const attackCooldown = useRef(0)
  const attackAnim = useRef(0)

  const canExit = game.score >= REQUIRED_SCORE

  useEffect(() => {
    const down = (e) => setKeys((k) => ({ ...k, [e.code]: true }))
    const up = (e) => setKeys((k) => ({ ...k, [e.code]: false }))

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    playerRef.current.position.set(-40, 1.7, 40)
  }, [])

  useFrame((state, delta) => {
    if (game.status !== 'playing') return

    const camera = state.camera
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize()

    const move = new THREE.Vector3()

    if (keys['KeyW']) move.add(forward)
    if (keys['KeyS']) move.sub(forward)
    if (keys['KeyA']) move.sub(right)
    if (keys['KeyD']) move.add(right)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(15 * delta)
    }

    const nextX = playerRef.current.position.x + move.x
    const nextZ = playerRef.current.position.z + move.z

    if (!collidesWithWalls(nextX, playerRef.current.position.z)) {
      playerRef.current.position.x = clamp(nextX, -46, 46)
    }

    if (!collidesWithWalls(playerRef.current.position.x, nextZ)) {
      playerRef.current.position.z = clamp(nextZ, -46, 46)
    }

    playerRef.current.position.y = 1.7

    attackCooldown.current -= delta
    hitCooldown.current -= delta

    let nextPickups = game.pickups
    let gained = 0

    nextPickups = nextPickups.map((p) => {
      const dist = playerRef.current.position.distanceTo(
        new THREE.Vector3(p.x, 1.7, p.z)
      )

      if (!p.collected && dist < 2.2) {
        gained += 1
        return { ...p, collected: true }
      }

      return p
    })

    let nextEnemies = game.enemies.map((enemy) => {
      const dx = playerRef.current.position.x - enemy.x
      const dz = playerRef.current.position.z - enemy.z
      const dist = Math.hypot(dx, dz) || 1
      const speed = enemy.alert ? 5.8 : 3.8
      const seen = dist < 18
      const nx = enemy.x + (dx / dist) * speed * delta
      const nz = enemy.z + (dz / dist) * speed * delta

      const nextEnemy = {
        ...enemy,
        alert: seen || enemy.alert,
        rotation: Math.atan2(dx, dz),
        x: enemy.x,
        z: enemy.z
      }

      const enemyRadius = 1.0
      const blockedX = WALLS.some((wall) => rectContains(wall, nx, enemy.z, enemyRadius))
      const blockedZ = WALLS.some((wall) => rectContains(wall, enemy.x, nz, enemyRadius))

      if (!blockedX) nextEnemy.x = clamp(nx, -46, 46)
      if (!blockedZ) nextEnemy.z = clamp(nz, -46, 46)

      return nextEnemy
    })

    if (keys['KeyF'] && attackCooldown.current <= 0) {
      attackCooldown.current = 0.55
      attackAnim.current = 1

      nextEnemies = nextEnemies.filter((enemy) => {
        const dist = Math.hypot(
          playerRef.current.position.x - enemy.x,
          playerRef.current.position.z - enemy.z
        )
        return dist > 2.4
      })
    }

    let nextHealth = game.health

    if (hitCooldown.current <= 0) {
      const touchingEnemy = nextEnemies.some(
        (enemy) =>
          Math.hypot(
            playerRef.current.position.x - enemy.x,
            playerRef.current.position.z - enemy.z
          ) < 1.05
      )

      if (touchingEnemy) {
        nextHealth -= 1
        hitCooldown.current = 1.4
      }
    }

    const elapsed = state.clock.elapsedTime

    if (
      elapsed - lastSpawnRef.current > ENEMY_SPAWN_SECONDS &&
      nextEnemies.length < ENEMY_MAX
    ) {
      lastSpawnRef.current = elapsed
      const spot = randomFreeSpot()

      nextEnemies = nextEnemies.concat({
        id: Math.random().toString(36).slice(2),
        x: spot.x,
        z: spot.z,
        alert: false,
        rotation: 0,
        phase: Math.random() * 10,
        variant: Math.floor(Math.random() * 3)
      })
    }

    let nextStatus = game.status

    if (nextHealth <= 0) {
      nextStatus = 'lost'
    }

    if (
      game.score + gained >= REQUIRED_SCORE &&
      rectContains(
        EXIT_ZONE,
        playerRef.current.position.x,
        playerRef.current.position.z,
        0.45
      )
    ) {
      nextStatus = 'won'
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
        z: playerRef.current.position.z
      }
    }))
  })

  return (
    <>
      <CameraRig playerRef={playerRef} attackAnim={attackAnim} />

      <ambientLight intensity={0.22} />
      <directionalLight position={[8, 16, 6]} intensity={0.4} castShadow />
      <pointLight position={[0, 6, 0]} intensity={1.2} distance={40} color="#7fa7ff" />
      <pointLight position={[0, 5, -36]} intensity={0.9} distance={28} color="#ffb84d" />
      <fog attach="fog" args={['#0f0c12', 18, 75]} />

      <Ground />
      <Walls canExit={canExit} />
      <StageArea />
      <DecorativeProps />

      {game.pickups.map((item) => (
        <Pickup key={item.id} item={item} />
      ))}

      {game.enemies.map((enemy) => (
        <Enemy key={enemy.id} enemy={enemy} />
      ))}

      <EnemyBillboard enemies={game.enemies} player={game.player} />

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
  )
}

function createGame(name) {
  const pickups = Array.from({ length: PICKUP_COUNT }, (_, i) => {
    const pos = randomFreeSpot()
    return {
      id: i + 1,
      x: pos.x,
      z: pos.z,
      collected: false
    }
  })

  return {
    name,
    status: 'playing',
    score: 0,
    health: 6,
    player: { x: -40, z: 40 },
    pickups,
    enemies: []
  }
}

export default function App() {
  const [game, setGame] = useState(null)

  if (!game) {
    return <Intro onStart={(name) => setGame(createGame(name))} />
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Canvas shadows camera={{ fov: 75, position: [-40, 1.7, 40] }}>
        <Scene game={game} setGame={setGame} />
      </Canvas>

      <HUD
        game={game}
        onRestart={() => setGame(createGame(game.name))}
        canExit={game.score >= REQUIRED_SCORE}
      />
      <Minimap
        player={game.player}
        pickups={game.pickups}
        enemies={game.enemies}
      />
    </div>
  )
}
