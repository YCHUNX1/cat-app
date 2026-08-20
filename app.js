// 普通脚本模式：直接调用 window 上暴露的 3D 函数（由 app3d.js 挂载）
// 注意：取决于脚本加载顺序（three.min.js -> app3d.js -> app.js）

// 启动 3D
function boot() {
  if (!window.initCat3D) {
    // 说明 app3d.js 还没加载好，稍等再试
    setTimeout(boot, 100);
    return;
  }
  const stage = document.getElementById('stage');
  try {
    window.initCat3D(stage);
  } catch (e) {
    if (window.__catDiag) window.__catDiag.errors.push('initCat3D error: ' + (e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e.message));
  }
}
boot();

// 互动按钮
document.querySelectorAll('.act').forEach(btn => {
  btn.addEventListener('click', () => window.doAction3D && window.doAction3D(btn.dataset.act));
});

// 点击舞台也摸摸猫
const stage = document.getElementById('stage');
stage.addEventListener('click', (e) => {
  if (e.target === stage || e.target.id === 'bubble') return;
  if (window.doAction3D) window.doAction3D('pet');
});

// 留言板（本地模拟）
const messages = JSON.parse(localStorage.getItem('cat-msgs') || '["大家好！我们一起养小橘猫吧 🐱"]');
function renderMsgs() {
  const list = document.getElementById('msgList');
  list.innerHTML = messages.map((m, i) =>
    `<div class="msg"><div class="m">🐈 网友${i+1}</div>${escapeHtml(m)}</div>`
  ).join('');
  list.scrollLeft = list.scrollWidth;
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
document.getElementById('msgSend').addEventListener('click', () => {
  const inp = document.getElementById('msgInput');
  const v = inp.value.trim();
  if (v) { messages.push(v); localStorage.setItem('cat-msgs', JSON.stringify(messages)); renderMsgs(); inp.value=''; }
});
document.getElementById('msgInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('msgSend').click();
});
renderMsgs();
