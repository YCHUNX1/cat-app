// ============================================
//  像素小橘猫 - 精致 16-bit 像素宠物渲染器
//  程序化绘制像素 + 帧动画系统
// ============================================
(function () {
  // 逻辑网格（自动缩放，每个"像素"= cell 物理像素）
  const W = 44, H = 40;      // 逻辑像素网格
  let canvas, ctx, cell = 10; // cell 由 resize 决定
  let stage;

  // 调色板（橘猫）
  const PAL = {
    outline: '#2a1a12',
    fur: '#f59e3a',
    furL: '#ffb85c',
    furD: '#d97f24',
    belly: '#fff3dd',
    stripe: '#c96f1e',
    earIn: '#ffc9a1',
    nose: '#f0707a',
    eye: '#2f2f2f',
    iris: '#3aa05b',
    blush: '#ff9a9a',
    white: '#ffffff',
    sleepZ: '#9ad0ff',
    star: '#ffd94d',
    bubbleC: '#bfe6ff',
  };

  // 状态
  const state = {
    act: 'idle',      // 当前动作
    actT: 0,          // 动作计时
    frame: 0,         // 帧号
    expr: 'normal',   // normal | happy | sad | tired
    blink: 0,         // 眨眼计时
    dir: -1,          // 朝向
    dizzy: 0,         // 眩晕计时 >0 表示在晕
    starAnim: 0,
  };

  // 猫的部位参数（由动作函数设置，渲染读取）
  const P = {
    bodyY: 0, headY: 0, headX: 0, tailA: 0,
    legL: [0, 0], legR: [0, 0], // 腿前伸量
    eyeH: 0, eyeW: 1, mouth: 0, // 表情
    earL: 0, earR: 0, // 耳朵角度
    bubbleR: 0, tailH: 0, earW: 0,
    squash: 1, // 身体压扁
  };

  let raf = null;
  let lastT = 0;

  // ===== 工具：画像素 =====
  function px(x, y, w, h, color) {
    if (!color) return;
    ctx.fillStyle = color;
    const cx = Math.round(x), cy = Math.round(y);
    ctx.fillRect(cx * cell, cy * cell, Math.max(1, Math.round((w || 1) * cell)), Math.max(1, Math.round((h || 1) * cell)));
  }
  function rect(x, y, w, h, color) { px(x, y, w, h, color); }
  // 像素取整辅助（保证格子对齐）
  function pi(v) { return Math.round(v); }

  // ===== 初始化 =====
  function init(el) {
    stage = el;
    canvas = document.createElement('canvas');
    stage.appendChild(canvas);
    ctx = canvas ? canvas.getContext('2d') : null;
    if (!ctx) { return false; }
    resize();
    window.addEventListener('resize', resize);
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    return true;
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    cell = Math.max(6, Math.floor(Math.min(r.height / H, r.width / W)));
    canvas.width = W * cell;
    canvas.height = H * cell;
    // 居中
    canvas.style.width = (W * cell) + 'px';
    canvas.style.height = (H * cell) + 'px';
  }

  // ===== 主循环 =====
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = (now - lastT) / 1000; lastT = now;
    state.frame += 1;
    if (state.blink > 0) state.blink -= dt;
    else if (Math.random() < 0.002) state.blink = 0.12;
    if (state.dizzy > 0) {
      state.dizzy -= dt;
      state.starAnim += dt * 6;
    }
    draw();
  }

  // ===== 动作切换 =====
  function setAct(name) {
    if (state.act === name) return;
    state.act = name;
    state.actT = 0;
  }
  // 执行一次动作后回 idle
  function playAct(name, dur) {
    state.act = name; state.actT = 0;
    state.actDur = dur || 1.2;
  }

  // ===== 绘制 =====
  function draw() {
    if (!ctx) return;
    state.actT += 1 / 60;
    // 清屏
    ctx.clearRect(0, 0, W * cell, H * cell);
    // 背景（简单像素天空草地，半透明）
    drawBackground();

    // 计算动作
    updatePose();

    // 绘制顺序：尾部 后腿 身体 前腿 头 耳朵 表情
    drawTail();
    drawLegs();
    drawBody();
    drawHead();
    drawEar();
    drawFace();
    drawAccessories();  }

  function drawBackground() {
    // 简单像素地面（脚下）
    for (let gx = 0; gx < W; gx += 2) {
      px(gx, H - 6, 2, 6, (gx / 2) % 2 === 0 ? '#3f3a55' : '#373350');
      px(gx, H - 6, 1, 6, (gx / 2) % 2 === 0 ? '#3f3a55' : '#373350');
    }
    // 地面线
    px(0, H - 7, W, 1, '#0f0f1a');
  }

  // ===== 身体各部位绘制 =====
  function drawBody() {
    const cx = W / 2 + P.headX * 0.2;
    const by = H - 9 - P.bodyY; // 身体底边
    const bw = 16, bh = 11 * P.squash;
    // 肚皮（浅色）
    rect(cx - 6, by - bh + 2, 12, bh - 2, PAL.belly);
    // 身体主色
    rect(cx - bw / 2, by - bh, bw, bh, PAL.fur);
    // 背部色块
    rect(cx - bw / 2, by - bh, bw, 3, PAL.furL);
    // 斑纹
    for (let i = 0; i < 3; i++) rect(cx - bw / 2 + 2 + i * 4, by - bh + 3 + (i % 2) * 1, 3, 2, PAL.stripe);
  }

  function drawHead() {
    const hx = W / 2 + P.headX;
    const hy = H - 20 - P.headY;
    const s = P.headW || 11; // 头宽
    // 头
    rect(hx - s, hy - 9, s * 2, 12, PAL.fur);
    rect(hx - s, hy - 11, s * 2, 2, PAL.furL);
    // 脸颊
    rect(hx - s - 2, hy - 4, 2, 5, PAL.fur);
    rect(hx + s, hy - 4, 2, 5, PAL.fur);
    // 白下巴
    rect(hx - 4, hy + 1, 8, 3, PAL.belly);
    // 蝴蝶结（可爱）
    const bowY = hy - 12;
    px(hx - 2, bowY, 2, 2, '#ff6f92');
    px(hx - 5, bowY - 2, 3, 3, '#ff6f92');
    px(hx + 2, bowY - 2, 3, 3, '#ff6f92');
  }

  function drawEar() {
    const hx = W / 2 + P.headX;
    const hy = H - 20 - P.headY;
    const el = P.earL, er = P.earR;
    // 左耳
    px(hx - 9, hy - 14 - el, 5, 6, PAL.fur);
    px(hx - 8, hy - 13 - el, 3, 3, PAL.earIn);
    // 右耳
    px(hx + 4, hy - 14 - er, 5, 6, PAL.fur);
    px(hx + 5, hy - 13 - er, 3, 3, PAL.earIn);
  }

  function drawFace() {
    const hx = W / 2 + P.headX;
    const hy = H - 20 - P.headY;
    // 眼睛
    const blinkOn = state.blink > 0 || state.act === 'sleep';
    const irisColor = blinkOn ? PAL.fur : PAL.iris;
    const eyeY = hy - 4 + P.eyeH;
    const eyeOpen = P.eyeW;
    if (blinkOn) {
      px(hx - 6, eyeY, 3, 1, PAL.outline);
      px(hx + 3, eyeY, 3, 1, PAL.outline);
    } else {
      // 眼睛（白 + 绿瞳 + 黑瞳）
      px(hx - 7, eyeY - 2, eyeOpen === 0 ? 1 : 4, P.eyeOpenH || 3, PAL.eye);
      px(hx + 3, eyeY - 2, eyeOpen === 0 ? 1 : 4, P.eyeOpenH || 3, PAL.eye);
      px(hx - 6, eyeY - 2, 2, 2, PAL.iris);
      px(hx + 4, eyeY - 2, 2, 2, PAL.iris);
      px(hx - 6, eyeY - 2, 1, 1, PAL.white);
      px(hx + 4, eyeY - 2, 1, 1, PAL.white);
    }
    // 腮红
    px(hx - 9, hy - 2, 3, 2, PAL.blush);
    px(hx + 6, hy - 2, 3, 2, PAL.blush);
    // 鼻子 + 嘴
    px(hx - 1, hy - 1, 2, 1, PAL.nose);
    // 嘴（随表情）
    if (state.expr === 'happy' || state.act === 'pet') {
      px(hx - 2, hy + 1, 4, 1, PAL.outline);
      px(hx - 3, hy + 2, 6, 1, PAL.outline); // 微笑
    } else if (state.expr === 'sad') {
      px(hx - 2, hy + 2, 4, 1, PAL.outline);
    } else if (state.act === 'sleep') {
      px(hx - 1, hy + 1, 2, 1, PAL.outline);
    } else {
      px(hx - 1, hy + 1, 2, 1, PAL.outline); // 小嘴
    }
    // 胡须
    px(hx - 12, hy - 2, 4, 1, PAL.furD);
    px(hx + 8, hy - 2, 4, 1, PAL.furD);
  }

  function drawLegs() {
    const cx = W / 2;
    const by = H - 9 - P.bodyY;
    const legs = [P.legL, P.legR];
    legs.forEach((leg, i) => {
      const lx = cx + (i === 0 ? -4 : 4);
      const lft = leg[0] || 0;   // 前伸
      const lift = leg[1] || 0;  // 抬离
      px(lx + lft, by - 2 - lift, 4, 2, PAL.furD);
    });
    // 前爪
    px(cx - 4, by, 4, 1, PAL.furL);
    px(cx, by, 4, 1, PAL.furL);
  }

  function drawTail() {
    const cx = W / 2;
    const baseX = cx + 9, baseY = H - 9 - P.bodyY;
    const a = P.tailA || 0;
    const tx = baseX + Math.cos(a) * 6;
    const ty = baseY - 3 + Math.sin(a) * 6;
    px(baseX, baseY - 3, 3, 3, PAL.fur);
    px(tx, ty - 1, 3, 3, PAL.fur);
    px(tx + 1, ty - 2, 2, 2, PAL.furD); // 尾尖
  }

  // ===== 动作姿态计算 =====
  function updatePose() {
    const t = state.actT;
    const f = Math.floor(state.frame / 6); // 慢速帧
    // 重置默认
    Object.assign(P, {
      bodyY: 0, headY: 0, headX: 0, tailA: Math.sin(state.frame / 20) * 0.4,
      legL: [0, 0], legR: [0, 0], eyeH: 0, eyeW: 1, eyeOpenH: 3,
      earL: 0, earR: 0, headW: 11, squash: 1,
    });
    state.dir = -1;

    switch (state.act) {
      case 'idle':
        // 呼吸 + 尾巴摆 + 耳朵微动
        P.bodyY = Math.sin(state.frame / 18) * 0.8;
        P.headY = Math.sin(state.frame / 18) * 0.15;
        P.tailA = Math.sin(state.frame / 22) * 0.6;
        P.squash = 1 + Math.sin(state.frame / 18) * 0.04;
        break;
      case 'walk':
        addWalk(f, 1.0);
        break;
      case 'run':
        addWalk(f, 2.2);
        P.bodyY = Math.sin(f) * 1.2;
        break;
      case 'sleep':
        P.squash = 0.8;
        P.bodyY = 1.2;
        P.headY = 0.6;
        P.legL = [0, 2]; P.legR = [0, 2];
        P.tailA = 0.2;
        // 头顶 Zzz
        if (Math.floor(state.frame / 30) % 2 === 0) {
          px(W / 2 + 8, H - 26, 3, 2, '#9ad0ff');
          px(W / 2 + 11, H - 29, 2, 2, '#9ad0ff');
        }
        break;
      case 'eat':
        // 低头到碗边 + 咀嚼（headY 负 = 头向下低）
        P.headY = -8 + Math.sin(state.frame / 1.6) * 0.6;
        P.headX = -1.5;
        P.eyeH = 1;            // 半闭眼
        P.eyeOpenH = 1;
        P.bodyY = 0.5;
        P.legL = [1, 0]; P.legR = [-1, 0];
        break;
      case 'pet':
        // 眯眼享受 + 微微歪头
        P.eyeH = 0; P.eyeOpenH = 1;
        P.headY = 0.3;
        P.headX = Math.sin(state.frame / 30) * 0.6;
        P.blush = 0; // 腮红更明显（复用）
        break;
      case 'play':
        // 蹦跳
        P.bodyY = Math.abs(Math.sin(t * Math.PI * 2 / 0.6)) * 4;
        P.headY = P.bodyY * 0.9;
        P.tailA = Math.sin(state.frame / 5) * 0.8;
        P.legL = [0, 1]; P.legR = [0, 1];
        // 球
        const bX = W / 2 + Math.sin(state.frame / 8) * 10;
        px(bX, H - 8 - Math.abs(Math.sin(state.frame / 4)) * 5, 3, 3, '#ff6f92');
        break;
      case 'dizzy':
        P.squash = 0.9;
        P.bodyY = Math.sin(state.frame / 3) * 1.5;
        P.headY = Math.sin(state.frame / 3) * 0.8;
        P.eyeOpenH = 1;
        P.tailA = 0;
        // 转圈星星
        const sc = Math.cos(state.frame / 6) * 6;
        const sy = Math.sin(state.frame / 6) * 6;
        px(W / 2 + sc, H - 22 + sy, 3, 3, PAL.star);
        px(W / 2 - sc, H - 22 - sy, 3, 3, PAL.star);
        break;
    }
    // 动作超时回 idle
    if (state.act !== 'idle' && state.actT > (state.actDur || 1.2)) {
      state.act = 'idle';
      state.actT = 0;
    }
  }

  function addWalk(f, speed) {
    const step = Math.sin(f * Math.PI * 2 * speed);
    P.legL = [Math.round(step * 3), Math.max(0, step) * 2];
    P.legR = [Math.round(-step * 3), Math.max(0, -step) * 2];
    P.bodyY = Math.abs(step) * 0.6;
    P.headY = Math.abs(step) * 0.2;
    P.tailA = step * 0.5;
  }

  // ===== 配件：道具（碗/球等） =====
  function drawAccessories() {
    if (state.act === 'eat') {
      const hx = W / 2 + P.headX;
      px(hx - 1, H - 6, 7, 2, '#8a5a2a');   // 碗底
      px(hx - 1, H - 8, 7, 1, '#c98a4a');   // 碗沿
      px(hx, H - 9, 5, 1, '#ffd94d');       // 食物
      px(hx, H - 10, 3, 1, '#f59e3a');      // 食物堆
    }
  }

  // ===== 对外接口 =====
  function expose() {
    window.PixCat = {
      init,
      play: playAct,
      setAct,
      setExpr: function (e) { state.expr = e; },
      setDizzy: function () { startDizzy(); },
      getState: function () { return { act: state.act, expr: state.expr }; },
    };
  }
  function startDizzy() {
    state.dizzy = 1.5;
    state.act = 'dizzy'; state.actT = 0;
    state.actDur = 1.5;
  }

  expose();
})();
