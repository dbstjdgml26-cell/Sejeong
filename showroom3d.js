/* ============================================================
   PICKLE MOTORS · 3D SHOWROOM
   Three.js scene for the shared showroom stage:
   - polished marble floor, turntable + stylised 3D car
   - three furnished zones (showroom / desk / lounge)
   - 3D Pickle characters with CSS2D name & status badges
   - automatic seasonal props, lighting and particles
   Everything is procedural: no external images or fonts.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[(Math.random() * arr.length) | 0];

const ZONE_CENTERS = {
  showroom: new THREE.Vector3(0, 0, 0.8),
  desk: new THREE.Vector3(5.9, 0, 1.2),
  lounge: new THREE.Vector3(-5.9, 0, 1.4)
};
const ZONE_FOCALS = {
  showroom: new THREE.Vector3(0, 0.95, 0.8),
  desk: new THREE.Vector3(5.9, 0.8, 1.2),
  lounge: new THREE.Vector3(-5.9, 0.55, 1.45)
};
const ZONE_FLAGS = {
  showroom: { icon: "🚘", name: "메인 쇼룸" },
  desk: { icon: "🤝", name: "상담 테이블" },
  lounge: { icon: "☕", name: "고객 라운지" }
};
/* where characters look: roughly toward the visitor, so their faces show */
const FACE_TARGET = {
  showroom: new THREE.Vector3(0, 0, 14),
  desk: new THREE.Vector3(5.0, 0, 7.6),
  lounge: new THREE.Vector3(-5.0, 0, 8.0)
};
const CHAR_SCALE = 1.14;

const CAMERAS = {
  overview: { pos: [0.3, 6.1, 12.6], target: [0, 1.4, 1.1] },
  showroom: { pos: [3.6, 3.5, 9.9], target: [0, 1.15, 1.0] },
  desk: { pos: [6.9, 3.15, 7.0], target: [5.85, 0.95, 1.15] },
  lounge: { pos: [-3.3, 3.1, 6.8], target: [-5.85, 0.95, 1.3] }
};

/* ---------------- tiny helpers ---------------- */

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const DOT_TEX = canvasTex(96, 96, (x, w) => {
  const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, w, w);
});

const GLOW_TEX = canvasTex(128, 128, (x, w) => {
  const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,.95)");
  g.addColorStop(0.25, "rgba(255,255,255,.5)");
  g.addColorStop(0.6, "rgba(255,255,255,.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, w, w);
});

