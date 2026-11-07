import * as THREE from 'three';
import { state } from './state.js';

let renderer, scene, camera;
let regionMeshes = [];
let raycaster, pointer;
let supplyLines = [];
let routeCurves = [];
let trains = [];
let mapParticles = [];
let cityLights = [];
let ambientMapLights = [];
let initialized = false;
let lastFrameTime = performance.now();

// Настройки атмосферности и плотности трафика
const MAX_ACTIVE_TRAINS = 4; // Максимум поездов одновременно на всей карте
const AMBIENT_LIGHTS_COUNT = 18; // Количество редких огоньков по всей карте

// Базовые размеры (квадрат)
const MAP_HALF = 7;
const BASE_CAMERA_HEIGHT = 15;

let currentScaleX = 1;

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0a1828);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.rotation.set(-Math.PI / 2, 0, 0);
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
  createAmbientMapLights();

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

// Редкие точечные огоньки по всей территории карты
function createAmbientMapLights() {
  if (!scene || ambientMapLights.length > 0) return;

  const dotGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const haloGeo = new THREE.RingGeometry(0.06, 0.16, 16);
  haloGeo.rotateX(-Math.PI / 2);

  for (let i = 0; i < AMBIENT_LIGHTS_COUNT; i++) {
    const group = new THREE.Group();

    // Базовые координаты разбросаны по всей карте (внутри границ)
    const baseX = (Math.random() - 0.5) * (MAP_HALF * 1.65);
    const baseZ = (Math.random() - 0.5) * (MAP_HALF * 1.15);

    const dotMat = new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? 0xff9f43 : 0xffd27a,
      transparent: true,
      opacity: 0,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.y = 0.06;

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 0.03;

    group.add(dot, halo);
    scene.add(group);

    ambientMapLights.push({
      group,
      dot,
      halo,
      baseX,
      baseZ,
      // Большие случайные паузы, чтобы огоньки зажигались редко и поодиночке
      cooldown: Math.random() * 14,
      activeTime: 0,
      duration: 2.8 + Math.random() * 2.2,
    });
  }
}

export function createRegions() {
  if (!scene || regionMeshes.length > 0) return;

  state.regions.forEach((r, idx) => {
    const group = new THREE.Group();
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

    // Медленная редкая пульсация вокруг города
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(BASE_RING_OUTER, BASE_RING_OUTER + 0.07, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
    );
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.y = 0.025;
    pulseRing.name = 'pulseRing';
    pulseRing.userData.timer = idx * 2.3;
    group.add(pulseRing);

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

    // Огоньки построенных заводов вокруг города (загораются редко и по очереди)
    const maxSlots = r.slots || 6;
    for (let s = 0; s < maxSlots; s++) {
      const angle = (s / maxSlots) * Math.PI * 2;
      const dist = 0.68;
      const lightDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffb347,
          transparent: true,
          opacity: 0.0,
        })
      );
      lightDot.position.set(Math.cos(angle) * dist, 0.08, Math.sin(angle) * dist);
      lightDot.name = `slotLight_${s}`;
      group.add(lightDot);

      cityLights.push({
        mesh: lightDot,
        regionId: r.id,
        slotIndex: s,
        cooldown: Math.random() * 10 + s * 2,
        activeTime: 0,
        duration: 2.5 + Math.random() * 2,
      });
    }

    // Редкие искры производства над городом
    for (let p = 0; p < 2; p++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xffd27a,
          transparent: true,
          opacity: 0,
        })
      );
      spark.position.set((Math.random() - 0.5) * 0.25, 0.2, (Math.random() - 0.5) * 0.25);
      group.add(spark);
      mapParticles.push({
        mesh: spark,
        regionId: r.id,
        life: Math.random(),
        cooldown: Math.random() * 5,
        offsetX: (Math.random() - 0.5) * 0.26,
        offsetZ: (Math.random() - 0.5) * 0.26,
      });
    }

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

  ctx.fillStyle = 'rgba(10, 15, 24, 0.92)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = 'rgba(255, 210, 122, 0.95)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 120);
  ctx.fillStyle = '#ffe0a0';
  ctx.font = 'bold 54px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (renderer) {
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);

  const screenScale = getScreenScale();
  sprite.scale.set(BASE_LABEL_SCALE.x * screenScale, BASE_LABEL_SCALE.y * screenScale, 1);
  return sprite;
}

