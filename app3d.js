import * as THREE from './lib/three/three.module.js';

// ===== 诊断：捕获错误并显示到屏幕 =====
window.__catDiag = { step: 'module-loaded', errors: [], webgl: null };
try {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
  window.__catDiag.webgl = gl ? (gl.getParameter(gl.VERSION) + '') : 'NOT AVAILABLE';
} catch (e) { window.__catDiag.webgl = 'ERROR: ' + e.message; }
window.addEventListener('error', function (ev) {
  window.__catDiag.errors.push(ev.message + ' @ ' + (ev.filename || '').split('/').pop() + ':' + ev.lineno);
  renderDiag();
});
window.addEventListener('unhandledrejection', function (ev) {
  window.__catDiag.errors.push('Promise: ' + (ev.reason && ev.reason.message));
  renderDiag();
});
function renderDiag() {
  let d = document.getElementById('diag');
  if (!d) {
    d = document.createElement('div');
    d.id = 'diag';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:rgba(20,20,30,.92);color:#7ff;font:11px/1.4 monospace;padding:10px 14px;z-index:9999;white-space:pre-wrap;';
    document.body.appendChild(d);
  }
  d.textContent = 'WEBGL: ' + window.__catDiag.webgl + '\n' + window.__catDiag.errors.join('\n') + '\n'; }
renderDiag();

// ============================================================
//  3D 卡通小猫 - 程序化建模
//  用几何体组合构建精致可爱的 3D 小猫，含材质/光照/动画/表情
// ============================================================

let renderer, scene, camera;
let catGroup, head, body, tail, eyesGrp, mouthMesh;
let eyeL, eyeR;          // 眼球（含高光）
let earL, earR;
let paws = [];
let actionT = 0;         // 动作计时
let actionAnim = null;   // 当前动画状态
let blinkTimer = 0, blinkState = 0;
let idleT = 0;

// 颜色主题
const C = {
  fur: 0xffb861,
  furDark: 0xf59e46,
  belly: 0xffe7bf,
  earIn: 0xffc99b,
  eyeIris: 0x3aa05b,    // 绿色瞳
  eyeDark: 0x2a2a2a,
  nose: 0xf0708a,
  blush: 0xff9a9a,
  white: 0xfff4e0,
};

export function initCat3D(container) {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    window.__catDiag.errors.push('WebGLRenderer create fail: ' + e.message);
    renderDiag();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // 场景
  scene = new THREE.Scene();

  // 相机
  const w = container.clientWidth, h = container.clientHeight;
  camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
  camera.position.set(0, 2.1, 7.2);
  camera.lookAt(0, 0.9, 0);

  // 光照
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffcce0, 1.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2e0, 1.4);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffb0d0, 0.6);
  fill.position.set(-3, 1, -2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xa0c8ff, 0.5);
  rim.position.set(0, 2, -4);
  scene.add(rim);

  // 地面阴影圆盘
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 48),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, roughness: 1, transparent: true, opacity: 0.35 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // 背景漂浮装饰（爱心）
  addFloatingDecor();

  // ---- 组装小猫 ----
  catGroup = new THREE.Group();
  buildCat();
  scene.add(catGroup);

  // 待机呼吸动画用
  bodyStorage = body;
  headStorage = head;

  // 事件
  startPointerRotate(container);
  window.addEventListener('resize', onResize);

  animate();
}

// 用于动画的引用
let bodyStorage, headStorage;