function marbleTexture() {
  return canvasTex(1024, 1024, (x, w) => {
    x.fillStyle = "#0a0d13";
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 60; i++) {
      const cx = Math.random() * w, cy = Math.random() * w, r = rand(60, 260);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(150,170,200,${rand(0.006, 0.018)})`);
      g.addColorStop(1, "rgba(150,170,200,0)");
      x.fillStyle = g;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    for (let i = 0; i < 18; i++) {
      x.beginPath();
      let px = Math.random() * w, py = -20;
      x.moveTo(px, py);
      while (py < w + 20) {
        px += rand(-46, 46);
        py += rand(40, 110);
        x.lineTo(px, py);
      }
      x.strokeStyle = `rgba(190,205,230,${rand(0.02, 0.055)})`;
      x.lineWidth = rand(0.6, 2.2);
      x.stroke();
    }
    x.strokeStyle = "rgba(255,255,255,.035)";
    x.lineWidth = 1.4;
    for (let i = 0; i <= w; i += 256) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke();
    }
  });
}

function nightTexture() {
  return canvasTex(1024, 640, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a1526");
    g.addColorStop(0.5, "#122236");
    g.addColorStop(1, "#1d3450");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    const moon = x.createRadialGradient(w * 0.24, h * 0.24, 0, w * 0.24, h * 0.24, 170);
    moon.addColorStop(0, "rgba(226,240,255,.75)");
    moon.addColorStop(0.2, "rgba(180,210,255,.2)");
    moon.addColorStop(1, "rgba(160,200,255,0)");
    x.fillStyle = moon;
    x.fillRect(0, 0, w, h);
    const cols = ["rgba(255,214,150,", "rgba(160,210,255,", "rgba(255,170,190,", "rgba(200,255,240,"];
    for (let i = 0; i < 90; i++) {
      const cx = Math.random() * w;
      const cy = h * 0.5 + Math.random() * h * 0.5;
      const r = rand(2, 13);
      const b = rand(0.25, 0.9);
      const c2 = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      c2.addColorStop(0, pickOne(cols) + b + ")");
      c2.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = c2;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    for (let i = 0; i < 26; i++) {
      x.fillStyle = `rgba(8,14,26,${rand(0.5, 0.9)})`;
      const bw = rand(20, 70), bh = rand(30, 120);
      x.fillRect(Math.random() * w, h - bh - rand(0, 40), bw, bh);
    }
  });
}

function signTexture(text) {
  return canvasTex(1024, 220, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.font = "700 92px 'Pretendard','Segoe UI',system-ui,sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.letterSpacing = "18px";
    x.shadowColor = "rgba(230,196,138,.85)";
    x.shadowBlur = 26;
    x.fillStyle = "#f0d6a4";
    x.fillText(text, w / 2, h / 2);
  });
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      if (!m || m.userData.shared) return;
      Object.keys(m).forEach((k) => {
        const v = m[k];
        if (v && v.isTexture && v !== DOT_TEX && v !== GLOW_TEX) v.dispose();
      });
      m.dispose();
    });
  });
}

/* ============================================================ */

export function createShowroom(opts = {}) {
  const { canvas, container, onPersonClick } = opts;
  if (!canvas || !container) throw new Error("showroom: missing canvas/container");
  const reduced = !!opts.reducedMotion;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (err) {
    if (opts.onFail) opts.onFail(err);
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060a);
  scene.fog = new THREE.Fog(0x04060a, 34, 78);

  const camera = new THREE.PerspectiveCamera(48, 1.7, 0.1, 120);
  camera.position.set(...CAMERAS.overview.pos);
  camera.lookAt(new THREE.Vector3(...CAMERAS.overview.target));

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "label-layer";
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  controls.minDistance = 4.2;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = 1.46;
  controls.target.set(...CAMERAS.overview.target);
  controls.addEventListener("start", () => { camTween = null; });

  /* ---------- environment lighting ---------- */

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  try {
    const room = new RoomEnvironment();
    envRT = pmrem.fromScene(room, 0.045);
    scene.environment = envRT.texture;
    if (room.dispose) room.dispose();
  } catch (e) {
    console.warn("env map skipped", e);
  }

  scene.add(new THREE.HemisphereLight(0x3a4a68, 0x05070b, 0.72));
  scene.add(new THREE.AmbientLight(0x2c3648, 0.45));

  /* ---------- shared materials ---------- */

  const MAT = {
    marble: new THREE.MeshPhysicalMaterial({
      map: marbleTexture(), metalness: 0.42, roughness: 0.36,
      clearcoat: 0.45, clearcoatRoughness: 0.3, envMapIntensity: 0.28
    }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.88, roughness: 0.34 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x101419, metalness: 0.25, roughness: 0.72 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x0f141c, metalness: 0.15, roughness: 0.92 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x8fc4ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16,
      envMapIntensity: 1.4, side: THREE.DoubleSide
    }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6c48a, metalness: 0.95, roughness: 0.26 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb95c, emissiveIntensity: 2.4, roughness: 0.4 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xece3d3, metalness: 0.05, roughness: 0.62 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x2a303b, metalness: 0.35, roughness: 0.34 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.05, roughness: 0.95 }),
    fabricWarm: new THREE.MeshStandardMaterial({ color: 0x3b3038, metalness: 0.05, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x3a2a22, metalness: 0.1, roughness: 0.68 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x9ad6ff, emissive: 0x59b8ff, emissiveIntensity: 1.6, roughness: 0.4 })
  };
  // shared across the base scene and seasonal props: never disposed with a season
  Object.values(MAT).forEach((m) => { m.userData.shared = true; });

  const world = new THREE.Group();
  scene.add(world);

  /* ---------- floor & room shell ---------- */

  const floorTex = MAT.marble.map;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3.2, 2.4);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), MAT.marble);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);

  // glossy inlay disc under the main showroom
  const inlay = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 72),
    new THREE.MeshPhysicalMaterial({ color: 0x090c12, metalness: 0.7, roughness: 0.22, envMapIntensity: 0.45 })
  );
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(0, 0.004, 0.4);
  inlay.receiveShadow = true;
  world.add(inlay);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(11.9, 5.8), MAT.wall);
  backWall.position.set(3.55, 2.9, -6.2);
  backWall.receiveShadow = true;
  world.add(backWall);

  const sideWallL = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 5.8), MAT.wall);
  sideWallL.rotation.y = Math.PI / 2;
  sideWallL.position.set(-9.45, 2.9, 0.9);
  world.add(sideWallL);

  const sideWallR = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 5.8), MAT.wall);
  sideWallR.rotation.y = -Math.PI / 2;
  sideWallR.position.set(9.45, 2.9, 0.9);
  world.add(sideWallR);

  // wall base light strips
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x37506e });
  const stripLengths = [[3.55, -6.18, 11.6], [9.43, 0.9, 14.2], [-9.43, 0.9, 14.2]];
  stripLengths.forEach(([x, z, len]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05), stripMat);
    s.position.set(x, 0.09, z);
    s.rotation.y = x > 0 ? -Math.PI / 2 : x < 0 ? Math.PI / 2 : 0;
    if (x === 3.55) s.rotation.y = 0;
    world.add(s);
  });

  // brand sign on the back wall
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 1.03),
    new THREE.MeshBasicMaterial({ map: signTexture("PICKLE MOTORS"), transparent: true, depthWrite: false })
  );
  sign.position.set(3.2, 3.75, -6.15);
  world.add(sign);

  /* ---------- lounge glass wall & night view ---------- */

  const night = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 7),
    new THREE.MeshBasicMaterial({ map: nightTexture() })
  );
  night.position.set(-5.8, 2.6, -7.9);
  world.add(night);

  const paneXs = [-8.25, -6.35, -4.45, -2.55];
  paneXs.forEach((x) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.6), MAT.glass);
    pane.position.set(x, 1.95, -6.16);
    world.add(pane);
  });
  const frameMat = MAT.darkMetal;
  for (let i = 0; i <= paneXs.length; i++) {
    const x = -9.2 + i * 1.9;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.75, 0.09), frameMat);
    mullion.position.set(x, 1.95, -6.15);
    world.add(mullion);
  }
  [0.12, 1.95, 3.78].forEach((y) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.07, 0.09), frameMat);
    rail.position.set(-5.85, y, -6.15);
    world.add(rail);
  });

  /* ---------- ceiling fittings ---------- */

  function ceilingSpot(x, z, y, color, intensity, radius, height, withShadow) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 6), MAT.darkMetal);
    stem.position.y = y + 1.0;
    g.add(stem);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.3, 20, 1, true), MAT.darkMetal);
    shade.position.y = y;
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.21, 20), new THREE.MeshBasicMaterial({ color }));
    bulb.rotation.x = Math.PI / 2;
    bulb.position.y = y - 0.15;
    g.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.set(1.5, 1.5, 1);
    halo.position.y = y - 0.16;
    g.add(halo);
    const light = new THREE.SpotLight(color, intensity, height + 9, Math.min(0.95, (radius / height) * 1.5), 0.6, 1.2);
    light.position.set(0, y - 0.2, 0);
    light.target.position.set(0, 0, 0.6);
    g.add(light);
    g.add(light.target);
    if (withShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.6;
      light.shadow.camera.far = height + 10;
      light.shadow.bias = -0.0012;
      light.shadow.radius = 3;
    }
    // soft pool of light on the floor
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 1.15, 48),
      new THREE.MeshBasicMaterial({
        map: GLOW_TEX, color, transparent: true, opacity: 0.12,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.016, 0.4);
    g.add(pool);
    world.add(g);
    return g;
  }

  ceilingSpot(0, 0.7, 4.7, 0xfff0d4, 165, 3.4, 4.7, true);
  ceilingSpot(5.9, 1.2, 4.3, 0xffd6a2, 44, 2.4, 4.3, false);
  ceilingSpot(-5.9, 1.4, 4.3, 0xffcfa0, 38, 2.4, 4.3, false);

  /* ---------- main showroom: turntable + car ---------- */

  const platform = new THREE.Group();
  platform.position.copy(ZONE_CENTERS.showroom);
  world.add(platform);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.16, 0.16, 72), MAT.darkMetal);
  base.position.y = 0.08;
  base.receiveShadow = true;
  platform.add(base);

  const ringGlow = new THREE.Mesh(
    new THREE.TorusGeometry(3.02, 0.028, 8, 110),
    new THREE.MeshBasicMaterial({ color: 0xffc978 })
  );
  ringGlow.rotation.x = Math.PI / 2;
  ringGlow.position.y = 0.17;
  platform.add(ringGlow);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.88, 2.88, 0.05, 72),
    new THREE.MeshPhysicalMaterial({ color: 0x07090d, metalness: 0.95, roughness: 0.08, envMapIntensity: 1.6 })
  );
  disc.position.y = 0.205;
  disc.receiveShadow = true;
  platform.add(disc);

  const poolGlow = new THREE.Mesh(
    new THREE.CircleGeometry(5.6, 64),
    new THREE.MeshBasicMaterial({
      map: GLOW_TEX, color: 0xffbf72, transparent: true, opacity: 0.16,
      depthWrite: false, blending: THREE.AdditiveBlending
    })
  );
  poolGlow.rotation.x = -Math.PI / 2;
  poolGlow.position.set(0, 0.012, 0.8);
  world.add(poolGlow);

  function buildCar() {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({
      color: 0x17493c, metalness: 0.9, roughness: 0.19,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.9
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x1b3a52, metalness: 0.5, roughness: 0.03, transparent: true,
      opacity: 0.92, envMapIntensity: 2.8
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0c0f14, metalness: 0.6, roughness: 0.5 });

    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-2.12, 0.30);
    bodyShape.lineTo(-2.2, 0.48);
    bodyShape.lineTo(-2.1, 0.7);
    bodyShape.quadraticCurveTo(-1.82, 0.86, -1.4, 0.88);
    bodyShape.lineTo(-1.02, 0.9);
    bodyShape.lineTo(0.98, 0.9);
    bodyShape.quadraticCurveTo(1.4, 0.9, 1.66, 0.82);
    bodyShape.quadraticCurveTo(2.04, 0.74, 2.14, 0.6);
    bodyShape.lineTo(2.18, 0.44);
    bodyShape.lineTo(2.1, 0.3);
    bodyShape.lineTo(1.9, 0.26);
    bodyShape.lineTo(-1.9, 0.26);
    bodyShape.closePath();

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 1.84, bevelEnabled: true, bevelThickness: 0.075,
      bevelSize: 0.085, bevelSegments: 3, curveSegments: 12
    });
    bodyGeo.translate(0, 0, -0.92);
    const body = new THREE.Mesh(bodyGeo, paint);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(-1.0, 0.86);
    cabinShape.quadraticCurveTo(-0.86, 1.28, -0.42, 1.34);
    cabinShape.lineTo(0.3, 1.36);
    cabinShape.quadraticCurveTo(0.82, 1.3, 1.1, 0.86);
    cabinShape.closePath();
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
      depth: 1.66, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2
    });
    cabinGeo.translate(0, 0, -0.83);
    const cabin = new THREE.Mesh(cabinGeo, glass);
    cabin.castShadow = true;
    g.add(cabin);

    const roof = new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.07, 1.62, 3, 0.03), paint);
    roof.position.set(-0.04, 1.36, 0);
    g.add(roof);

    // shoulders / side line
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.045, 0.03), MAT.gold);
    shoulderL.position.set(0.1, 0.86, 0.94);
    g.add(shoulderL);
    const shoulderR = shoulderL.clone();
    shoulderR.position.z = -0.94;
    g.add(shoulderR);

    // wheels
    const tireGeo = new THREE.TorusGeometry(0.375, 0.088, 12, 30);
    const rimGeo = new THREE.CylinderGeometry(0.268, 0.268, 0.17, 26);
    const rimLipGeo = new THREE.TorusGeometry(0.262, 0.028, 8, 28);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.96, metalness: 0.04 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc2cad6, metalness: 0.95, roughness: 0.28 });
    const discMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.75, roughness: 0.42 });
    const spokeGeo = new THREE.BoxGeometry(0.44, 0.062, 0.05);
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xe0a850, metalness: 0.7, roughness: 0.35, emissive: 0x2a1a04 });
    [[1.42, 0.95], [1.42, -0.95], [-1.42, 0.95], [-1.42, -0.95]].forEach(([x, z]) => {
      const w = new THREE.Group();
      w.position.set(x, 0.465, z);
      const side = z > 0 ? 1 : -1;
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      w.add(tire);
      const disc = new THREE.Mesh(rimGeo, discMat);
      disc.rotation.x = Math.PI / 2;
      w.add(disc);
      const lip = new THREE.Mesh(rimLipGeo, rimMat);
      lip.rotation.x = Math.PI / 2;
      lip.position.z = side * 0.075;
      w.add(lip);
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.rotation.z = (i / 5) * TAU;
        spoke.position.z = side * 0.085;
        w.add(spoke);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), rimMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = side * 0.095;
      w.add(hub);
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.06), caliperMat);
      caliper.position.set(-0.02, 0.19, side * 0.05);
      w.add(caliper);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.045, 8, 20, Math.PI), trim);
      arch.position.z = side * 0.055;
      w.add(arch);
      g.add(w);
    });

    // nose & tail details
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 1.25), trim);
    grille.position.set(2.16, 0.42, 0);
    g.add(grille);

    const bumper = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.16, 1.7, 3, 0.05), trim);
    bumper.position.set(2.02, 0.2, 0);
    g.add(bumper);
    const diffuser = bumper.clone();
    diffuser.position.x = -2.02;
    g.add(diffuser);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xfff0c8, emissiveIntensity: 3.2, roughness: 0.3 });
    [-0.62, 0.62].forEach((z) => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.44), headMat);
      h.position.set(2.12, 0.68, z);
      g.add(h);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEX, color: 0xfff2d2, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(1.5, 1.5, 1);
      glow.position.set(2.36, 0.68, z);
      g.add(glow);
    });

    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff4b3a, emissive: 0xff2e1f, emissiveIntensity: 2.6, roughness: 0.35 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 1.5), tailMat);
    tail.position.set(-2.2, 0.62, 0);
    g.add(tail);
    const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color: 0xff3a26, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    tailGlow.scale.set(2.4, 1.2, 1);
    tailGlow.position.set(-2.42, 0.6, 0);
    g.add(tailGlow);

    [-0.98, 0.98].forEach((z) => {
      const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.26, 3, 0.03), paint);
      mirror.position.set(0.86, 1.0, z);
      g.add(mirror);
    });

    // soft under-car glow on the turntable
    const under = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color: 0x66d8c8, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    under.scale.set(6.4, 3.2, 1);
    under.position.set(0, 0.06, 0);
    under.material.rotation = Math.PI / 2;
    g.add(under);

    return g;
  }

  const carPivot = new THREE.Group();
  carPivot.position.set(0, 0.225, 0);
  carPivot.add(buildCar());
  platform.add(carPivot);

  /* ---------- consultation table ---------- */

  const desk = new THREE.Group();
  desk.position.copy(ZONE_CENTERS.desk);
  world.add(desk);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.075, 48), MAT.charcoal);
  tableTop.position.y = 0.74;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  desk.add(tableTop);

  const tableEdge = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.022, 8, 64), MAT.gold);
  tableEdge.rotation.x = Math.PI / 2;
  tableEdge.position.y = 0.745;
  desk.add(tableEdge);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.7, 18), MAT.darkMetal);
  pedestal.position.y = 0.38;
  desk.add(pedestal);
  const tableFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.045, 32), MAT.darkMetal);
  tableFoot.position.y = 0.025;
  desk.add(tableFoot);

  // tablet + brochures
  const tablet = new THREE.Group();
  const tabletBody = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.02, 0.32, 3, 0.015), MAT.darkMetal);
  tablet.add(tabletBody);
  const tabletScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), MAT.screen);
  tabletScreen.rotation.x = -Math.PI / 2;
  tabletScreen.position.y = 0.012;
  tablet.add(tabletScreen);
  tablet.position.set(-0.32, 0.79, 0.05);
  tablet.rotation.z = 0.02;
  tablet.rotation.x = -0.12;
  desk.add(tablet);

  [[0.34, -0.12, 0.3], [0.44, 0.18, -0.5]].forEach(([x, z, r]) => {
    const sheet = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.008, 0.42, 2, 0.006), MAT.cream);
    sheet.position.set(x, 0.785, z);
    sheet.rotation.y = r;
    desk.add(sheet);
  });

  const cupMat = MAT.cream;
  [[0.55, 0.42], [0.72, 0.3]].forEach(([x, z]) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.09, 14), cupMat);
    cup.position.set(x, 0.82, z);
    desk.add(cup);
  });

  // chairs around the table
  function buildChair(fabric) {
    const c = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.1, 0.6, 4, 0.05), fabric);
    seat.position.y = 0.45;
    seat.castShadow = true;
    c.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.56, 0.09, 4, 0.045), fabric);
    back.position.set(0, 0.73, -0.27);
    back.rotation.x = -0.1;
    back.castShadow = true;
    c.add(back);
    const legGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 8);
    [[-0.25, -0.24], [0.25, -0.24], [-0.25, 0.24], [0.25, 0.24]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, MAT.darkMetal);
      leg.position.set(x, 0.225, z);
      c.add(leg);
    });
    return c;
  }

  [75, 195, 315].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const chair = buildChair(i % 2 ? MAT.fabric : MAT.fabricWarm);
    chair.position.set(Math.sin(a) * 1.86, 0, Math.cos(a) * 1.86);
    chair.rotation.y = a + Math.PI;
    desk.add(chair);
  });

  // pendant lamp over the table
  const pendantStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), MAT.darkMetal);
  pendantStem.position.set(0, 3.55, 0);
  desk.add(pendantStem);
  const pendantShade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.42, 0.34, 24, 1, true), MAT.gold);
  pendantShade.position.set(0, 2.85, 0);
  desk.add(pendantShade);
  const pendantBulb = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: 0xffd9a8 }));
  pendantBulb.rotation.x = Math.PI / 2;
  pendantBulb.position.set(0, 2.7, 0);
  desk.add(pendantBulb);
  const pendantLight = new THREE.PointLight(0xffcf9a, 12, 8, 2);
  pendantLight.position.set(0, 2.5, 0);
  desk.add(pendantLight);

  // small plant on the desk zone floor
  const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.42, 18), MAT.charcoal);
  plantPot.position.set(1.85, 0.21, -1.05);
  desk.add(plantPot);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.85, 5), new THREE.MeshStandardMaterial({
      color: 0x1f6b4d, roughness: 0.8, metalness: 0.05
    }));
    const a = (i / 7) * TAU;
    leaf.position.set(1.85 + Math.cos(a) * 0.12, 0.72, -1.05 + Math.sin(a) * 0.12);
    leaf.rotation.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
    desk.add(leaf);
  }

  /* ---------- customer lounge ---------- */

  const lounge = new THREE.Group();
  lounge.position.copy(ZONE_CENTERS.lounge);
  world.add(lounge);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 48),
    new THREE.MeshStandardMaterial({ color: 0x1d222c, roughness: 0.98, metalness: 0 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, 0.1);
  rug.receiveShadow = true;
  lounge.add(rug);

  // sofa (facing +z)
  const sofa = new THREE.Group();
  sofa.position.set(0, 0, -0.78);
  const sofaSeat = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.34, 1.0, 4, 0.08), MAT.fabric);
  sofaSeat.position.y = 0.4;
  sofaSeat.castShadow = true;
  sofaSeat.receiveShadow = true;
  sofa.add(sofaSeat);
  const sofaBack = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.78, 0.28, 4, 0.09), MAT.fabric);
  sofaBack.position.set(0, 0.82, -0.48);
  sofaBack.castShadow = true;
  sofa.add(sofaBack);
  [-1.5, 1.5].forEach((x) => {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.56, 1.0, 4, 0.08), MAT.fabric);
    arm.position.set(x, 0.6, 0);
    arm.castShadow = true;
    sofa.add(arm);
  });
  [-0.97, 0, 0.97].forEach((x) => {
    const cush = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.16, 0.86, 4, 0.07), MAT.fabricWarm);
    cush.position.set(x, 0.63, 0.02);
    sofa.add(cush);
    const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.14, 3, 0.05), MAT.gold);
    pillow.position.set(x * 0.9, 0.82, -0.3);
    pillow.rotation.z = rand(-0.2, 0.2);
    sofa.add(pillow);
  });
  lounge.add(sofa);

  // coffee table
  const coffeeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.06, 40), MAT.wood);
  coffeeTop.position.set(0, 0.36, 0.9);
  coffeeTop.castShadow = true;
  lounge.add(coffeeTop);
  [[-0.5, 0.42], [0.5, 0.42], [0, 1.36]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), MAT.darkMetal);
    leg.position.set(x, 0.18, z);
    lounge.add(leg);
  });
  const tray = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.03, 0.3, 2, 0.02), MAT.gold);
  tray.position.set(-0.1, 0.4, 0.86);
  lounge.add(tray);
  [[-0.16, 0.84], [0.02, 0.9]].forEach(([x, z]) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 14), MAT.cream);
    cup.position.set(x, 0.45, z);
    lounge.add(cup);
  });

  // two armchairs
  function armchair() {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.3, 0.85, 4, 0.08), MAT.fabricWarm);
    seat.position.y = 0.4;
    seat.castShadow = true;
    g.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.62, 0.2, 4, 0.07), MAT.fabricWarm);
    back.position.set(0, 0.76, -0.36);
    back.castShadow = true;
    g.add(back);
    [-0.44, 0.44].forEach((x) => {
      const arm = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.42, 0.85, 3, 0.06), MAT.fabricWarm);
      arm.position.set(x, 0.55, 0);
      g.add(arm);
    });
    return g;
  }
  [[-1.55, 1.75, 0.6], [1.55, 1.75, -0.6]].forEach(([x, z, ry]) => {
    const ch = armchair();
    ch.position.set(x, 0, z);
    ch.rotation.y = ry;
    lounge.add(ch);
  });

  // bar counter along the left wall
  const bar = new THREE.Group();
  bar.position.set(-2.95, 0, -1.9);
  const barBody = new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.02, 3.1, 4, 0.05), MAT.charcoal);
  barBody.position.y = 0.51;
  barBody.castShadow = true;
  bar.add(barBody);
  const barTop = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.07, 3.24, 3, 0.03), MAT.stone);
  barTop.position.y = 1.06;
  bar.add(barTop);
  const barShelf = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.06, 3.0, 2, 0.02), MAT.wood);
  barShelf.position.set(-0.42, 1.62, 0);
  bar.add(barShelf);
  const shelfGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.02), new THREE.MeshBasicMaterial({ color: 0xffb06a }));
  shelfGlow.rotation.x = Math.PI / 2;
  shelfGlow.position.set(-0.42, 1.66, 0);
  bar.add(shelfGlow);

  const bottleColors = [0x2f6b4d, 0x7a4a1e, 0x2c3f6b, 0x6b2f4a, 0x9c7a3a];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, rand(0.22, 0.34), 12), new THREE.MeshStandardMaterial({
      color: pickOne(bottleColors), metalness: 0.2, roughness: 0.35
    }));
    b.position.set(-0.42, 1.8, -1.2 + i * 0.3);
    bar.add(b);
  }

  // espresso machine
  const machine = new THREE.Group();
  machine.position.set(0.02, 1.1, -1.0);
  const mBody = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 0.5, 4, 0.05), MAT.darkMetal);
  mBody.position.y = 0.21;
  machine.add(mBody);
  const mTop = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.05, 0.54, 3, 0.02), MAT.gold);
  mTop.position.y = 0.44;
  machine.add(mTop);
  [[-0.1, 0.18], [0.12, 0.18]].forEach(([x, z]) => {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 14), MAT.gold);
    head.position.set(x, 0.02, z);
    machine.add(head);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), MAT.darkMetal);
    spout.position.set(x, -0.06, z);
    machine.add(spout);
  });
  bar.add(machine);

  // cups stacked
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.07, 14), MAT.cream);
    cup.position.set(0.05, 1.14 + i * 0.075, 0.5);
    bar.add(cup);
  }

  lounge.add(bar);

  // floor lamp
  const lampGroup = new THREE.Group();
  lampGroup.position.set(-1.35, 0, 2.5);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.9, 10), MAT.darkMetal);
  lampPole.position.y = 0.95;
  lampGroup.add(lampPole);
  const lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 20), MAT.darkMetal);
  lampFoot.position.y = 0.02;
  lampGroup.add(lampFoot);
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.38, 24, 1, true), MAT.cream);
  lampShade.position.y = 1.94;
  lampGroup.add(lampShade);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe0b0 }));
  lampBulb.position.y = 1.86;
  lampGroup.add(lampBulb);
  const lampLight = new THREE.PointLight(0xffc98e, 9, 6.5, 2);
  lampLight.position.y = 1.8;
  lampGroup.add(lampLight);
  lounge.add(lampGroup);

  /* ---------- zone markers (CSS2D) ---------- */

  const zoneLabels = {};
  Object.keys(ZONE_FLAGS).forEach((id) => {
    const el = document.createElement("div");
    el.className = "zone-flag";
    const ico = document.createElement("span");
    ico.className = "zone-flag-icon";
    ico.textContent = ZONE_FLAGS[id].icon;
    const nm = document.createElement("span");
    nm.textContent = ZONE_FLAGS[id].name;
    el.append(ico, nm);
    const obj = new CSS2DObject(el);
    const c = ZONE_CENTERS[id];
    obj.position.set(c.x, id === "showroom" ? 3.7 : 3.2, c.z - (id === "lounge" ? 0.2 : 0.6));
    scene.add(obj);
    zoneLabels[id] = obj;
  });

  /* ---------- season system ---------- */

  let seasonGroup = null;
  let seasonHooks = [];
  let falls = [];
  let accentLights = [];
  let currentSeason = "auto";
  const seasonLight = new THREE.PointLight(0xffb066, 0, 26, 2);
  seasonLight.position.set(-3, 3.4, 1.5);
  scene.add(seasonLight);

  function addAccentLight(color, intensity, pos, distance) {
    const l = new THREE.PointLight(color, intensity, distance || 12, 2);
    l.position.copy(pos);
    seasonGroup.add(l);
    accentLights.push(l);
    return l;
  }

  function glow(color, size, opacity, pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.set(size, size, 1);
    s.position.copy(pos);
    seasonGroup.add(s);
    return s;
  }

  function falling({ count, palette, size, speedMin, speedMax, sway, area }) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const baseX = new Float32Array(count);
    const spd = new Float32Array(count);
    const ph = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = rand(area.x[0], area.x[1]);
      pos[i * 3] = x;
      pos[i * 3 + 1] = rand(area.y[0], area.y[1]);
      pos[i * 3 + 2] = rand(area.z[0], area.z[1]);
      baseX[i] = x;
      c.set(pickOne(palette));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      spd[i] = rand(speedMin, speedMax);
      if (reduced) spd[i] = 0;
      ph[i] = Math.random() * TAU;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, map: DOT_TEX, vertexColors: true, transparent: true,
      depthWrite: false, opacity: 0.9, sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    seasonGroup.add(pts);
    falls.push({ pts, pos, baseX, spd, ph, sway, area, reduced });
    return pts;
  }

  function christmasTree(x, z, scale) {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.6, 12), MAT.wood);
    trunk.position.y = 0.3;
    t.add(trunk);
    const green = new THREE.MeshStandardMaterial({ color: 0x0d4a33, roughness: 0.82, metalness: 0.05 });
    const layers = [[1.55, 1.5, 0.9], [1.2, 1.35, 1.75], [0.85, 1.2, 2.55], [0.5, 0.95, 3.25]];
    layers.forEach(([r, h, y]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 26), green);
      cone.position.y = y;
      cone.castShadow = true;
      t.add(cone);
    });
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 3 });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), starMat);
    star.position.y = 3.95;
    t.add(star);
    const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color: 0xffd98a, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    starGlow.scale.set(1.7, 1.7, 1);
    starGlow.position.y = 3.95;
    t.add(starGlow);
    t.userData.spin = star;

    // ornaments
    const ornColors = [0xff5d4a, 0xffd166, 0x8ee6c4, 0xf0f4ff, 0xff9ec8];
    const ornGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const orn = new THREE.InstancedMesh(ornGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.4, emissive: 0x111111 }), 34);
    const dummy = new THREE.Object3D();
    const cc = new THREE.Color();
    for (let i = 0; i < 34; i++) {
      const ly = rand(0.75, 3.5);
      const lr = Math.max(0.12, 1.62 - (ly - 0.75) * 0.47) * 0.92;
      const a = Math.random() * TAU;
      dummy.position.set(Math.cos(a) * lr, ly, Math.sin(a) * lr);
      dummy.updateMatrix();
      orn.setMatrixAt(i, dummy.matrix);
      cc.set(pickOne(ornColors));
      orn.setColorAt(i, cc);
    }
    t.add(orn);

    // spiral string lights
    const bulbGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial(), 54);
    for (let i = 0; i < 54; i++) {
      const ly = 0.8 + (i / 54) * 2.9;
      const lr = Math.max(0.08, 1.58 - (ly - 0.8) * 0.44);
      const a = i * 0.95;
      dummy.position.set(Math.cos(a) * lr, ly, Math.sin(a) * lr);
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
      cc.set(pickOne([0xffd98a, 0xff8a6a, 0xa8f0d6]));
      bulbs.setColorAt(i, cc);
    }
    t.add(bulbs);

    seasonGroup.add(t);
    return t;
  }

  function giftBox(x, z, size, color) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(size, size * 0.8, size, 3, 0.02), new THREE.MeshStandardMaterial({
      color, roughness: 0.5, metalness: 0.15
    }));
    box.position.y = size * 0.4;
    box.castShadow = true;
    g.add(box);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.82, size * 0.16), MAT.gold);
    ribbon.position.y = size * 0.4;
    g.add(ribbon);
    const ribbon2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 0.82, size * 1.02), MAT.gold);
    ribbon2.position.y = size * 0.4;
    g.add(ribbon2);
    g.position.set(x, 0, z);
    g.rotation.y = rand(-0.6, 0.6);
    seasonGroup.add(g);
    return g;
  }

  function stringLights(from, to, sag, count) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 5, false), new THREE.MeshStandardMaterial({
      color: 0x1d2a22, roughness: 0.8
    }));
    seasonGroup.add(tube);
    const bulbGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial(), count);
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const p = curve.getPoint(i / (count - 1));
      dummy.position.copy(p);
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
      c.set(pickOne([0xffd98a, 0xff8a6a, 0xa8f0d6, 0xfff4d2]));
      bulbs.setColorAt(i, c);
    }
    seasonGroup.add(bulbs);
    for (let i = 0; i < count; i += 5) {
      const p = curve.getPoint(i / (count - 1));
      glow(0xffcf8a, 0.9, 0.35, p.clone().add(new THREE.Vector3(0, 0.03, 0)));
    }
  }

  function winterLantern(x, z, y, color) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.4, 5), MAT.darkMetal);
    cord.position.y = 0.7;
    g.add(cord);
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.5, roughness: 0.5
    }));
    lan.scale.y = 1.15;
    g.add(lan);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), MAT.gold);
    cap.position.y = 0.28;
    g.add(cap);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.set(1.6, 1.6, 1);
    g.add(halo);
    seasonGroup.add(g);
    return g;
  }

  function pumpkin(x, z, s, lit) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({
      color: 0xd9752b, roughness: 0.75, metalness: 0.05, emissive: lit ? 0x3a1502 : 0x000000,
      emissiveIntensity: lit ? 0.8 : 0
    }));
    body.scale.y = 0.78;
    body.position.y = 0.26;
    body.castShadow = true;
    g.add(body);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8), MAT.wood);
    stem.position.y = 0.55;
    g.add(stem);
    if (lit) {
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
      [-0.12, 0.12].forEach((dx) => {
        const eye = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 3), eyeMat);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(dx, 0.32, 0.3);
        g.add(eye);
      });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.02), eyeMat);
      mouth.position.set(0, 0.2, 0.32);
      g.add(mouth);
      const pl = new THREE.PointLight(0xff9a3c, 2.2, 2.4, 2);
      pl.position.set(0, 0.28, 0.2);
      g.add(pl);
    }
    seasonGroup.add(g);
    return g;
  }

  function palm(x, z, s) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.9 });
    let prevY = 0;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.11 - i * 0.012, 0.13 - i * 0.012, 0.55, 8), trunkMat);
      seg.position.set(Math.sin(i * 0.35) * 0.12, prevY + 0.27, 0);
      seg.rotation.z = Math.sin(i * 0.35) * 0.08;
      g.add(seg);
      prevY += 0.5;
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x257d55, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.9, 4, 1, true), leafMat);
      leaf.position.set(Math.sin(0.5) * 0.12 + Math.cos(a) * 0.6, prevY + 0.25, Math.sin(a) * 0.6);
      leaf.rotation.set(Math.cos(a) * 0.85, -a, Math.sin(a) * 0.85);
      g.add(leaf);
    }
    seasonGroup.add(g);
    return g;
  }

  function blossomTree(x, z, s) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 10), MAT.wood);
    trunk.position.y = 1.1;
    g.add(trunk);
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x4a352a, roughness: 0.85 });
    [[0.55, 1.7, 0.3, 0.5], [-0.5, 2.0, -0.2, -0.6], [0.2, 2.35, -0.45, 0.2]].forEach(([x2, y2, z2, rz]) => {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1.0, 8), branchMat);
      br.position.set(x2, y2, z2);
      br.rotation.z = rz;
      g.add(br);
    });
    const blossom = new THREE.MeshStandardMaterial({ color: 0xffb7d6, roughness: 0.85, emissive: 0x3a1424, emissiveIntensity: 0.4 });
    const spots = [[0.9, 2.5, 0.2], [-0.8, 2.7, -0.3], [0.1, 3.1, -0.1], [1.4, 2.2, -0.4], [-1.3, 2.2, 0.4], [0.4, 2.9, 0.6], [-0.4, 3.25, 0.2]];
    spots.forEach(([x2, y2, z2], i) => {
      const cl = new THREE.Mesh(new THREE.SphereGeometry(rand(0.45, 0.66), 12, 10), blossom);
      cl.position.set(x2, y2, z2);
      cl.scale.y = 0.8;
      g.add(cl);
    });
    seasonGroup.add(g);
    return g;
  }

  function buildSeason(id, flags) {
    if (seasonGroup) {
      disposeGroup(seasonGroup);
      scene.remove(seasonGroup);
    }
    seasonGroup = new THREE.Group();
    seasonGroup.name = "season";
    scene.add(seasonGroup);
    seasonHooks = [];
    falls = [];
    accentLights = [];
    const halloween = !!(flags && flags.halloween);

    const colors = {
      christmas: { light: 0xffb066, amber: 0xff7a4d, green: 0x46d69a },
      winter: { light: 0x9fc4ff, amber: 0xffc978, green: 0x8fe0ff },
      spring: { light: 0xff9ec8, amber: 0xffc2d8, green: 0xbaf0d8 },
      summer: { light: 0x4fd8d0, amber: 0x8ff0e6, green: 0x2fbfa8 },
      autumn: { light: 0xffa24d, amber: 0xff8a3d, green: 0xd9b45c }
    }[id] || { light: 0xffc978, amber: 0xffb066, green: 0x8fe0ff };

    seasonLight.color.set(colors.light);
    seasonLight.intensity = id === "spring" ? 16 : id === "summer" ? 14 : 20;

    if (halloween) {
      seasonLight.color.set(0xff8a3c);
    }

    if (id === "christmas") {
      christmasTree(-7.55, -3.45, 1.0);
      [[-6.4, -2.5, 0.62, 0xb3263a], [-6.9, -2.0, 0.46, 0x1f6b4d], [-8.3, -2.5, 0.52, 0xe6c48a], [-5.6, -2.9, 0.38, 0xd8dee8], [-8.6, -4.4, 0.44, 0x2f4f8c]]
        .forEach(([x, z, s, c]) => giftBox(x, z, s, c));
      giftBox(2.4, 3.6, 0.5, 0xb3263a);
      giftBox(3.3, 4.15, 0.36, 0xe6c48a);
      stringLights([-8.9, 3.95, -1.2], [8.9, 3.95, -1.2], 1.5, 76);
      stringLights([-8.9, 3.6, 4.6], [-2.4, 3.6, 4.6], 1.1, 34);
      falling({ count: 1500, palette: [0xffffff, 0xdfefff, 0xcfe6ff], size: 0.085, speedMin: 0.42, speedMax: 1.0, sway: 0.34, area: { x: [-9, 9], y: [0, 5.6], z: [-6, 8] } });
      addAccentLight(0xff5b4a, 14, new THREE.Vector3(-7.4, 1.6, -3.2), 9);
      addAccentLight(0x37d39b, 9, new THREE.Vector3(-6.2, 1.2, -2.2), 7);
      glow(0xffc478, 6.4, 0.2, new THREE.Vector3(-7.4, 0.5, -3.3));
      seasonHooks.push((t) => {
        const tree = seasonGroup.children.find((c) => c.userData.spin);
        if (tree) tree.userData.spin.rotation.y = t * 0.7;
      });
    }

    if (id === "winter") {
      const lanternColors = [0xffc45c, 0xffd98a, 0xffb066];
      [[-7.8, -2.2, 3.6], [-5.6, -2.6, 3.5], [-3.2, -2.4, 3.7], [3.0, -2.6, 3.6], [6.6, -2.4, 3.55]].forEach(([x, z, y], i) => {
        winterLantern(x, z, y, lanternColors[i % 3]);
      });
      stringLights([-8.9, 4.0, -1.4], [8.9, 4.0, -1.4], 1.2, 64);
      falling({ count: 900, palette: [0xffffff, 0xdfefff], size: 0.075, speedMin: 0.35, speedMax: 0.85, sway: 0.3, area: { x: [-9, 9], y: [0, 5.6], z: [-6, 8] } });
      addAccentLight(0xffc978, 12, new THREE.Vector3(-5.9, 2.6, 1.2), 10);
      glow(0xffd9a0, 5.5, 0.16, new THREE.Vector3(-5.8, 0.5, 0.6));
      seasonHooks.push((t) => {
        seasonGroup.children.forEach((c, i) => {
          if (c.children && c.children[1] && c.children[1].material && c.children[1].material.emissiveIntensity !== undefined) {
            c.rotation.z = Math.sin(t * 0.6 + i) * 0.05;
          }
        });
      });
    }

    if (id === "spring") {
      blossomTree(-7.6, -3.5, 1.0);
      blossomTree(7.4, -4.3, 0.8);
      falling({ count: 900, palette: [0xffc6de, 0xffb0d0, 0xffe2ef], size: 0.1, speedMin: 0.28, speedMax: 0.7, sway: 0.85, area: { x: [-9, 9], y: [0, 5.6], z: [-6, 8] } });
      addAccentLight(0xff9ec8, 16, new THREE.Vector3(-6.4, 2.8, -1.4), 12);
      addAccentLight(0xffd6e6, 8, new THREE.Vector3(4.6, 2.6, 2.0), 9);
      glow(0xffb0d0, 6, 0.2, new THREE.Vector3(-6, 0.5, 0.2));
    }

    if (id === "summer") {
      palm(-8.0, 3.6, 1.0);
      palm(7.6, 4.4, 0.85);
      palm(-2.0, -4.6, 0.75);
      addAccentLight(0x4fd8d0, 16, new THREE.Vector3(-1.6, 2.6, 3.0), 12);
      addAccentLight(0x6fd8ff, 10, new THREE.Vector3(4.0, 2.4, -3.0), 10);
      glow(0x59e0d0, 6.5, 0.18, new THREE.Vector3(-5.6, 0.5, 0.6));
    }

    if (id === "autumn") {
      const leaves = [0xd98442, 0xc4672e, 0xe0a33f, 0x9c5a2a];
      falling({ count: 950, palette: leaves, size: 0.11, speedMin: 0.3, speedMax: 0.75, sway: 0.9, area: { x: [-9, 9], y: [0, 5.6], z: [-6, 8] } });
      [[-7.2, -2.9, 0.7, false], [-6.3, -2.4, 0.5, false], [-8.2, -2.6, 0.44, false]].forEach(([x, z, s, lit]) => pumpkin(x, z, s, lit));
      if (halloween) {
        pumpkin(-5.22, -2.2, 0.62, true);
        pumpkin(1.9, 4.2, 0.55, true);
        pumpkin(-8.4, 1.2, 0.5, true);
        addAccentLight(0xff8a3c, 22, new THREE.Vector3(-6.6, 1.0, -2.4), 10);
        glow(0xff8a3c, 5.5, 0.22, new THREE.Vector3(-6.4, 0.4, -2.2));
      }
      addAccentLight(0xffa24d, 14, new THREE.Vector3(-6.2, 2.2, 0.4), 11);
    }

    diagSeason = id + (halloween ? "+halloween" : "");
  }

  let diagSeason = "auto";

  /* ---------- characters ---------- */

  const people = new Map();
  const personRoot = new THREE.Group();
  scene.add(personRoot);

  const SLOTS = {
    showroom: [[-3.35, 4.15], [-1.68, 4.68], [0, 4.95], [1.68, 4.68], [3.35, 4.15], [4.2, 3.0], [-4.2, 3.0]],
    desk: (() => {
      const out = [];
      [30, 150, 270].forEach((d) => {
        const a = (d * Math.PI) / 180;
        out.push([5.9 + Math.sin(a) * 2.18, 1.2 + Math.cos(a) * 2.18]);
      });
      [90, 210, 330].forEach((d) => {
        const a = (d * Math.PI) / 180;
        out.push([5.9 + Math.sin(a) * 3.0, 1.2 + Math.cos(a) * 3.0]);
      });
      return out;
    })(),
    lounge: [[-6.95, 3.05], [-4.85, 3.05], [-7.75, 1.65], [-4.05, 1.65], [-5.9, 3.6], [-7.2, 2.4]]
  };

  function slotFor(zone, index) {
    const list = SLOTS[zone] || SLOTS.showroom;
    if (index < list.length) return list[index];
    const center = ZONE_CENTERS[zone];
    const a = (index * 1.1) % TAU;
    const r = 3.6 + Math.floor(index / list.length) * 0.7;
    return [center.x + Math.sin(a) * r, center.z + Math.cos(a) * r];
  }

  function labelHTML(person) {
    const wrap = document.createElement("div");
    wrap.className = "c3d-label";
    wrap.innerHTML = '<div class="c3d-top"><span class="c3d-dot"></span><span class="c3d-name"></span><span class="c3d-status"></span></div>';
    updateLabel(wrap, person);
    return wrap;
  }

  function updateLabel(el, person) {
    const accent = person.statusColor || "#9aa3b2";
    el.classList.toggle("is-me", !!person.isMe);
    el.querySelector(".c3d-dot").style.background = person.color || "#8b5cf6";
    el.querySelector(".c3d-name").textContent = person.name || "";
    const st = el.querySelector(".c3d-status");
    st.textContent = person.statusLabel || "";
    st.style.color = accent;
    st.style.borderColor = accent + "55";
    st.style.background = accent + "1f";
  }

  function createPerson(p) {
    const group = new THREE.Group();
    const color = new THREE.Color(p.color || "#8b5cf6");
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.34, metalness: 0.08, clearcoat: 0.85, clearcoatRoughness: 0.25,
      envMapIntensity: 0.95, emissive: color.clone().multiplyScalar(0.14)
    });
    const H = 1.06;
    const R = 0.37;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(R, H - R * 2, 8, 26), bodyMat);
    body.position.y = H / 2 + 0.02;
    body.castShadow = true;
    group.add(body);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x121019, roughness: 0.24, metalness: 0.05 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.125, 0.125].forEach((dx) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.098, 18, 14), eyeMat);
      eye.scale.y = 1.12;
      eye.position.set(dx, H * 0.7, R * 0.7);
      group.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), shineMat);
      shine.position.set(dx + 0.028, H * 0.7 + 0.034, R * 0.7 + 0.07);
      group.add(shine);
    });

    // little feet shadow
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 32), new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0, side: THREE.DoubleSide
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    group.add(ring);

    const el = labelHTML(p);
    const label = new CSS2DObject(el);
    label.center.set(0.5, 1);
    label.position.set(0, H + 0.14, 0);
    group.add(label);
    group.scale.setScalar(CHAR_SCALE);

    const anchor = new THREE.Vector3(group.position.x, 0, group.position.z);
    const rec = {
      pid: p.pid, group, body, label, el, ring, anchor, labelBaseY: H + 0.14,
      yaw: 0, targetYaw: 0, phase: Math.random() * TAU,
      person: { ...p }
    };
    group.userData.pid = p.pid;
    personRoot.add(group);
    return rec;
  }

  function updatePersonVisual(rec, p) {
    rec.person = { ...rec.person, ...p };
    updateLabel(rec.el, rec.person);
    rec.ring.material.opacity = p.isMe ? 0.85 : 0;
    rec.body.material.color.set(p.color || "#8b5cf6");
    rec.body.material.emissive.copy(new THREE.Color(p.color || "#8b5cf6").multiplyScalar(0.14));
  }

  function placePerson(p, zone, index) {
    let rec = people.get(p.pid);
    if (!rec) {
      rec = createPerson(p);
      people.set(p.pid, rec);
      const s0 = slotFor(zone, index);
      rec.group.position.set(s0[0], 0, s0[1]);
      rec.anchor.set(s0[0], 0, s0[1]);
    } else {
      updatePersonVisual(rec, p);
    }
    const [x, z] = slotFor(zone, index);
    rec.targetZone = zone;
    rec.anchorTarget = new THREE.Vector3(x, 0, z);
    rec.label.position.y = rec.labelBaseY + (index % 2) * 0.52;
    const face = FACE_TARGET[zone] || FACE_TARGET.showroom;
    rec.targetYaw = Math.atan2(face.x - x, face.z - z);
  }

  function removePerson(rec) {
    personRoot.remove(rec.group);
    if (rec.el && rec.el.parentNode) rec.el.remove();
    disposeGroup(rec.group);
  }

  // initialise rec position so the first lerp is stable
  const _origPlace = placePerson;

  function syncPeople(list) {
    const seen = new Set();
    const buckets = { showroom: [], desk: [], lounge: [] };
    (list || []).forEach((p) => {
      if (!p || !p.pid) return;
      seen.add(p.pid);
      const zone = buckets[p.zone] ? p.zone : "showroom";
      buckets[zone].push(p);
    });
    Object.keys(buckets).forEach((zone) => {
      buckets[zone].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      buckets[zone].forEach((p, i) => _origPlace(p, zone, i));
    });
    people.forEach((rec, pid) => {
      if (!seen.has(pid)) {
        removePerson(rec);
        people.delete(pid);
      }
    });
  }

  /* ---------- camera presets ---------- */

  let camTween = null;

  function fitFactor() {
    const a = camera.aspect || 1.7;
    if (a < 0.9) return 1.5;
    if (a < 1.2) return 1.28;
    if (a < 1.55) return 1.1;
    return 1;
  }

  function focusZone(name) {
    const preset = CAMERAS[name] || CAMERAS.overview;
    const target = new THREE.Vector3(...preset.target);
    const desired = new THREE.Vector3(...preset.pos);
    const f = name === "overview" ? fitFactor() : Math.min(fitFactor(), 1.25);
    desired.sub(target).multiplyScalar(f).add(target);
    camTween = {
      t: 0, dur: 0.95,
      p0: camera.position.clone(), p1: desired,
      t0: controls.target.clone(), t1: target
    };
  }

  /* ---------- pointer picking ---------- */

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;

  function onDown(e) {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  }
  function onUp(e) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved > 7 || dt > 700) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(personRoot.children, true);
    if (!hits.length) return;
    let node = hits[0].object;
    while (node && !node.userData.pid) node = node.parent;
    if (!node) return;
    const rec = people.get(node.userData.pid);
    if (rec && onPersonClick) onPersonClick(rec.person);
  }

  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  /* ---------- resize & loop ---------- */

  function resize() {
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 520 ? 60 : w < 760 ? 54 : 48;
    camera.updateProjectionMatrix();
    labelRenderer.setSize(w, h);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  let elapsed = 0;
  let running = true;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.06);
    elapsed += dt;

    if (camTween) {
      camTween.t += dt / camTween.dur;
      const k = camTween.t >= 1 ? 1 : 1 - Math.pow(1 - camTween.t, 3);
      camera.position.lerpVectors(camTween.p0, camTween.p1, k);
      controls.target.lerpVectors(camTween.t0, camTween.t1, k);
      if (camTween.t >= 1) camTween = null;
    }
    controls.update();

    if (!reduced) {
      carPivot.rotation.y += dt * 0.055;
    }

    people.forEach((rec) => {
      if (rec.anchorTarget) {
        const k = 1 - Math.pow(0.0012, dt);
        rec.anchor.lerp(rec.anchorTarget, k);
      }
      const bob = reduced ? 0 : Math.sin(elapsed * 1.7 + rec.phase) * 0.035;
      const breathe = reduced ? 1 : 1 + Math.sin(elapsed * 1.45 + rec.phase) * 0.018;
      rec.group.position.set(rec.anchor.x, bob, rec.anchor.z);
      const side = CHAR_SCALE / Math.sqrt(breathe);
      rec.group.scale.set(side, CHAR_SCALE * breathe, side);
      let dy = rec.targetYaw - rec.yaw;
      while (dy > Math.PI) dy -= TAU;
      while (dy < -Math.PI) dy += TAU;
      rec.yaw += dy * Math.min(1, dt * 4);
      rec.group.rotation.y = rec.yaw;
      if (rec.ring.material.opacity > 0) {
        const s = 1 + Math.sin(elapsed * 2.2) * 0.05;
        rec.ring.scale.set(s, s, s);
      }
    });

    for (let i = 0; i < falls.length; i++) {
      const f = falls[i];
      const arr = f.pos;
      const lt = f.reduced ? 0 : elapsed;
      for (let j = 0; j < f.spd.length; j++) {
        const j3 = j * 3;
        arr[j3] = f.baseX[j] + Math.sin(lt * 0.7 + f.ph[j]) * f.sway;
        arr[j3 + 1] -= f.spd[j] * dt;
        if (arr[j3 + 1] < f.area.y[0]) {
          arr[j3 + 1] = f.area.y[1];
          arr[j3] = rand(f.area.x[0], f.area.x[1]);
          f.baseX[j] = arr[j3];
        }
      }
      f.pts.geometry.attributes.position.needsUpdate = true;
    }

    seasonHooks.forEach((fn) => {
      try { fn(elapsed); } catch (e) { /* keep the frame alive */ }
    });

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // warm start
  buildSeason("christmas", {});
  resize();
  raf = requestAnimationFrame(frame);

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // expose scene for debugging by the page (no personal data)
  container.dataset.stage = "3d";

  return {
    syncPeople,
    setSeason(id, flags) {
      currentSeason = id || "christmas";
      buildSeason(currentSeason, flags || {});
      return diagSeason;
    },
    focusZone,
    get season() { return diagSeason; },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      if (seasonGroup) disposeGroup(seasonGroup);
      people.forEach((rec) => disposeGroup(rec.group));
      people.clear();
      disposeGroup(world);
      if (envRT) envRT.dispose?.();
      pmrem.dispose();
      renderer.dispose();
      labelRenderer.domElement.remove();
    }
  };
}
