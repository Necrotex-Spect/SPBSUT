import * as THREE from 'three';
import { state } from './state.js';

let renderer, scene, camera;
let regionMeshes = [];
let raycaster, pointer;
let supplyLines = [];
let initialized = false;

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let previousMousePosition = { x: 0, y: 0 };
let hasDragged = false;

const BASE_CAMERA_HEIGHT = 22;
const BASE_RING_INNER = 0.35;
const BASE_RING_OUTER = 0.55;
const BASE_MARKER_RADIUS = 0.22;
const BASE_POLE_HEIGHT = 0.3;
const BASE_LABEL_SCALE = { x: 1.8, y: 0.45 };

const MAP_HALF = 7;
const MAP_BOUND = MAP_HALF - 1.2;
const MIN_HEIGHT = 10;
const MAX_HEIGHT = 28;

const SUPPLY_CONNECTIONS = [
  ['center', 'leningrad'],
  ['center', 'donbass'],
  ['center', 'volga'],
  ['center', 'ural'],
  ['center', 'caucasus'],
  ['ural', 'west_siberia'],
  ['west_siberia', 'east_siberia'],
  ['east_siberia', 'far_east'],
  ['volga', 'central_asia'],
  ['donbass', 'caucasus'],
];

function getScreenScale() {
  const w = window.innerWidth;
  if (w < 480) return 2.2;
  if (w < 768) return 1.9;
  if (w < 1024) return 1.5;
  if (w < 1440) return 1.15;
  return 1.0;
}

export function initScene() {
  if (initialized) return;
  initialized = true;

  const canvas = document.getElementById('canvas');
  if (!canvas) {
    throw new Error('Canvas не найден');
  }

  console.log('🎨 Инициализация 3D-сцены...');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0f18);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0f18, 0.008);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const screenScale = getScreenScale();
  camera.position.set(0, BASE_CAMERA_HEIGHT * Math.min(screenScale, 1.4), 0);
  camera.rotation.set(-Math.PI / 2, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dir = new THREE.DirectionalLight(0xfff5e0, 1.0);
  dir.position.set(0, 20, 0);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x8899cc, 0.4);
  fill.position.set(-5, 10, -5);
  scene.add(fill);

  createMapGround();
  createSupplyLines();

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  setupCameraControls(canvas);
  console.log('✅ 3D-сцена инициализирована');
}

function createMapGround() {
  const textureLoader = new THREE.TextureLoader();

  textureLoader.load(
    '1793786865.png',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      applyMapTexture(texture);
    },
    undefined,
    () => {
      console.warn('⚠ Карта не найдена, используем процедурный фон');
      applyProceduralMap();
    }
  );
}

function applyMapTexture(texture) {
  const old = scene.getObjectByName('ground');
  if (old) scene.remove(old);

  const size = MAP_HALF * 2;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.0,
      emissive: 0x222222,
      emissiveIntensity: 0.3,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, 0);
  ground.name = 'ground';
  scene.add(ground);
}

function applyProceduralMap() {
  const old = scene.getObjectByName('ground');
  if (old) scene.remove(old);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x2a3545, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, 0);
  ground.name = 'ground';
  scene.add(ground);
}

function createSupplyLines() {
  const material = new THREE.LineBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.3
  });

  SUPPLY_CONNECTIONS.forEach(([fromId, toId]) => {
    const from = state.regions.find(r => r.id === fromId);
    const to = state.regions.find(r => r.id === toId);
    if (!from || !to) return;

    const points = [
      new THREE.Vector3(from.pos[0], 0.08, from.pos[2]),
      new THREE.Vector3(to.pos[0], 0.08, to.pos[2]),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `supply-${fromId}-${toId}`;
    scene.add(line);
    supplyLines.push(line);
  });
}

export function createRegions() {
  if (!scene) return;

  state.regions.forEach(r => {
    const group = new THREE.Group();
    group.position.set(r.pos[0], r.pos[1], r.pos[2]);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(BASE_RING_INNER, BASE_RING_OUTER, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffd27a,
        emissive: 0x8a6a2a,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.name = 'ring';
    group.add(ring);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(BASE_MARKER_RADIUS, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x8aba6a,
        emissive: 0x3a5a2a,
        emissiveIntensity: 0.6
      })
    );
    marker.position.y = 0.3;
    marker.name = 'marker';
    group.add(marker);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, BASE_POLE_HEIGHT, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd27a,
        emissive: 0x6a4a1a,
        emissiveIntensity: 0.4
      })
    );
    pole.position.y = 0.15;
    pole.name = 'pole';
    group.add(pole);

    const label = makeTextSprite(r.name);
    label.position.y = 0.9;
    label.name = 'label';
    group.add(label);

    group.userData = { regionId: r.id };
    scene.add(group);
    regionMeshes.push(group);
  });
}

function makeTextSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');

  ctx.fillStyle = 'rgba(10, 15, 24, 0.9)';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = 'rgba(255, 210, 122, 0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 120);

  ctx.fillStyle = '#ffe0a0';
  ctx.font = 'bold 56px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);

  const screenScale = getScreenScale();
  sprite.scale.set(
    BASE_LABEL_SCALE.x * screenScale,
    BASE_LABEL_SCALE.y * screenScale,
    1
  );
  return sprite;
}

