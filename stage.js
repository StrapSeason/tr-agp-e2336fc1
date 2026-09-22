// Agusha OTG'27 treatment site — 3D.
// Two layers:
//  · BACKGROUND props (kigurumi on 01, tube on 03, backpack on 07, bucket on 09) are drawn into a small canvas
//    INSIDE their slide, above the photos and under the text/cards — they sit behind the words, muted, and make
//    one soft gesture when the slide arrives. Rendered only while they move.
//  · TRANSITION props (the tube resting on 06 that lifts into the iris, the iris itself, the circle rhyme into 11)
//    live on the fixed #stage canvas: on top of the page, and under the slides while a pinned scene runs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

(function main() {
  const canvas = document.getElementById('stage');
  const S = window.SCENE || {};
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = innerWidth < 700;
  const DPR = Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.5);
  let dirty = true, wasEmpty = false;

  const makeRenderer = (el) => {
    const r = new THREE.WebGLRenderer({ canvas: el || undefined, alpha: true, antialias: true, preserveDrawingBuffer: !el });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02; r.setClearColor(0x000000, 0); return r;
  };
  const makeScene = (r) => {
    const sc = new THREE.Scene();
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xfff1e0, 1.5); key.position.set(-4, 6, 7); sc.add(key);
    sc.add(new THREE.HemisphereLight(0xfffaf2, 0xd9ccb8, 0.55));
    return sc;
  };
  let renderer, tiles;
  try { renderer = makeRenderer(canvas); tiles = makeRenderer(null); } catch (e) { canvas.remove(); return; }
  if (navigator.connection?.saveData) { canvas.remove(); return; }
  renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight, false);
  const stageScene = makeScene(renderer), tileScene = makeScene(tiles);

  /* ---------- stage camera (screen px ↔ world) ---------- */
  const FOV = 30, CAMZ = 10, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, CAMZ);
  const px2w = () => (2 * CAMZ * TAN) / innerHeight;
  const toWorld = (x, y) => { const k = px2w(); return [(x - innerWidth / 2) * k, -(y - innerHeight / 2) * k]; };
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false); dirty = true; BG.forEach((b) => (b.key = ''));
  });

  /* ---------- soft contact shadow ---------- */
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(60,45,30,0.55)'); grd.addColorStop(1, 'rgba(60,45,30,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const makeShadow = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }));

  /* ---------- props ---------- */
  const inst = {};    // name → { pivot, size, shadow, sc }
  const BASE_YAW = { kigurumi: -Math.PI / 2, backpack: -Math.PI / 2 };   // generated meshes face sideways
  function adopt(name, obj, sc) {
    const yaw = BASE_YAW[name.split('-')[0]];
    if (yaw) { const w = new THREE.Group(); obj.rotation.y += yaw; w.add(obj); obj = w; }
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z);
    obj.position.sub(c).multiplyScalar(k); obj.scale.multiplyScalar(k);
    obj.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; if (m.material && name !== 'cap') m.material.envMapIntensity = 0.9; } });
    const pivot = new THREE.Group(); pivot.add(obj); pivot.visible = false; sc.add(pivot);
    const shadow = makeShadow(); shadow.visible = false; sc.add(shadow);
    inst[name] = { pivot, size: size.multiplyScalar(k), shadow, sc };
    dirty = true;
  }
  (function cap() {   // procedural orange cap: the last term of the circle rhyme (plain, no brand)
    const g = new THREE.CylinderGeometry(0.5, 0.5, 0.34, 144, 1, false);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (Math.hypot(v.x, v.z) > 0.45) { const s = 1 + 0.018 * Math.sign(Math.sin(Math.atan2(v.z, v.x) * 48)); p.setXYZ(i, v.x * s, v.y, v.z * s); }
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe0660f, roughness: 0.5, metalness: 0, envMapIntensity: 0.45 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 96, 24, 0, Math.PI * 2, 0, Math.PI * 0.2), mat);
    dome.scale.set(1, 0.35, 1); dome.position.y = 0.17 - 0.5 * 0.35 * Math.cos(Math.PI * 0.2);
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, mat), dome);
    adopt('cap', grp, stageScene);
  })();

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const FILES = { tube: 'props/tube.glb', kigurumi: 'props/kigurumi.glb', backpack: 'props/backpack.glb', bucket: 'props/bucket.glb' };
  // [instance name, scene]: background ones go to the tile scene, transition ones to the stage
  const USES = {
    tube: [['tube-03', tileScene], ['tube-06', stageScene], ['tube-iris', stageScene], ['tube-rhyme', stageScene]],
    kigurumi: [['kigurumi', tileScene]], backpack: [['backpack', tileScene]],
    bucket: [['bucket', tileScene], ['bucket-rhyme', stageScene]],
  };
  const loadAll = () => { for (const [name, url] of Object.entries(FILES)) loader.load(url, (gltf) =>
    USES[name].forEach(([use, sc], i) => adopt(use, i === 0 ? gltf.scene : gltf.scene.clone(true), sc)), undefined, () => {}); };
  if (document.readyState === 'complete') setTimeout(loadAll, 300); else addEventListener('load', () => setTimeout(loadAll, 300));

  const show = (name) => inst[name] && (inst[name].pivot.visible = true, inst[name]);
  const ease = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > -40 && r.top < innerHeight + 40 ? r : null; };

  /* =====================================================================================================
     BACKGROUND props — inside the slide, behind the text. Coordinates are slide px (1920×1080).
     box: the tile canvas on the slide; ground/h: where the prop stands and how tall it is.
     ===================================================================================================== */
  const BG = [
    // Props lie on the page like things a child dropped: a loose tilt, partly behind the words, partly out.
    // at: centre on the slide (1920×1080 px) · h: height in slide px (len: length for the tube) · rot: [x, y, z]
    // alpha: first half of the treatment is quieter. pose(e, leave) → small offsets for the one gesture.
    // 01 · Samat's costume, leaning, its right half behind «POPELIUKH / ( DIRECTOR'S», its left half in the air
    { n: 1, prop: 'kigurumi', at: [1655, 560], h: 560, rot: [0.1, 0.38, -0.24], alpha: 0.5, play: 'load',
      pose(e, leave) { const t = easeOutCubic(clamp01(e / 1.8)); return { dy: 70 * (1 - t), dz: -0.12 * (1 - t), dyaw: -0.3 * ease(clamp01(leave * 1.6)) }; } },
    // 03 · the tube, diagonal, crossing the end of «CHALLENGE» and poking out above it
    { n: 3, prop: 'tube-03', at: [1575, 140], len: 470, rot: [0.3, 0.35, 0.42], alpha: 0.45,
      pose(e) { const t = easeOutCubic(clamp01(e / 1.6)); return { dy: -40 * (1 - t), dz: 0.15 * (1 - t), roll: -0.8 * (1 - t) }; } },
    // 07 · the backpack tipped on the grass, half under the translucent card
    { n: 7, prop: 'backpack', at: [1585, 880], h: 300, rot: [0.08, 0.55, 0.3], alpha: 0.8, gate: 'iris',
      pose(e) { const t = easeOutCubic(clamp01(e / 1.2)); return { dy: -50 * (1 - t), dz: 0.25 * (1 - t) }; } },
    // 09 · the bucket knocked over on the panel, rim towards the text; «tap it» — it wobbles three times and stops
    { n: 9, prop: 'bucket', at: [455, 800], h: 300, rot: [0.22, 0.45, -1.2], alpha: 0.8,
      pose(e) { const t = clamp01(e / 1.3); return { dz: Math.sin(t * Math.PI * 6) * (1 - t) * 0.07 }; } },
  ];
  const tileCam = new THREE.PerspectiveCamera(FOV, 1920 / 1080, 1, 100000);
  tileCam.position.set(0, 0, 540 / TAN);                       // 1 world unit = 1 slide px, the whole slide in view
  for (const b of BG) {
    b.plate = document.querySelector(`.plate[data-n="${b.n}"]`); if (!b.plate) continue;
    const cv = document.createElement('canvas');                // the tile covers the whole slide: nothing is ever cut
    cv.className = 'abs prop-tile'; cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { left: '0px', top: '0px', width: '1920px', height: '1080px', opacity: String(b.alpha) });
    b.plate.querySelector('.slide').appendChild(cv);
    b.cv = cv; b.ctx = cv.getContext('2d'); b.t0 = null; b.key = '';
  }
  function drawTile(b, e, leave) {
    const p = inst[b.prop]; if (!p) return;
    const W = Math.max(2, Math.round(b.plate.clientWidth * DPR)), H = Math.max(2, Math.round(b.plate.clientHeight * DPR));
    const q = REDUCED ? b.pose(99, 0) : b.pose(e, leave);
    const key = [W, H, (q.dy || 0).toFixed(1), (q.dz || 0).toFixed(3), (q.dyaw || 0).toFixed(3), (q.roll || 0).toFixed(3)].join();
    if (key === b.key) return;                                  // nothing moved: keep the last frame
    b.key = key;
    for (const n in inst) if (inst[n].sc === tileScene) { inst[n].pivot.visible = false; inst[n].shadow.visible = false; }
    p.pivot.visible = true;
    const [x, y] = b.at;
    p.pivot.scale.setScalar(b.len ? b.len : b.h / p.size.y);
    p.pivot.position.set(x - 960, -(y - 540) - (q.dy || 0), 0);
    p.pivot.rotation.set(b.rot[0], b.rot[1] + (q.dyaw || 0), b.rot[2] + (q.dz || 0));
    if (b.len) p.pivot.rotation.z += Math.PI / 2;               // the tube model stands up; lay it down first
    if (b.len) p.pivot.children[0].rotation.y = q.roll || 0;
    tiles.setSize(W, H, false);
    tiles.render(tileScene, tileCam);
    b.cv.width = W; b.cv.height = H;
    b.ctx.clearRect(0, 0, W, H); b.ctx.drawImage(tiles.domElement, 0, 0);
  }

  /* =====================================================================================================
     TRANSITION props — on the stage canvas
     ===================================================================================================== */
  function place(p, x, y, sizePx) {
    const [wx, wy] = toWorld(x, y); p.pivot.position.set(wx, wy, 0); p.pivot.scale.setScalar(sizePx * px2w());
  }
  const plate6 = document.querySelector('.plate[data-n="6"]');
  // 06 · the tube rests across the white band under the photos; as the slide leaves it rises into the iris
  function tube06(r, e, leave) {
    const p = show('tube-06'); if (!p) return;
    const k = r.width / 1920;
    const settle = REDUCED ? 0 : 40 * (1 - easeOutCubic(clamp01(e / 1.2)));
    const up = ease(clamp01((leave - 0.3) / 0.6));
    place(p, r.left + 1170 * k, r.top + (722 - settle - up * 330) * k, (360 + up * 60) * k);
    p.pivot.rotation.set(0.35 + up * (Math.PI / 2 - 0.35), 0.2 * (1 - up), Math.PI / 2 * (1 - up));
    if (!up) { const [wx, wy] = toWorld(r.left + 1170 * k, r.top + 772 * k); p.shadow.visible = true;
      p.shadow.position.set(wx, wy, -0.5); p.shadow.material.opacity = 0.28; p.shadow.scale.set(400 * k * px2w(), 34 * k * px2w(), 1); }
  }
  // iris: the tube from 06 comes down to the centre, turns its bore to us, and we fly through it into 07
  function iris(pr) {
    const p = show('tube-iris'); const c = S.irisCenter && S.irisCenter(); if (!p || !c) return;
    p.pivot.rotation.order = 'ZXY';
    const a = ease(clamp01(pr / 0.45));
    const base = (innerHeight * 0.30) / Math.max(p.size.x, p.size.z);
    const grow = pr < 0.45 ? 0.55 + 0.45 * a : 1 + Math.pow((pr - 0.45) / 0.55, 2) * 7;
    const come = ease(clamp01(pr / 0.22));
    place(p, c.x + (1 - come) * innerWidth * 0.12, c.y - (1 - come) * innerHeight * 0.75, base * grow);
    p.pivot.rotation.set(Math.PI / 2 * (0.55 + 0.45 * a), 0, (1 - a) * 0.35);
  }
  // rhyme: tube bore → bucket rim → cap, hard cuts on one circle; the cap's circle becomes slide 11's circle
  function rhyme(pr) {
    const ring = S.rhymeRing && S.rhymeRing(); if (!ring) return;
    const name = pr < 0.25 ? 'tube-rhyme' : pr < 0.5 ? 'bucket-rhyme' : pr < 0.8 ? 'cap' : null;
    if (!name) return;
    const p = show(name); if (!p) return;
    p.pivot.rotation.order = 'ZXY';
    const face = name === 'bucket-rhyme' ? Math.max(p.size.x, p.size.z) * 0.72 : Math.max(p.size.x, p.size.z);
    place(p, ring.x, ring.y, (ring.r * 2) / face);
    p.pivot.rotation.set(Math.PI / 2 - (name === 'cap' ? 0 : 0.06), 0, pr * Math.PI * 1.6);
  }

  /* ---------- loop ---------- */
  const irisPin = document.querySelector('.pin--iris'), rhymePin = document.querySelector('.pin--rhyme');
  let t06 = null;
  function frame() {
    requestAnimationFrame(frame);
    // background tiles: start the gesture when the slide is 20 % in (the cover on load), redraw only while it changes
    for (const b of BG) {
      if (!b.cv) continue;
      const r = inView(b.plate); if (!r) continue;
      if (b.gate === 'iris' && !REDUCED && S.iris < 0.92) { if (b.key !== 'hidden') { b.ctx.clearRect(0, 0, b.cv.width, b.cv.height); b.key = 'hidden'; } continue; }
      if (b.t0 === null && (b.play === 'load' || r.top < innerHeight * 0.8)) b.t0 = performance.now();
      if (b.t0 === null) continue;
      drawTile(b, (performance.now() - b.t0) / 1000, clamp01(-r.top / r.height));
    }
    // stage
    for (const n in inst) if (inst[n].sc === stageScene) { inst[n].pivot.visible = false; inst[n].shadow.visible = false; inst[n].pivot.rotation.order = 'XYZ'; }
    let any = false, behind = false;
    const r6 = plate6 && inView(plate6);
    if (r6) { if (t06 === null && r6.top < innerHeight * 0.8) t06 = performance.now();
      if (t06 !== null) { tube06(r6, (performance.now() - t06) / 1000, clamp01(-r6.top / r6.height)); any = true; } }
    if (!REDUCED) {
      if (irisPin && inView(irisPin) && S.iris > 0 && S.iris < 0.92) { iris(S.iris); any = true; behind = true; }
      if (rhymePin && inView(rhymePin) && S.rhyme > 0 && S.rhyme < 1) { rhyme(S.rhyme); any = true; behind = true; }
    }
    const z = behind ? '0' : '3'; if (canvas.style.zIndex !== z) canvas.style.zIndex = z;
    if (any) { renderer.render(stageScene, camera); wasEmpty = false; }
    else if (!wasEmpty || dirty) { renderer.clear(); wasEmpty = true; }
    dirty = false;
  }
  requestAnimationFrame(frame);
})();