// ---------------- 建模 ----------------
function buildCat() {
  // 材质
  const fur = new THREE.MeshStandardMaterial({ color: C.fur, roughness: 0.55, metalness: 0.05 });
  const furSoft = new THREE.MeshStandardMaterial({ color: 0xffc06d, roughness: 0.6, metalness: 0.05 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: C.belly, roughness: 0.7, metalness: 0 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.7 });
  const noseMat = new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.4 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const irisMat = new THREE.MeshStandardMaterial({ color: C.eyeIris, roughness: 0.2, emissive: 0x1d6b3a, emissiveIntensity: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: C.eyeDark, roughness: 0.2 });
  const blushMat = new THREE.MeshStandardMaterial({ color: C.blush, roughness: 0.8, transparent: true, opacity: 0.6 });
  const earInMat = new THREE.MeshStandardMaterial({ color: C.earIn, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.5 });

  // --- 身体（偏胖的梨形：球体压扁 + 缩放） ---
  body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 24), fur);
  body.scale.set(1.55, 1.25, 1.15);
  body.position.y = 1.05;
  body.castShadow = true;
  catGroup.add(body);

  // 肚皮
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 24), bellyMat);
  belly.scale.set(1.62, 1.10, 0.72);
  belly.position.set(0, 0.92, 0.58);
  catGroup.add(belly);

  // --- 头（稍大，圆润） ---
  head = new THREE.Group();
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.92, 32, 24), fur);
  headMesh.scale.set(1.0, 0.98, 0.95);
  headMesh.castShadow = true;
  head.add(headMesh);
  head.position.y = 2.35;
  head.position.z = 0.05;
  catGroup.add(head);

  // 头部两侧毛（黄渐变）
  const headSideL = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), furSoft);
  headSideL.scale.set(0.55, 0.5, 0.35); headSideL.position.set(-0.95, -0.02, 0); head.add(headSideL);
  const headSideR = headSideL.clone(); headSideR.position.x = 0.95; head.add(headSideR);

  // --- 耳朵（带内耳，圆润） ---
  function makeEar(side) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.4, 24), fur);
    outer.position.y = 0.2;
    outer.rotation.x = -0.15;
    outer.castShadow = true;
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.24, 20), earInMat);
    inner.position.y = 0.2; inner.position.z = 0.05;
    inner.rotation.x = -0.15;
    g.add(inner);
    g.position.y = 0.72;
    g.position.x = side * 0.6;
    g.rotation.z = -side * 0.28;
    return g;
  }
  earL = makeEar(-1); earR = makeEar(1);
  head.add(earL); head.add(earR);

  // --- 眼睛（白眼球 + 绿虹膜 + 瞳孔 + 高光） ---
  eyesGrp = new THREE.Group();
  function makeEye(side) {
    const g = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.30, 24, 18), eyeWhite);
    white.scale.set(1, 1.15, 0.5);
    g.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), irisMat);
    iris.position.z = 0.20; iris.position.y = -0.02;
    g.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), pupilMat);
    pupil.position.z = 0.34; pupil.position.y = -0.02;
    g.add(pupil);
    // 高光小圆片
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), whiteMat);
    glint.position.z = 0.42; glint.position.y = 0.06; glint.position.x = 0.05;
    g.add(glint);
    g.position.x = side * 0.30;
    g.position.y = 0.16;
    return g;
  }
  eyeL = makeEye(-1); eyeR = makeEye(1);
  eyesGrp.add(eyeL); eyesGrp.add(eyeR);
  eyesGrp.position.z = 0.78;
  head.add(eyesGrp);

  // 闭眼遮罩（眨眼用）：用细长椭球，平时不可见
  eyelidL = makeLid(-1); eyelidR = makeLid(1);
  eyelidL.visible = false; eyelidR.visible = false;
  head.add(eyelidL); head.add(eyelidR);

  // --- 鼻子 + 嘴 ---
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), noseMat);
  nose.scale.set(1, 0.75, 0.6);
  nose.position.set(0, 0.0, 0.82);
  head.add(nose);

  // 微笑嘴（用圆环的一部分：torus）
  mouthMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.035, 10, 20, Math.PI),
    darkMat
  );
  mouthMesh.position.set(0, -0.16, 0.80);
  mouthMesh.rotation.z = Math.PI;  // 翻转成微笑（开口向下弧度）
  mouthMesh.rotation.x = 0.15;
  head.add(mouthMesh);

  // 腮红
  const blush = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), blushMat);
  blush.scale.set(1.4, 0.9, 0.5);
  blush.position.set(-0.52, -0.18, 0.68); head.add(blush);
  const blush2 = blush.clone(); blush2.position.x = 0.52; head.add(blush2);

  // 胡须（白色细线，两侧各两条）
  const whiskMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  function whisker(side) {
    for (let i = 0; i < 2; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), whiskMat);
      w.rotation.z = Math.PI / 2;
      w.rotation.y = side * 0.25 + (i === 0 ? -0.1 : 0.15);
      w.position.set(side * 0.8, -0.12 + i * -0.1, 0.55);
      head.add(w);
    }
  }
  whisker(-1); whisker(1);

  // --- 尾巴（弯曲：多段圆柱） ---
  tail = maketail(fur);
  catGroup.add(tail);

  // --- 脚掌（4 个胖脚） ---
  const positions = [[-0.5, 0, -0.55], [0.5, 0, -0.55], [-0.5, 0, 0.35], [0.5, 0, 0.35]];
  positions.forEach(p => {
    const ft = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), fur);
    ft.scale.set(1, 0.55, 1);
    ft.position.set(p[0], 0.22, p[1] + 0.1);
    ft.castShadow = true;
    catGroup.add(ft);
    paws.push(ft);
  });
  // 肉垫（脚底）
  const padMat = new THREE.MeshStandardMaterial({ color: C.blush, roughness: 0.6 });
  const frontL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), padMat);
  frontL.scale.set(1, 0.4, 1); frontL.position.set(-0.5, 0.05, 0.42); catGroup.add(frontL);
  const frontR = frontL.clone(); frontR.position.x = 0.5; catGroup.add(frontR);

  // 蝴蝶结（可爱点缀）
  const bow = makeBow();
  bow.position.set(0, 2.62, 0.62);
  bow.rotation.z = Math.PI;
  catGroup.add(bow);
}

