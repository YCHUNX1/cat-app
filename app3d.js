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
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:30vh;overflow:auto;background:rgba(20,20,30,.9);color:#7ff;font:11px/1.4 monospace;padding:8px 12px;z-index:9999;white-space:pre-wrap;';
    document.body.appendChild(d);
  }
  d.textContent = 'WEBGL: ' + window.__catDiag.webgl + '\n' + window.__catDiag.errors.join('\n') + '\n';
}
renderDiag();

let renderer, scene, camera;
let petGroup;        // 狐狸模型节点
let mixer = null;    // 动画混合器
let clips = {};      // 动画片段名
let animNames = { idle: null, walk: null, run: null };
let currentAnim = null;
let actionT = 0, actionAnim = null, idleT = 0;

// ================== 初始化 ==================
function initCat3D(container) {
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
  if (THREE.SRGBColorSpace !== undefined && 'outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding !== undefined && 'outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  const w = container.clientWidth, h = container.clientHeight;
  camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
  camera.position.set(0, 1.6, 7.2);
  camera.lookAt(0, 0.6, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xffcce0, 1.1));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.5);
  key.position.set(3, 5, 4); key.castShadow = true; scene.add(key);
  const fill = new THREE.DirectionalLight(0xffb0d0, 0.6);
  fill.position.set(-3, 1, -2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xa0c8ff, 0.4);
  rim.position.set(0, 2, -4); scene.add(rim);

  // 地面阴影
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x8ed081, roughness: 1, transparent: true, opacity: 0.5 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.8; ground.receiveShadow = true;
  scene.add(ground);

  // 加载狐狸
  loadFox();

  startPointerRotate(container);
  window.addEventListener('resize', () => onResize(container));
  animate();
}

function loadFox() {
  const loader = new THREE.GLTFLoader();
  loader.load('./models/Fox.glb', function (gltf) {
    const m = gltf.scene;
    // 适配尺寸
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const s = 3.0 / Math.max(size.x, size.y, size.z);
    m.scale.multiplyScalar(s);
    m.position.sub(c.multiplyScalar(s));
    // 放在地面之上
    m.position.y = -0.75;

    petGroup = m;
    scene.add(m);
    m.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });

    // 动画
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(m);
      gltf.animations.forEach(function (cl) { clips[cl.name] = cl; });
      // 匹配常见动画名
      animNames.idle = pick(['idle', 'Idle', 'Take 001', 'Fox_Idle', 'rest', 'Rest', 'pose']);
      animNames.walk = pick(['walk', 'Walk', 'Fox_Walk']);
      animNames.run = pick(['run', 'Run', 'Run_Fox']);
      playAnim(animNames.idle, true);
      window.__catDiag.errors.push('animations: ' + Object.keys(clips).join(','));
      renderDiag();
    } else {
      window.__catDiag.errors.push('no animations');
      renderDiag();
    }
  }, undefined, function (e) {
    window.__catDiag.errors.push('Fox load fail: ' + e.message);
    renderDiag();
  });
}

function pick(names) {
  for (const n of names) if (clips[n]) return n;
  return Object.keys(clips)[0] || null;
}

let currentAction = null;
function playAnim(name, loop) {
  if (!mixer || !name || name === currentAnim) return;
  if (currentAction) currentAction.stop();
  currentAction = mixer.clipAction(clips[name]);
  currentAction.setLoop(loop !== false ? THREE.LoopRepeat : THREE.LoopOnce);
  currentAction.clampWhenFinished = true;
  currentAction.reset().play();
  currentAnim = name;
  window.__animDebug = name;  // 测试用
}

// ================== 交互 ==================
const state = { hunger: 100, clean: 100, mood: 100 };

// ===== 眩晕彩蛋 =====
let rotateAccum = 0;       // 累计拖动旋转角度
let dizzyState = null;     // null | 'spin' | 'wobble' | 'recover'
let dizzyT = 0;            // 眩晕计时
window.__dizzyDebug = null;
const dizzyStars = [];     // 星星粒子
const ACTIONS = {
  feed:  { hunger:+20, clean:-4, mood:+8,  bubble:'好吃! 🦊😋', anim:'run' },
  clean: { hunger:0,   clean:+30,mood:+5,  bubble:'香香哒 ✨', anim:'walk' },
  pet:   { hunger:0,   clean:0,  mood:+12, bubble:'蹭蹭~ 😊', anim:null },
  play:  { hunger:-8,  clean:-10,mood:+15, bubble:'玩起来啦! 🎉', anim:'run' },
};

function doAction3D(name) {
  const a = ACTIONS[name];
  if (!a) return;
  state.hunger = clamp(state.hunger + a.hunger);
  state.clean = clamp(state.clean + a.clean);
  state.mood = clamp(state.mood + a.mood);
  actionAnim = a.anim; actionT = 0;
  if (actionAnim) playAnim(actionAnim === 'walk' ? (animNames.walk || animNames.idle) : (animNames.run || animNames.walk || animNames.idle), true);
  showBubble(a.bubble);
  updateBars();
  updateExpression3D();
}

function clamp(v) { return Math.max(0, Math.min(100, v)); }

// ===== 眩晕彩蛋核心 =====
function startDizzy() {
  dizzyState = 'spin';
  dizzyT = 0;
  rotateAccum = 0;
  window.__dizzyDebug = 'spin';
  // 切到轻柔动画或停止，让它看起来在晕
  showBubble('🌀 转晕啦~ 头晕眼花…');
  spawnDizzyStars();
}

