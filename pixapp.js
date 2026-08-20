// 像素猫 UI 逻辑：状态系统 + 按钮 + 留言板 + 健康度 + 表情态
(function () {
  const state = { hunger: 100, clean: 100, mood: 100 };

  // 初始化像素猫
  if (window.PixCat) window.PixCat.init(document.getElementById('stage'));

  // 互动效果
  const ACTIONS = {
    feed:  { hunger:+20, clean:-4,  mood:+8,  bubble:'好吃! 😋', act:'eat' },
    clean: { hunger:0,   clean:+30, mood:+5,  bubble:'香香哒 ✨🚿', act:'bath' },
    pet:   { hunger:0,   clean:0,   mood:+12, bubble:'呼噜呼噜~ 😊', act:'pet' },
    play:  { hunger:-8,  clean:-10, mood:+15, bubble:'玩起来啦! 🎉', act:'play' },
  };

  function clamp(v){ return Math.max(0, Math.min(100, v)); }

  function doAct(name) {
    const a = ACTIONS[name]; if (!a) return;
    state.hunger = clamp(state.hunger + a.hunger);
    state.clean = clamp(state.clean + a.clean);
    state.mood = clamp(state.mood + a.mood);
    // 播放动作
    if (window.PixCat) {
      if (a.act === 'eat') window.PixCat.play('eat', 2.0);
      else if (a.act === 'play') window.PixCat.play('play', 1.6);
      else if (a.act === 'bath') window.PixCat.play('bath', 3.0);
      else window.PixCat.play('pet', 1.0);
    }
    showBubble(a.bubble);
    updateUI();
  }

  function showBubble(text) {
    const b = document.getElementById('bubble');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(window.__bubT);
    window.__bubT = setTimeout(() => b.classList.remove('show'), 1600);
  }

  function updateUI() {
    const bar = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = Math.round(v) + '%'; };
    const val = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
    bar('hBar', state.hunger); bar('cBar', state.clean); bar('mBar', state.mood);
    val('hVal', state.hunger); val('cVal', state.clean); val('mVal', state.mood);

    // 表情状态
    let expr = 'normal';
    if (state.hunger < 20 || state.clean < 20 || state.mood < 20) expr = 'sad';
    else if (state.mood >= 80) expr = 'happy';
    else if (state.hunger < 40) expr = 'tired';
    if (window.PixCat) window.PixCat.setExpr(expr === 'tired' ? 'tired' : expr);

    // 健康度
    const worst = Math.min(state.hunger, state.clean, state.mood);
    const avg = (state.hunger + state.clean + state.mood) / 3;
    const h = document.getElementById('health');
    const tip = document.getElementById('need-tip');
    let cls='health-good', label='💚 状态良好', tipText='';
    if (worst < 25){ cls='health-bad'; label='💔 需要照顾'; tipText='它不太舒服，快去照顾它 🥺'; }
    else if (avg<45){ cls='health-ok'; label='😟 状态一般'; tipText='多陪陪它 🥺'; }
    else if (avg<70){ cls='health-ok'; label='🙂 还行'; }
    h.className=cls; h.textContent=label;
    tip.textContent=tipText; tip.className=tipText?'show':'';
  }

  // 衰减
  setInterval(()=>{
    state.hunger = clamp(state.hunger - 1.2);
    state.clean = clamp(state.clean - 0.6);
    state.mood = clamp(state.mood - 0.8);
    updateUI();
    if (window.PixCat) window.PixCat.setAct('idle');
  }, 5000);

  // 按钮
  document.querySelectorAll('.act').forEach(btn => {
    btn.addEventListener('click', () => doAct(btn.dataset.act));
  });

  // 点舞台
  const stage = document.getElementById('stage');
  stage.addEventListener('click', (e) => {
    if (e.target.id === 'bubble' || e.target.id === 'health' || e.target.id === 'need-tip') return;
    doAct('pet');
  });
  // 拖动累计眩晕彩蛋
  let dragAccum = 0, dragging = false, px = 0;  stage.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - px; px = e.clientX;
    if (dx !== 0 && window.PixCat) {
      // 拖动走路的动作
      dragAccum += Math.abs(dx);
      if (dragAccum > 60) window.PixCat.setAct(dragAccum > 180 ? 'run' : 'walk');
      if (dragAccum >= 360 * 3) { // 转一整圈（数值模拟）
        dragAccum = 0;
        if (window.PixCat) { window.PixCat.setDizzy(); }
        showBubble('🌀 转晕啦~');
      }
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; if (window.PixCat) window.PixCat.setAct('idle'); });

  // 留言板
  const messages = JSON.parse(localStorage.getItem('pixcat-msgs') || '["大家好！一起养像素小橘猫吧 🐱"]');
  function renderMsgs() {
    const list = document.getElementById('msgList');
    list.innerHTML = messages.map((m,i)=>`<div class="msg"><div class="m">🐱 网友${i+1}</div>${esc(m)}</div>`).join('');
    list.scrollLeft = list.scrollWidth;
  }
  function esc(s){ return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  document.getElementById('msgSend').addEventListener('click', () => {
    const inp = document.getElementById('msgInput');
    const v = inp.value.trim();
    if (v){ messages.push(v); localStorage.setItem('pixcat-msgs', JSON.stringify(messages)); renderMsgs(); inp.value=''; }
  });
  document.getElementById('msgInput').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('msgSend').click(); });
  renderMsgs();
  updateUI();

  // ===== AI 对话（DeepSeek） =====
  let chatBusy = false;
  function buildSystem() {
    const cfg = window.AI_CONFIG || {};
    // 注入当前状态到人设
    let moodDesc = '';
    if (state.hunger < 25) moodDesc = '我现在非常饿，正想要吃的';
    else if (state.mood < 25) moodDesc = '我现在心情很不好，需要安慰';
    else if (state.clean < 25) moodDesc = '我现在有点脏，想洗澡';
    else if (state.mood >= 80) moodDesc = '我现在心情很好，想玩耍';
    return (cfg.system || '') + ' 当前状态：' + moodDesc + '。用中文、以羊毛的口吻简短回答。';
  }
  async function chatWithAI(userText) {
    const cfg = window.AI_CONFIG;
    if (!cfg || !cfg.apiKey || chatBusy) { return; }
    chatBusy = true;
    const st = document.getElementById('chatStatus');
    if (st) { st.style.display = 'block'; st.textContent = '正在想怎么回…'; }
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({
          model: cfg.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: buildSystem() },
            { role: 'user', content: userText }
          ],
          max_tokens: 80
        })
      });
      const j = await r.json();
      if (j.choices && j.choices[0]) {
        const reply = j.choices[0].message.content.trim();
        showBubble(reply);
      } else {
        showBubble('喵…我走神了~');
      }
    } catch (e) {
      showBubble('喵…信号不好，等等再找我');
    } finally {
      chatBusy = false;
      if (st) st.style.display = 'none';
    }
  }

  // 聊天输入框
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  function sendChat() {
    const v = chatInput.value.trim();
    if (!v) return;
    chatInput.value = '';
    showBubble('喵……');
    chatWithAI(v);
  }
  if (chatSend) chatSend.addEventListener('click', sendChat);
  if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

  // ===== AI 主动行为（按状态触发，偶尔让 AI 说话） =====
  function aiBehavior() {
    if (!window.PixCat) return;
    const worst = Math.min(state.hunger, state.clean, state.mood);
    // 状态差时主动撒娇/提醒
    if (state.hunger < 30) {
      window.PixCat.play('eat', 1);
      if (Math.random() < 0.4) showBubble('喵…羊毛有点饿了，喂喂我好不好～');
    } else if (state.clean < 30) {
      window.PixCat.play('pet', 0.8);
      if (Math.random() < 0.4) showBubble('我好像该洗个澡了呢…');
    } else if (state.mood < 30) {
      if (Math.random() < 0.4) showBubble('喵…有点孤独，能陪陪我吗');
    } else {
      // 状态好时偶尔活泼
      if (Math.random() < 0.25) {
        const acts = ['play', 'pet', 'walk'];
        window.PixCat.play(acts[Math.floor(Math.random() * acts.length)], 1.2);
      }
    }
  }
  setInterval(aiBehavior, 20000); // 每 20 秒评估一次
})();
