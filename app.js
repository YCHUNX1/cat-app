import { initCat3D, doAction3D } from './app3d.js';

// 启动 3D
const stage = document.getElementById('stage');
initCat3D(stage);

// 互动按钮
document.querySelectorAll('.act').forEach(btn => {
  btn.addEventListener('click', () => doAction3D(btn.dataset.act));
});

// 点击舞台也摸摸猫
stage.addEventListener('click', (e) => {
  if (e.target === stage || e.target === document.getElementById('bubble')) return;
  doAction3D('pet');
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