function spawnDizzyStars() {
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd94d : 0xffab3c })
    );
    s.userData = { angle: (i / 5) * Math.PI * 2, radius: 0.5, speed: 3 + i * 0.2, baseY: 1.9 };
    scene.add(s);
    dizzyStars.push(s);
  }
  window.__dizzyStarCount = dizzyStars.length;  // 调试
}

function clearDizzyStars() {
  dizzyStars.forEach(s => { scene.remove(s); });
  dizzyStars.length = 0;
}

function updateDizzy(dt) {
  if (dizzyState === null) return;
  dizzyT += dt;
  const g = petGroup;
  if (!g) return;

  if (dizzyState === 'spin') {
    // 快速自转 3 圈（约 1.2 秒）
    g.rotation.y += dt * Math.PI * 5;  // 快速转
    const spinDur = 1.2;
    if (dizzyT >= spinDur) {
      // 进入摇晃阶段
      dizzyT = 0;
      dizzyState = 'wobble';
      window.__dizzyDebug = 'wobble';
    }
  } else if (dizzyState === 'wobble') {
    // 东倒西歪摇晃约 2 秒
    const wob = Math.sin(dizzyT * 12) * 0.15 * Math.max(0, 1 - dizzyT / 2);
    g.rotation.z = wob;
    g.rotation.x = Math.cos(dizzyT * 9) * 0.1 * Math.max(0, 1 - dizzyT / 2);
    g.position.y = -0.75 + Math.abs(Math.sin(dizzyT * 8)) * 0.12 * Math.max(0, 1 - dizzyT / 2);
    if (dizzyT >= 2.0) {
      dizzyT = 0;
      dizzyState = 'recover';
      window.__dizzyDebug = 'recover';
    }
  } else if (dizzyState === 'recover') {
    // 恢复正常姿态
    g.rotation.z += (0 - g.rotation.z) * 0.2;
    g.rotation.x += (0 - g.rotation.x) * 0.2;
    g.position.y += (-0.75 - g.position.y) * 0.15;
    if (dizzyT >= 0.8) {
      dizzyState = null;
      window.__dizzyDebug = null;
      clearDizzyStars();
      g.rotation.z = 0; g.rotation.x = 0;
      showBubble('头还有点晕… 再转它一圈试试 😵');
    }
  }

  // 星星绕头旋转
  dizzyStars.forEach(s => {
    const d = s.userData;
    d.angle += d.speed * dt;
    s.position.set(Math.cos(d.angle) * d.radius, d.baseY + Math.sin(dizzyT * 6) * 0.1, Math.sin(d.angle) * d.radius);
    s.rotation.z += dt * 6;
  });
}

function updateBars() {
  const bar = (id, v) => { const el = document.getElementById(id); if (el) { el.style.width = Math.round(v) + '%'; } };
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
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
  // 状态变化时给一点动画反馈：难过时放慢 idle，开心时加速
  if (expr === 'sad') { if (currentAction) currentAction.timeScale = 0.5; }
  else if (expr === 'happy') { if (currentAction) currentAction.timeScale = 1.3; }
  else { if (currentAction) currentAction.timeScale = 1.0; }
}

// ================== 动画循环 ==================
function animate() {
  requestAnimationFrame(animate);
  const dt = 1 / 60;
  idleT += dt; actionT += dt;

  if (mixer) mixer.update(dt);

  // 眩晕状态机
  updateDizzy(dt);
  const dizzy = dizzyState !== null;

  if (petGroup && !dizzy) {
    // 平滑转向（拖动旋转由一个外部 targetRot 控制，这里合并）
    petGroup.rotation.y += ((targetRot.y || 0) - petGroup.rotation.y) * 0.12;
  }

  // 动作结束后回到 idle / 待机的轻微弹跳
  if (actionAnim && actionT > 1.6) {
    actionAnim = null;
    if (currentAnim !== animNames.idle && animNames.idle) playAnim(animNames.idle, true);
  }
  // 触摸/互动时的轻微上下弹
  if (!dizzy && actionT < 1.2 && actionAnim === 'run') {
    if (petGroup) petGroup.position.y = -0.75 + Math.abs(Math.sin(actionT * Math.PI * 2)) * 0.15;
  } else if (petGroup && !dizzy) {
    petGroup.position.y += (-0.75 - petGroup.position.y) * 0.1;
  }

  renderer.render(scene, camera);
}

// ================== 拖动旋转 ==================
let isDown = false, downX = 0, targetRot = { y: 0 };
function startPointerRotate(el) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => { isDown = true; downX = e.clientX; });
  window.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = e.clientX - downX;
    const delta = dx * 0.008;
    targetRot.y = (targetRot.y || 0) + delta;
    downX = e.clientX;
    // 累计旋转（度），满 360 触发眩晕
    if (dizzyState === null) {
      rotateAccum += Math.abs(delta) * 57.2958;
      if (rotateAccum >= 360) {
        rotateAccum = 0;
        startDizzy();
      }
    }
  });
  window.addEventListener('pointerup', () => { isDown = false; });
}

function onResize(container) {
  const c = container;
  camera.aspect = c.clientWidth / c.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(c.clientWidth, c.clientHeight);
}

// ================== 气泡 ==================
let bubbleTimer;
function showBubble(text) {
  const b = document.getElementById('bubble');
  if (!b) return;
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), 1600);
}

// 暴露到全局（普通脚本模式）
window.initCat3D = initCat3D;
window.doAction3D = doAction3D;
window.forceDizzy = startDizzy;  // 调试/彩蛋触发入口
window.getState3D = function () { return { hunger: state.hunger, clean: state.clean, mood: state.mood }; };