function updateRegionScales() {
  if (!camera) return;

  const zoomFactor = camera.position.y / BASE_CAMERA_HEIGHT;
  const zoomScale = Math.max(0.6, Math.min(2.0, zoomFactor));
  const screenScale = getScreenScale();

  regionMeshes.forEach(m => {
    const ring = m.getObjectByName('ring');
    const marker = m.getObjectByName('marker');
    const pole = m.getObjectByName('pole');
    const label = m.getObjectByName('label');

    if (ring) {
      ring.geometry.dispose();
      ring.geometry = new THREE.RingGeometry(
        BASE_RING_INNER * zoomScale,
        BASE_RING_OUTER * zoomScale,
        32
      );
    }

    if (marker) {
      marker.geometry.dispose();
      marker.geometry = new THREE.SphereGeometry(BASE_MARKER_RADIUS * zoomScale, 16, 16);
      marker.position.y = 0.3 * zoomScale;
    }

    if (pole) {
      pole.geometry.dispose();
      pole.geometry = new THREE.CylinderGeometry(0.04 * zoomScale, 0.04 * zoomScale, BASE_POLE_HEIGHT * zoomScale, 8);
      pole.position.y = 0.15 * zoomScale;
    }

    if (label) {
      label.scale.set(
        BASE_LABEL_SCALE.x * screenScale * zoomScale,
        BASE_LABEL_SCALE.y * screenScale * zoomScale,
        1
      );
      label.position.y = 1.1 * zoomScale;
    }
  });
}

function clampCameraPosition() {
  if (!camera) return;
  camera.position.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, camera.position.x));
  camera.position.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, camera.position.z));
  camera.position.y = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, camera.position.y));
}

function setupCameraControls(canvas) {
  const DRAG_THRESHOLD = 5;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      hasDragged = false;
      dragStart = { x: e.clientX, y: e.clientY };
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    const totalDeltaX = e.clientX - dragStart.x;
    const totalDeltaY = e.clientY - dragStart.y;

    if (Math.abs(totalDeltaX) > DRAG_THRESHOLD || Math.abs(totalDeltaY) > DRAG_THRESHOLD) {
      hasDragged = true;

      const moveSpeed = 0.02;
      camera.position.x -= deltaX * moveSpeed;
      camera.position.z -= deltaY * moveSpeed;

      clampCameraPosition();
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 0) {
      isDragging = false;
      if (!hasDragged) handleRegionClick(e);
    }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.01;
    camera.position.y += e.deltaY * zoomSpeed;
    clampCameraPosition();
  }, { passive: false });

  let initialPinchDistance = 0;
  let initialCameraHeight = BASE_CAMERA_HEIGHT;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      initialPinchDistance = getPinchDistance(e.touches);
      initialCameraHeight = camera.position.y;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = getPinchDistance(e.touches);
      const scale = initialPinchDistance / currentDistance;
      camera.position.y = initialCameraHeight * scale;
      clampCameraPosition();
    }
  }, { passive: false });
}

function getPinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function handleRegionClick(e) {
  if (!camera || !raycaster) return;

  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  pointer.x = (x / rect.width) * 2 - 1;
  pointer.y = -(y / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(regionMeshes, true);

  if (hits.length) {
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.regionId) obj = obj.parent;
    if (obj.userData.regionId) {
      import('./ui.js').then(({ selectRegion }) => selectRegion(obj.userData.regionId)).catch(() => {});
    }
  }
}

export function handlePointerDown(e) {
  handleRegionClick(e);
}

export function highlightRegion(regionId) {
  regionMeshes.forEach(m => {
    const ring = m.getObjectByName('ring');
    const marker = m.getObjectByName('marker');
    const isSelected = m.userData.regionId === regionId;

    if (ring) {
      ring.material.emissive.setHex(isSelected ? 0xffd27a : 0x8a6a2a);
      ring.material.opacity = isSelected ? 1.0 : 0.8;
    }

    if (marker) {
      marker.material.color.setHex(isSelected ? 0xffe0a0 : 0x8aba6a);
      marker.material.emissive.setHex(isSelected ? 0xaa8a3a : 0x3a5a2a);
    }
  });

  supplyLines.forEach(line => {
    const name = line.name;
    const connected = name.includes(regionId);
    line.material.opacity = connected ? 0.7 : 0.2;
    line.material.color.setHex(connected ? 0xffd27a : 0x8899aa);
  });
}

export function resize() {
  if (!renderer || !camera) return;

  const canvas = document.getElementById('canvas');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w === 0 || h === 0) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  const screenScale = getScreenScale();
  if (camera.position.y < BASE_CAMERA_HEIGHT * Math.min(screenScale, 1.4) * 0.6) {
    camera.position.y = BASE_CAMERA_HEIGHT * Math.min(screenScale, 1.4) * 0.6;
  }
}

export function animate() {
  if (!renderer || !scene || !camera) return;

  requestAnimationFrame(animate);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  updateRegionScales();

  regionMeshes.forEach((m, i) => {
    const marker = m.getObjectByName('marker');
    if (marker) {
      const baseY = 0.3 * (camera.position.y / BASE_CAMERA_HEIGHT);
      marker.position.y = baseY + Math.sin(performance.now() * 0.002 + i) * 0.05;
    }
  });

  renderer.render(scene, camera);
}