// Строим плавные извилистые маршруты и создаём небольшой пул медленных поездов
function rebuildSupplyAndTrains() {
  supplyLines.forEach(line => scene.remove(line));
  supplyLines = [];
  routeCurves = [];

  trains.forEach(t => scene.remove(t.group));
  trains = [];

  const lineMat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.24 });

  SUPPLY_CONNECTIONS.forEach(([fromId, toId], idx) => {
    const from = regionMeshes.find(m => m.userData.regionId === fromId);
    const to = regionMeshes.find(m => m.userData.regionId === toId);
    if (!from || !to) return;

    const start = new THREE.Vector3(from.position.x, 0.08, from.position.z);
    const end = new THREE.Vector3(to.position.x, 0.08, to.position.z);

    // Вектор перпендикуляра для создания S-образного изгиба дороги
    const dir = new THREE.Vector3().subVectors(end, start);
    const dist = dir.length();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    // Два промежуточных узла для естественной извилистости пути
    const bendStrength = Math.min(dist * 0.14, 0.55) * (idx % 2 === 0 ? 1 : -1);
    const p1 = new THREE.Vector3().lerpVectors(start, end, 0.33).addScaledVector(perp, bendStrength);
    const p2 = new THREE.Vector3().lerpVectors(start, end, 0.67).addScaledVector(perp, -bendStrength * 0.75);
    p1.y = 0.08;
    p2.y = 0.08;

    const curve = new THREE.CatmullRomCurve3([start, p1, p2, end]);
    const points = curve.getPoints(36);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMat);
    line.name = `supply-${fromId}-${toId}`;
    scene.add(line);
    supplyLines.push(line);
    routeCurves.push({
      curve,
      dist,
      fromId,
      toId,
    });
  });

  if (routeCurves.length === 0) return;

  // Создаём всего несколько неторопливых поездов, которые чередуются на маршрутах
  const locoGeo = new THREE.BoxGeometry(0.15, 0.085, 0.075);
  const wagonGeo = new THREE.BoxGeometry(0.115, 0.065, 0.065);
  const headlightGeo = new THREE.SphereGeometry(0.032, 6, 6);
  const locoMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const wagonMat = new THREE.MeshBasicMaterial({ color: 0xd97736 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  for (let i = 0; i < MAX_ACTIVE_TRAINS; i++) {
    const trainGroup = new THREE.Group();
    const loco = new THREE.Mesh(locoGeo, locoMat);
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    const w1 = new THREE.Mesh(wagonGeo, wagonMat);
    const w2 = new THREE.Mesh(wagonGeo, wagonMat);

    trainGroup.add(loco, headlight, w1, w2);
    trainGroup.visible = false; // Изначально состав в депо (ждёт очереди)
    scene.add(trainGroup);

    const routeIdx = (i * 2) % routeCurves.length;
    trains.push({
      group: trainGroup,
      loco,
      headlight,
      wagons: [w1, w2],
      route: routeCurves[routeIdx],
      progress: 0,
      dir: i % 2 === 0 ? 1 : -1,
      // Пауза перед выездом (в секундах), чтобы поезда шли редко
      waitTimer: i * 3.5 + Math.random() * 3,
      active: false,
    });
  }
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

function setupCameraControls(canvas) {
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
  const sidePanelWidth = window.innerWidth > 1024 ? 320 : 0;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camera.clearViewOffset();
  if (sidePanelWidth > 0) {
    camera.setViewOffset(w, h, sidePanelWidth / 2, 0, w, h);
  }
  const vFOV = (camera.fov * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.y;
  const usableWidthPx = w - sidePanelWidth;
  const usableWidthWorld = visibleHeight * (usableWidthPx / h);
  const ground = scene.getObjectByName('ground');
  if (ground) {
    const stretchFactor = 1.05;
    ground.scale.set((usableWidthWorld / (MAP_HALF * 2)) * stretchFactor, 1, 1);
    currentScaleX = ground.scale.x;
  }
  regionMeshes.forEach(m => {
    const basePos = m.userData.basePos;
    m.position.set(basePos[0] * currentScaleX, basePos[1], basePos[2]);
  });
  // Сдвигаем точечные фоновые огоньки вместе с растяжением карты
  ambientMapLights.forEach(item => {
    item.group.position.set(item.baseX * currentScaleX, 0, item.baseZ);
  });
  // Перестраиваем извилистые магистрали и поезда с учётом новых координат
  rebuildSupplyAndTrains();
}

export function animate() {
  if (!renderer || !scene || !camera) return;
  requestAnimationFrame(animate);
  const now = performance.now();
  const rawDt = Math.min((now - lastFrameTime) * 0.001, 0.1);
  lastFrameTime = now;
  const gameSpeed = state.paused ? 0 : (state.speed || 1);
  const dt = rawDt * gameSpeed;
  camera.rotation.set(-Math.PI / 2, 0, 0);
  updateRegionScales();

  // 1. Анимация маркеров и редких пульсирующих волн городов
  regionMeshes.forEach((m, i) => {
    const marker = m.getObjectByName('marker');
    if (marker) {
      const baseY = 0.3 * (camera.position.y / BASE_CAMERA_HEIGHT);
      marker.position.y = baseY + Math.sin(now * 0.0018 + i) * 0.04;
    }
    const pulseRing = m.getObjectByName('pulseRing');
    if (pulseRing) {
      pulseRing.userData.timer += rawDt;
      // Волна проходит раз в ~7 секунд и длится 2.2 секунды
      const cycleDuration = 7.5;
      const waveDuration = 2.2;
      const t = pulseRing.userData.timer % cycleDuration;
      if (t < waveDuration) {
        const progress = t / waveDuration;
        const scale = 1 + progress * 0.75;
        pulseRing.scale.set(scale, scale, 1);
        pulseRing.material.opacity = Math.sin(progress * Math.PI) * 0.35;
      } else {
        pulseRing.material.opacity = 0;
      }
    }
  });

  // 2. Редкие огоньки построенных заводов вокруг городов (вспыхивают по очереди с паузами)
  for (const light of cityLights) {
    const regionData = state.regions.find(r => r.id === light.regionId);
    const builtCount = regionData ? regionData.buildings.length : 0;
    if (light.slotIndex >= builtCount) {
      light.mesh.material.opacity = 0;
      continue;
    }
    if (light.cooldown > 0) {
      light.cooldown -= rawDt;
      light.mesh.material.opacity = 0;
    } else {
      light.activeTime += rawDt;
      const p = light.activeTime / light.duration;
      if (p >= 1) {
        light.activeTime = 0;
        light.cooldown = 6 + Math.random() * 10; // Пауза 6–16 сек перед следующей вспышкой
        light.mesh.material.opacity = 0;
      } else {
        // Плавное разгорание и затухание (колокол синуса)
        const intensity = Math.sin(p * Math.PI);
        light.mesh.material.opacity = intensity * 0.85;
        const s = 0.8 + intensity * 0.4;
        light.mesh.scale.set(s, s, s);
      }
    }
  }

  // 3. Редкие огоньки по всей карте (стройки, буровые, маяки)
  for (const item of ambientMapLights) {
    if (item.cooldown > 0) {
      item.cooldown -= rawDt;
      item.dot.material.opacity = 0;
      item.halo.material.opacity = 0;
    } else {
      item.activeTime += rawDt;
      const p = item.activeTime / item.duration;
      if (p >= 1) {
        item.activeTime = 0;
        item.cooldown = 10 + Math.random() * 16; // Редкое появление: раз в 10–26 сек
        item.dot.material.opacity = 0;
        item.halo.material.opacity = 0;
      } else {
        const intensity = Math.sin(p * Math.PI);
        item.dot.material.opacity = intensity * 0.8;
        item.halo.material.opacity = intensity * 0.35;
        const haloScale = 0.8 + p * 1.1;
        item.halo.scale.set(haloScale, haloScale, 1);
      }
    }
  }

  // 4. Неспешное движение мини-поездов по извилистым путям с длинными паузами
  for (const t of trains) {
    if (!t.active) {
      if (dt > 0) {
        t.waitTimer -= dt;
        if (t.waitTimer <= 0 && routeCurves.length > 0) {
          // Выбираем случайный маршрут для нового рейса
          t.route = routeCurves[Math.floor(Math.random() * routeCurves.length)];
          t.dir = Math.random() > 0.5 ? 1 : -1;
          t.progress = t.dir === 1 ? 0 : 1;
          t.active = true;
          t.group.visible = true;
        }
      }
      continue;
    }

    if (dt > 0) {
      // Неторопливая скорость: ~0.22 ед/сек (в 2.5 раза медленнее прежнего)
      const speed = 0.22 / Math.max(t.route.dist, 1);
      t.progress += speed * dt * t.dir;
      // Поезд доехал до конечной станции — уходит в депо на паузу
      if (t.progress >= 1 || t.progress <= 0) {
        t.active = false;
        t.group.visible = false;
        t.waitTimer = 5 + Math.random() * 8; // Пауза 5–13 сек до следующего отправления
        continue;
      }
    }

    // Позиционируем локомотив и вагоны строго вдоль изгиба кривой CatmullRomCurve3
    const uLoco = Math.max(0.001, Math.min(0.999, t.progress));
    const locoPos = t.route.curve.getPointAt(uLoco);
    const tangent = t.route.curve.getTangentAt(uLoco).multiplyScalar(t.dir);
    locoPos.y = 0.11;
    t.loco.position.copy(locoPos);
    t.loco.lookAt(locoPos.clone().add(tangent));
    t.headlight.position.copy(locoPos).addScaledVector(tangent, 0.085);

    // Каждый вагон едет по своей точке на кривой чуть позади локомотива, повторяя все повороты
    const stepU = 0.16 / Math.max(t.route.dist, 1);
    t.wagons.forEach((w, idx) => {
      const uWagon = Math.max(0.001, Math.min(0.999, uLoco - (idx + 1) * stepU * t.dir));
      const wPos = t.route.curve.getPointAt(uWagon);
      const wTan = t.route.curve.getTangentAt(uWagon).multiplyScalar(t.dir);
      wPos.y = 0.105;
      w.position.copy(wPos);
      w.lookAt(wPos.clone().add(wTan));
    });
  }

  // 5. Редкие искры производства над промышленными городами
  for (const p of mapParticles) {
    const regionData = state.regions.find(r => r.id === p.regionId);
    const builtCount = regionData ? regionData.buildings.length : 0;
    if (builtCount === 0) {
      p.mesh.material.opacity = 0;
      continue;
    }
    if (p.cooldown > 0) {
      if (dt > 0) p.cooldown -= dt;
      p.mesh.material.opacity = 0;
      continue;
    }
    if (dt > 0) {
      p.life += dt * 0.28;
      if (p.life > 1) {
        p.life = 0;
        p.cooldown = 3 + Math.random() * 5; // Пауза между искрами
        p.mesh.material.opacity = 0;
        continue;
      }
    }
    p.mesh.position.set(
      p.offsetX,
      0.2 + p.life * 0.75,
      p.offsetZ
    );
    p.mesh.material.opacity = Math.sin(p.life * Math.PI) * 0.55;
    const scale = 0.5 + p.life * 0.6;
    p.mesh.scale.set(scale, scale, scale);
  }

  renderer.render(scene, camera);
}