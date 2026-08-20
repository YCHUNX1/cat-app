// 普通脚本模式：调用 window 暴露的 3D 函数 + UI 逻辑

// 漂浮装饰生成
(function () {
  const emojis = ['🦊', '💖', '✨', '🍃', '⭐', '🌸'];
  const deco = document.getElementById('deco');
  if (deco) {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.textContent = emojis[i % emojis.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.fontSize = (14 + Math.random() * 14) + 'px';
      s.style.animationDuration = (12 + Math.random() * 14) + 's';
      s.style.animationDelay = (Math.random() * 12) + 's';
      deco.appendChild(s);
    }
  }
})();

// 启动 3D
function boot() {
  if (!window.initCat3D) { setTimeout(boot, 100); return; }
  try { window.initCat3D(document.getElementById('stage')); }
  catch (e) { if (window.__catDiag) window.__catDiag.errors.push('init error: ' + e.message); }
}
boot();

// 互动按钮 + 健康度刷新
function refreshHealth() {
  if (!window.getState3D) return;
  const s = window.getState3D();
  const h = document.getElementById('health');
  const tip = document.getElementById('need-tip');
  if (!h) return;
  const worst = Math.min(s.hunger, s.clean, s.mood);
  const avg = (s.hunger + s.clean + s.mood) / 3;
  let cls = 'health-good', label = '💚 状态良好', tipText = '';
  if (worst < 25) { cls = 'health-bad'; label = '💔 需要照顾'; tipText = '它看起来不太舒服，快去照顾它吧 🥺'; }
  else if (avg < 45) { cls = 'health-ok'; label = '😟 状态一般'; tipText = '多陪陪它，它会开心的 🥺'; }
  else if (avg < 70) { cls = 'health-ok'; label = '🙂 还行'; tipText = ''; }
  h.className = cls; h.textContent = label;
  tip.textContent = tipText;
  tip.className = tipText ? 'show' : '';
}

document.querySelectorAll('.act').forEach(btn => {
  btn.addEventListener('click', () => {
    if (window.doAction3D) window.doAction3D(btn.dataset.act);
    setTimeout(refreshHealth, 400);
  });
});

// 点击舞台摸摸
const stage = document.getElementById('stage');
stage.addEventListener('click', (e) => {
  if (e.target === stage || e.target.id === 'bubble' || e.target.id === 'health' || e.target.id === 'need-tip') return;
  if (window.doAction3D) window.doAction3D('pet');
  setTimeout(refreshHealth, 400);
});

// 定时刷新健康度
setInterval(refreshHealth, 2000);
refreshHealth();

// 留言板（本地模拟）
const messages = JSON.parse(localStorage.getItem('fox-msgs') || '["大家好！我们一起养小狐狸吧 🦊"]');
function renderMsgs() {
  const list = document.getElementById('msgList');
  list.innerHTML = messages.map((m, i) =>
    `<div class="msg"><div class="m">🦊 网友${i+1}</div>${escapeHtml(m)}</div>`
  ).join('');
  list.scrollLeft = list.scrollWidth;
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
document.getElementById('msgSend').addEventListener('click', () => {
  const inp = document.getElementById('msgInput');
  const v = inp.value.trim();
  if (v) { messages.push(v); localStorage.setItem('fox-msgs', JSON.stringify(messages)); renderMsgs(); inp.value=''; }
});
document.getElementById('msgInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('msgSend').click();
});
renderMsgs();