let eyelidL, eyelidR;

function makeLid(side) {
  const g = new THREE.Group();
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 16), new THREE.MeshStandardMaterial({ color: C.fur, roughness: 0.55 }));
  lid.scale.set(1, 0.85, 0.5);
  lid.position.set(side * 0.30, 0.16, 0.80);
  return lid;
}

function maketail(fur) {
  const g = new THREE.Group();
  const seg = 8, len = 1.3;
  const prev = new THREE.Object3D();
  for (let i = 0; i < seg; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.14 - i * 0.012, 12, 10), fur);
    s.scale.set(1, 1, 1.4);
    s.position.y = -0.15;
    prev.add(s);
    const n = new THREE.Object3D();
    n.position.y = 0.18;
    prev.add(n);
    prev = n;
  }
  g.add(prev);
  g.position.set(0, 1.1, -0.95);
  g.rotation.x = 0.55;
  return g;
}

function makeBow() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6f92, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat);
    lobe.scale.set(1.5, 0.8, 0.5);
    lobe.position.x = s * 0.2;
    g.add(lobe);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), mat);
  g.add(knot);
  return g;
}

// 漂浮爱心装饰
function addFloatingDecor() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xff8fa6, transparent: true, opacity: 0.35, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat);
    heart.scale.set(0.9, 1.05, 0.9);
    heart.position.set((Math.random() - 0.5) * 6, 0.8 + Math.random() * 3, -2 + Math.random() * -1.5);
    scene.add(heart);
    hearts.push(heart);
  }
}
const hearts = [];

// ---------------- 交互：拖动旋转 ----------------
let isDown = false, downX = 0, targetRot = { y: 0 };
function startPointerRotate(el) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => { isDown = true; downX = e.clientX; el.classList.add('dragging'); });
  window.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = e.clientX - downX;
    targetRot.y = (targetRot.y || 0) + dx * 0.01;
    downX = e.clientX;
  });
  window.addEventListener('pointerup', () => { isDown = false; el.classList.remove('dragging'); });
}

function onResize() {
  const c = document.getElementById('stage');
  camera.aspect = c.clientWidth / c.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(c.clientWidth, c.clientHeight);
}

// ---------------- 状态系统 ----------------
const state = { hunger: 100, clean: 100, mood: 100 };
const ACTIONS = {
  feed:  { hunger:+20, clean:-4, mood:+8,  bubble:'好吃! 😋', anim:'jump' },
  clean: { hunger:0,   clean:+30,mood:+5,  bubble:'香香哒 ✨', anim:'spin' },
  pet:   { hunger:0,   clean:0,  mood:+12, bubble:'呼噜呼噜~ 😊', anim:'wiggle' },
  play:  { hunger:-8,  clean:-10,mood:+15, bubble:'玩起来啦! 🎉', anim:'roll' },
};

export function doAction3D(name) {
  const a = ACTIONS[name];
  if (!a) return;
  state.hunger = clamp(state.hunger + a.hunger);
  state.clean  = clamp(state.clean + a.clean);
  state.mood   = clamp(state.mood + a.mood);
  actionAnim = a.anim;
  actionT = 0;
  showBubble(a.bubble);
  updateBars();
  updateExpression3D();
}

function clamp(v) { return Math.max(0, Math.min(100, v)); }

// 状态条更新（从 UI 模块调用）
function updateBars() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
  const bar = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = Math.round(v) + '%'; };
  bar('hBar', state.hunger); bar('cBar', state.clean); bar('mBar', state.mood);
  set('hVal', state.hunger); set('cVal', state.clean); set('mVal', state.mood);
}

