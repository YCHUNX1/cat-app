// 像素猫 UI：状态 + 互动 + Supabase 多人同步 + 留言 + AI
(function () {
  const state = { hunger: 100, clean: 100, mood: 100 };
  // 本地是否已从云端初始化
  let cloudReady = false;
  let lastLocalWrite = 0;
  const NICK_KEY = 'yangmao-nickname';

  // 昵称
  function getNick() {
    const saved = localStorage.getItem(NICK_KEY);
    if (saved) return saved;
    // 未设置则用浏览器给予的临时名
    return '游客' + Math.floor(Math.random() * 1000);
  }
  function setNick(n) {
    if (n && n.trim()) localStorage.setItem(NICK_KEY, n.trim());
  }

  if (window.PixCat) window.PixCat.init(document.getElementById('stage'));

  const ACTIONS = {
    feed:  { hunger:+20, clean:-4,  mood:+8,  bubble:'好吃! 😋', act:'eat' },
    clean: { hunger:0,   clean:+30, mood:+5,  bubble:'香香哒 ✨🚿', act:'bath' },
    pet:   { hunger:0,   clean:0,   mood:+12, bubble:'呼噜呼噜~ 😊', act:'pet' },
    play:  { hunger:-8,  clean:-10, mood:+15, bubble:'玩起来啦! 🎉', act:'play' },
  };
  function clamp(v){ return Math.max(0, Math.min(100, v)); }

  function showBubble(text) {
    const b = document.getElementById('bubble');
    b.textContent = text; b.classList.add('show');
    clearTimeout(window.__bubT);
    window.__bubT = setTimeout(() => b.classList.remove('show'), 1600);
  }

  function updateUI() {
    const bar=(id,v)=>{const el=document.getElementById(id);if(el)el.style.width=Math.round(v)+'%';};
    const val=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=Math.round(v);};
    bar('hBar',state.hunger);bar('cBar',state.clean);bar('mBar',state.mood);
    val('hVal',state.hunger);val('cVal',state.clean);val('mVal',state.mood);
    let expr='normal';
    if(state.hunger<20||state.clean<20||state.mood<20)expr='sad';
    else if(state.mood>=80)expr='happy';
    else if(state.hunger<40)expr='tired';
    if(window.PixCat)window.PixCat.setExpr(expr==='tired'?'tired':expr);
    const worst=Math.min(state.hunger,state.clean,state.mood);
    const avg=(state.hunger+state.clean+state.mood)/3;
    const h=document.getElementById('health'),tip=document.getElementById('need-tip');
    let cls='health-good',label='💚 状态良好',tipText='';
    if(worst<25){cls='health-bad';label='💔 需要照顾';tipText='它不太舒服，快去照顾它 🥺';}
    else if(avg<45){cls='health-ok';label='😟 状态一般';tipText='多陪陪它 🥺';}
    else if(avg<70){cls='health-ok';label='🙂 还行';}
    h.className=cls;h.textContent=label;
    tip.textContent=tipText;tip.className=tipText?'show':'';
  }

  // 把当前状态写回共享（限频）
  function pushState() {
    if (!window.Sync) return;
    const now = Date.now();
    if (now - lastLocalWrite < 3000) return; // 限频 3 秒
    lastLocalWrite = now;
    window.Sync.saveState({
      hunger: Math.round(state.hunger),
      clean: Math.round(state.clean),
      mood: Math.round(state.mood),
      updated_by: getNick(),
    });
  }

  function doAct(name) {
    const a = ACTIONS[name]; if (!a) return;
    state.hunger=clamp(state.hunger+a.hunger);
    state.clean=clamp(state.clean+a.clean);
    state.mood=clamp(state.mood+a.mood);
    if(window.PixCat){
      if(a.act==='eat')window.PixCat.play('eat',2.0);
      else if(a.act==='play')window.PixCat.play('play',1.6);
      else if(a.act==='bath')window.PixCat.play('bath',3.0);
      else window.PixCat.play('pet',1.0);
    }
    showBubble(a.bubble); updateUI(); pushState();
  }

  // 本地衰减（每 5 秒），写回共享
  setInterval(()=>{
    state.hunger=clamp(state.hunger-1.2);
    state.clean=clamp(state.clean-0.6);
    state.mood=clamp(state.mood-0.8);
    updateUI();
    if(window.PixCat)window.PixCat.setAct('idle');
    pushState();
  },5000);

  // 昵称
  const nickInput=document.getElementById('nickInput'),nickSave=document.getElementById('nickSave');
  if(nickInput){ nickInput.value=getNick(); nickInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&nickSave)nickSave.click();}); }
  if(nickSave){ nickSave.addEventListener('click',()=>{ setNick(nickInput.value); showBubble('好的，你是 '+getNick()+' 😊'); }); }

  // 心动互动
  document.querySelectorAll('.act').forEach(btn=>{
    btn.addEventListener('click',()=>doAct(btn.dataset.act));
  });
  const stage=document.getElementById('stage');
  stage.addEventListener('click',(e)=>{
    if(e.target.id==='bubble'||e.target.id==='health'||e.target.id==='need-tip')return;
    doAct('pet');
  });
  let dragAccum=0,dragging=false,pxpos=0;
  stage.addEventListener('pointerdown',e=>{dragging=true;pxpos=e.clientX;});
  window.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const dx=e.clientX-pxpos;pxpos=e.clientX;
    if(dx!==0&&window.PixCat){
      dragAccum+=Math.abs(dx);
      if(dragAccum>60)window.PixCat.setAct(dragAccum>180?'run':'walk');
      if(dragAccum>=360*3){dragAccum=0;if(window.PixCat)window.PixCat.setDizzy();showBubble('🌀 转晕啦~');}
    }
  });
  window.addEventListener('pointerup',()=>{dragging=false;if(window.PixCat)window.PixCat.setAct('idle');});

  // ===== 留言板（Supabase 共享） =====
  let messages=[];
  function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function renderMsgs(){
    const list=document.getElementById('msgList');
    list.innerHTML=messages.map(m=>`<div class="msg"><div class="m">🐱 ${esc(m.nickname||'匿名')}</div>${esc(m.content)}</div>`).join('');
    list.scrollLeft=list.scrollWidth;
  }
  function refreshMsgs(){
    if(!window.Sync)return;
    window.Sync.loadMsgs().then(function(rows){ messages=rows||[]; renderMsgs(); });
  }
  document.getElementById('msgSend').addEventListener('click',()=>{
    const inp=document.getElementById('msgInput');
    const v=inp.value.trim();
    if(!v)return;
    // 保存昵称（如果输入框昵称位有值）——此处用固定昵称获取逻辑
    if(window.Sync)window.Sync.addMsg(getNick(),v);
    inp.value='';
  });
  document.getElementById('msgInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('msgSend').click();});
  refreshMsgs();

  // ===== Supabase 初始化：加载共享状态 + 实时订阅 =====
  function cloudOnState(data, fromCloud){
    if(!data)return;
    state.hunger=clamp(data.hunger);state.clean=clamp(data.clean);state.mood=clamp(data.mood);
    cloudReady=true;
    updateUI();
  }
  if(window.Sync){
    window.Sync.init({
      onState:cloudOnState,
      onMsg:function(){ refreshMsgs(); },
      onError:function(){ /* 连不上则保持本地 */ }
    });
  }

  updateUI();

  // ===== AI 对话 =====
  let chatBusy=false;
  function buildSystem(){
    const cfg=window.AI_CONFIG||{};
    let moodDesc='';
    if(state.hunger<25)moodDesc='我现在非常饿，正想要吃的';
    else if(state.mood<25)moodDesc='我现在心情很不好，需要安慰';
    else if(state.clean<25)moodDesc='我现在有点脏，想洗澡';
    else if(state.mood>=80)moodDesc='我现在心情很好，想玩耍';
    return (cfg.system||'')+' 当前状态：'+moodDesc+'。用中文、以羊毛的口吻简短回答。';
  }
  async function chatWithAI(userText){
    const cfg=window.AI_CONFIG;
    if(!cfg||!cfg.apiKey||chatBusy)return;
    chatBusy=true;
    const st=document.getElementById('chatStatus');
    if(st){st.style.display='block';st.textContent='正在想怎么回…';}
    try{
      const r=await fetch('https://api.deepseek.com/chat/completions',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey},
        body:JSON.stringify({model:cfg.model||'deepseek-chat',messages:[{role:'system',content:buildSystem()},{role:'user',content:userText}],max_tokens:80})
      });
      const j=await r.json();
      showBubble(j.choices&&j.choices[0]?j.choices[0].message.content.trim():'喵…我走神了~');
    }catch(e){showBubble('喵…信号不好，等等再找我');}
    finally{chatBusy=false;if(st)st.style.display='none';}
  }
  const chatInput=document.getElementById('chatInput'),chatSend=document.getElementById('chatSend');
  function sendChat(){const v=chatInput.value.trim();if(!v)return;chatInput.value='';showBubble('喵……');chatWithAI(v);}
  if(chatSend)chatSend.addEventListener('click',sendChat);
  if(chatInput)chatInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});

  function aiBehavior(){
    if(!window.PixCat)return;
    const worst=Math.min(state.hunger,state.clean,state.mood);
    if(state.hunger<30){window.PixCat.play('eat',1);if(Math.random()<0.4)showBubble('喵…羊毛有点饿了，喂喂我好不好～');}
    else if(state.clean<30){window.PixCat.play('pet',0.8);if(Math.random()<0.4)showBubble('我好像该洗个澡了呢…');}
    else if(state.mood<30){if(Math.random()<0.4)showBubble('喵…有点孤独，能陪陪我吗');}
    else{if(Math.random()<0.25){const a=['play','pet','walk'];window.PixCat.play(a[Math.floor(Math.random()*a.length)],1.2);}}
  }
  setInterval(aiBehavior,20000);
})();
