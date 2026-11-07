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

// Базовые размеры (квадрат)
const MAP_HALF = 7; 
const BASE_CAMERA_HEIGHT = 15; // Фиксированная высота камеры, чтобы не было зума "в пустоту"

let currentScaleX = 1; // Коэффициент растяжения по X

const BASE_RING_INNER = 0.35;
const BASE_RING_OUTER = 0.55;
const BASE_MARKER_RADIUS = 0.22;
const BASE_POLE_HEIGHT = 0.3;
const BASE_LABEL_SCALE = { x: 1.8, y: 0.45 };

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
  if (!canvas) throw new Error('Canvas не найден');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a1828); // Темно-синий фон
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  // Ставим камеру на фиксированную высоту, чтобы карта всегда была крупной
  camera.position.set(0, BASE_CAMERA_HEIGHT, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dir = new THREE.DirectionalLight(0xfff5e0, 1.0);
  dir.position.set(0, 20, 0);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x8899cc, 0.4);
  fill.position.set(-5, 10, -5);
  scene.add(fill);

  createMapGround();
  createRegions();
  createSupplyLines();

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  setupCameraControls(canvas);
}

function createMapGround() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    '1793786865.png',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      
      // Начальное создание плоскости
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2),
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
      
      // Сразу вызываем resize, чтобы растянуть карту под экран
      resize();
    },
    undefined,
    () => {
      console.warn('⚠ Карта не найдена');
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2),
        new THREE.MeshStandardMaterial({ color: 0x2a3545 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -0.01, 0);
      ground.name = 'ground';
      scene.add(ground);
      resize();
    }
  );
}

function createSupplyLines() {
  // Линии будут обновляться при изменении размера экрана
}

export function createRegions() {
  if (!scene) return;
  state.regions.forEach(r => {
    const group = new THREE.Group();
    // Сохраняем базовые координаты
    group.userData = { regionId: r.id, basePos: [r.pos[0], r.pos[1], r.pos[2]] };

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(BASE_RING_INNER, BASE_RING_OUTER, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffd27a, emissive: 0x8a6a2a, emissiveIntensity: 0.5,
        side: THREE.DoubleSide, transparent: true, opacity: 0.9,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.name = 'ring';
    group.add(ring);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(BASE_MARKER_RADIUS, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x8aba6a, emissive: 0x3a5a2a, emissiveIntensity: 0.6 })
    );
    marker.position.y = 0.3;
    marker.name = 'marker';
    group.add(marker);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, BASE_POLE_HEIGHT, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0x6a4a1a, emissiveIntensity: 0.4 })
    );
    pole.position.y = 0.15;
    pole.name = 'pole';
    group.add(pole);

    const label = makeTextSprite(r.name);
    label.position.y = 0.9;
    label.name = 'label';
    group.add(label);

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
  sprite.scale.set(BASE_LABEL_SCALE.x * screenScale, BASE_LABEL_SCALE.y * screenScale, 1);
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
      ring.geometry = new THREE.RingGeometry(BASE_RING_INNER * zoomScale, BASE_RING_OUTER * zoomScale, 32);
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
      label.scale.set(BASE_LABEL_SCALE.x * screenScale * zoomScale, BASE_LABEL_SCALE.y * screenScale * zoomScale, 1);
      label.position.y = 1.1 * zoomScale;
    }
  });
}

// ЖЁСТКИЙ КОНТРОЛЬ ГРАНИЦ (камера прибита к центру)
function clampCameraPosition() {
  if (!camera) return;
  // Полностью блокируем перемещение и зум. Камера всегда смотрит в центр.
  camera.position.x = 0;
  camera.position.z = 0;
  camera.position.y = BASE_CAMERA_HEIGHT;
}

function setupCameraControls(canvas) {
  // Убираем все обработчики движения и зума
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0) {
      handleRegionClick(e);
    }
  });
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
}

export function resize() {
  if (!renderer || !camera) return;
  const canvas = document.getElementById('canvas');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w === 0 || h === 0) return;

  renderer.setSize(w, h, false);
  
  // Ширина правой панели в пикселях
  const sidePanelWidth = window.innerWidth > 900 ? 320 : 0;
  
  // Сдвигаем камеру влево ровно на половину панели
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camera.clearViewOffset();

  if (sidePanelWidth > 0) {
    camera.setViewOffset(w, h, sidePanelWidth / 2, 0, w, h);
  }

  // Считаем, какую область мы видим
  const vFOV = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.y;
  
  // ВАЖНО: берем ширину экрана МИНУС панель, чтобы карта вписалась ровно в свободную зону
  const usableWidthPx = w - sidePanelWidth;
  const usableWidthWorld = visibleHeight * (usableWidthPx / h);

  const ground = scene.getObjectByName('ground');
  if (ground) {
    // Растягиваем карту так, чтобы она заполнила ровно эту свободную зону
    // (Добавляем небольшой запас 5%, чтобы не было зазоров)
    const stretchFactor = 1.05; 
    ground.scale.set((usableWidthWorld / (MAP_HALF * 2)) * stretchFactor, 1, 1);
    currentScaleX = ground.scale.x;
  }

  // Растягиваем координаты регионов (города съедут вместе с картой)
  regionMeshes.forEach(m => {
    const basePos = m.userData.basePos;
    m.position.set(basePos[0] * currentScaleX, basePos[1], basePos[2]);
  });

  // Перерисовываем линии снабжения
  supplyLines.forEach(line => scene.remove(line));
  supplyLines = [];
  
  const material = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.3 });
  SUPPLY_CONNECTIONS.forEach(([fromId, toId]) => {
    const from = regionMeshes.find(m => m.userData.regionId === fromId);
    const to = regionMeshes.find(m => m.userData.regionId === toId);
    if (!from || !to) return;
    const points = [
      new THREE.Vector3(from.position.x, 0.08, from.position.z),
      new THREE.Vector3(to.position.x, 0.08, to.position.z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `supply-${fromId}-${toId}`;
    scene.add(line);
    supplyLines.push(line);
  });
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