let curExpr = 'normal';
function updateExpression3D() {
  let expr;
  if (state.hunger < 20 || state.clean < 20 || state.mood < 20) expr = 'sad';
  else if (state.mood >= 80) expr = 'happy';
  else if (state.hunger < 40) expr = 'tired';
  else expr = 'normal';
  if (expr === curExpr) return;
  curExpr = expr;
  applyExpression(expr);
}

function applyExpression(expr) {
  // 缩放/位移眼睛与嘴做表情
  const eScale = (s) => { eyeL.scale.set(s, s, s); eyeR.scale.set(s, s, s); };
  const eyeY = (y) => { eyeL.position.y = y; eyeR.position.y = y; };
  switch (expr) {
    case 'happy':
      eScale(0.85); eyeY(0.16);
      // 弯成 ^ ^（眯眼）：用细高
      eyeL.children[0].scale.set(0.5, 0.16, 0.5);
      eyeR.children[0].scale.set(0.5, 0.16, 0.5);
      mouthMesh.rotation.z = Math.PI;          // 大微笑
      mouthMesh.scale.set(1.6, 0.7, 1);
      break;
    case 'sad':
      eScale(0.9); eyeY(0.14);
      eyeL.children[0].scale.set(0.55, 0.5, 0.5);
      eyeR.children[0].scale.set(0.55, 0.5, 0.5);
      mouthMesh.rotation.z = 0;                // 反转成难过
      mouthMesh.rotation.x = 0.2;
      mouthMesh.scale.set(1, 1, 1);
      break;
    case 'tired':
      eScale(0.8); eyeY(0.18);
      eyeL.children[0].scale.set(0.5, 0.35, 0.5);
      eyeR.children[0].scale.set(0.5, 0.35, 0.5);
      mouthMesh.rotation.z = Math.PI; mouthMesh.scale.set(0.8, 0.8, 1);
      break;
    default:
      eScale(1); eyeY(0.16);
      eyeL.children[0].scale.set(1, 1.15, 0.5);
      eyeR.children[0].scale.set(1, 1.15, 0.5);
      mouthMesh.rotation.z = Math.PI; mouthMesh.rotation.x = 0.15; mouthMesh.scale.set(1, 1, 1);
  }
}

// ---------------- 动画循环 ----------------
function animate() {
  requestAnimationFrame(animate);
  const dt = 1 / 60;
  idleT += dt;
  actionT += dt;

  // 平滑旋转
  if (catGroup) {
    catGroup.rotation.y += ((targetRot.y || 0) - catGroup.rotation.y) * 0.12;
  }

  // 呼吸（身体缩放）
  const breathe = Math.sin(idleT * 1.8) * 0.02;
  if (bodyStorage) bodyStorage.scale.set(1.55 * (1 + breathe), 1.25 * (1 - breathe * 0.4), 1.15);
  if (headStorage) headStorage.position.y = 2.35 + Math.sin(idleT * 1.8) * 0.02;

  // 尾巴摆动
  if (tail) tail.rotation.y = Math.sin(idleT * 2.2) * 0.25;

  // 动作动画
  if (actionAnim && actionT < 1.0) {
    const t = actionT;
    if (actionAnim === 'jump') catGroup.position.y = Math.sin(t * Math.PI) * 1.2;
    else if (actionAnim === 'spin') catGroup.rotation.y += 0.5;
    else if (actionAnim === 'wiggle') catGroup.rotation.z = Math.sin(t * Math.PI * 3) * 0.12;
    else if (actionAnim === 'roll') { catGroup.rotation.z += 0.15; catGroup.position.y = Math.abs(Math.sin(t * Math.PI)) * 0.4; }
  } else if (actionT >= 1.0 && actionAnim) {
    actionAnim = null;
    catGroup.position.y = 0;
  }

  // 眨眼
  blinkTimer += dt;
  if (blinkTimer > 3.2) { blinkState = 1; }
  if (blinkState === 1) {
    if (blinkTimer > 3.35) { blinkState = 2; eyelidL.visible = true; eyelidR.visible = true; eyeL.visible = false; eyeR.visible = false; }
  }
  if (blinkState === 2 && blinkTimer > 3.5) {
    blinkState = 0; eyelidL.visible = false; eyelidR.visible = false; eyeL.visible = true; eyeR.visible = true; blinkTimer = 0;
  }

  // 漂浮爱心
  hearts.forEach((h, i) => {
    h.position.y += Math.sin(idleT * 0.8 + i) * 0.002;
    h.rotation.z += 0.01;
  });

  renderer.render(scene, camera);
}

// 气泡
let bubbleTimer;
function showBubble(text) {
  const b = document.getElementById('bubble');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), 1600);
}
