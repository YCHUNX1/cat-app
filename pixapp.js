// 像素猫 UI：状态 + 互动 + Supabase 多人同步 + 留言 + AI
(function () {
  const state = { hunger: 100, clean: 100, mood: 100, xp: 0, level: 1 };
  // 本地是否已从云端初始化
  let cloudReady = false;
  let lastLocalWrite = 0;
  let xpBarVisible = false;
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
    // 等级显示
    const lt=document.getElementById('levelTag');
    const lvEl=document.querySelector('#levelTag .lv'); const xpEl=document.getElementById('xpFill');
    if(lvEl) lvEl.textContent='Lv.'+(state.level||1);
    if(xpEl && state.xp!==undefined){ var need=state.level*100-50; var pct=Math.max(0,Math.min(100,(state.xp/need)*100)); xpEl.style.width=pct+"%"; }
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
      xp: state.xp||0,
      level: state.level||1,
      updated_by: getNick(),
    });
  }

  function doAct(name) {
    const a = ACTIONS[name]; if (!a) return;
    state.hunger=clamp(state.hunger+a.hunger);
    state.clean=clamp(state.clean+a.clean);
    state.mood=clamp(state.mood+a.mood);
    // 成长：互动加经验（喂最多，其次玩/洗/摸）
    const XP = { feed:8, clean:6, pet:5, play:10 };
    var got = null;
    if(window.Sync && XP[name]){
      got = window.Sync.addXp({xp:state.xp||0, level:state.level||1}, XP[name]);
      state.xp=got.xp; state.level=got.level;
    }
    if(window.PixCat){
      if(a.act==='eat')window.PixCat.play('eat',2.0);
      else if(a.act==='play')window.PixCat.play('play',1.6);
      else if(a.act==='bath')window.PixCat.play('bath',3.0);
      else window.PixCat.play('pet',1.0);
    }
    if(window.Sfx) window.Sfx[a.act] && window.Sfx[a.act]();
    if(window.Sfx && got && got.level > (state.level||1)){ window.Sfx.upgrade(); showBubble('🎉 羊毛升级到 Lv.'+got.level+' 啦！'); }

    showBubble(a.bubble); updateUI(); pushState();
    if(window.Sync && window.Sync.addEvent) window.Sync.addEvent(getNick(), name);
    if(window.Sync) refreshEvents();
  }

  // 周期性兜底同步（本地不再自行衰减，衰减由 sync 基于 last_updated 计算）
  setInterval(()=>{ pushState(); },30000);

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
  // 时间线
  let events=[];
  const ACT_LABEL={feed:'🍗 喂食',clean:'🛁 洗澡',pet:'🤚 抚摸',play:'🎾 玩耍'};
  function timeAgo(t){const s=Math.floor((Date.now()-new Date(t).getTime())/1000);if(s<60)return s+'秒前';if(s<3600)return Math.floor(s/60)+'分钟前';if(s<86400)return Math.floor(s/3600)+'小时前';return Math.floor(s/86400)+'天前';}
  function renderEvents(){const l=document.getElementById('eventList');l.innerHTML=events.map(e=>'<div class="tl-item"><span class="who">'+esc(e.nickname||'匿名')+'</span><span class="act">'+(ACT_LABEL[e.action]||e.action)+'</span><span class="when">'+timeAgo(e.created_at)+'</span></div>').join('');}
  function refreshEvents(){if(!window.Sync)return;window.Sync.loadEvents(30).then(function(rows){events=rows||[];renderEvents();});}
  // 首次引导
  function initGuide(){if(!localStorage.getItem('yangmao_guided')){const g=document.getElementById('guide');if(g)g.style.display='flex';}}
  const guideClose=document.getElementById('guideClose');if(guideClose)guideClose.addEventListener('click',function(){localStorage.setItem('yangmao_guided','1');const g=document.getElementById('guide');if(g)g.style.display='none';});
  initGuide();
  // 联网提示
  function setNet(ok){const d=document.getElementById('netDot');if(!d)return;d.className='dot'+(ok?'':' err');}
  function setNetLoading(){const d=document.getElementById('netDot');if(d)d.className='dot warn';}
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
  let firstCloudLoad=true;
  function cloudOnState(data, fromCloud){
    if(!data)return;
    state.hunger=clamp(data.hunger);state.clean=clamp(data.clean);state.mood=clamp(data.mood);
    if(typeof data.xp!=='undefined')state.xp=data.xp;
    if(typeof data.level!=='undefined')state.level=data.level;
    if(window.PixCat) window.PixCat.setLevel(state.level);
    cloudReady=true;
    updateUI();
    // 首次加载时，若状态很差给温柔提醒（保底体验）
    if(firstCloudLoad && fromCloud){
      firstCloudLoad=false;
      const worst=Math.min(state.hunger,state.clean,state.mood);
      if(worst<20) setTimeout(function(){ showBubble('🥺 羊毛有点难受，好多天没被好好照顾了…快喂喂它吧'); }, 1200);
    }
  }
  if(window.Sync){
    window.Sync.init({
      onState:cloudOnState,
      onMsg:function(){ refreshMsgs(); refreshEvents(); },
      onReady:function(){ setNet(true); },
      onError:function(){ setNet(false); }
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

  // ===== 旅行 =====
  function drawPostcard(dest, story, gift) {
    const c = document.getElementById('pcCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // 背景
    const grd = ctx.createLinearGradient(0,0,0,400);
    grd.addColorStop(0,'#ffe8a0'); grd.addColorStop(1,'#f0c060');
    ctx.fillStyle = grd; ctx.fillRect(0,0,320,400);
    // 像素草地
    ctx.fillStyle = '#8fd373'; ctx.fillRect(0,300,320,100);
    ctx.fillStyle = '#6fc457'; for (let x=0;x<320;x+=16){ ctx.fillRect(x,300,8,100); }
    // 猫（简化像素猫）
    const cx=160, cy=200;
    ctx.fillStyle='#e8c27a'; ctx.fillRect(cx-30,cy-10,60,50); // body
    ctx.fillStyle='#e8c27a'; ctx.fillRect(cx-25,cy-40,50,35); // head
    ctx.fillStyle='#ffc9a1'; ctx.fillRect(cx-18,cy-50,12,12); // ear
    ctx.fillRect(cx+6,cy-50,12,12);
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(cx-15,cy-30,8,6); // eyes
    ctx.fillRect(cx+7,cy-30,8,6);
    ctx.fillStyle='#e88a9a'; ctx.fillRect(cx-5,cy-20,10,5); // nose
    ctx.fillStyle='#fff'; ctx.fillRect(cx-12,cy+15,24,8); // belly
    ctx.fillStyle='#c96f1e'; ctx.fillRect(cx-20,cy+30,12,15); // legs
    ctx.fillRect(cx+8,cy+30,12,15);
    // 目的地 emoji
    ctx.font = '40px serif'; ctx.fillText(dest.emoji || '🐱', cx-20, 140);
    // 装饰
    ctx.font = '12px monospace'; ctx.fillStyle='#3a3028';
    ctx.fillText('~ wool ~', 20, 30);
  }
  function showPostcard(data) {
    document.getElementById('pcDest').textContent = (data.destination || '某地') + ' 旅行日记';
    document.getElementById('pcStory').textContent = data.story || '喵~我去旅行啦！';
    document.getElementById('pcGift').textContent = '带回礼物：' + (data.gift || '满满的思念');
    const destObj = { emoji: '🐱' };
    drawPostcard(destObj, data.story, data.gift);
    document.getElementById('postcardModal').style.display = 'flex';
  }
  window.onWoolTravel = function(dest) {
    const bar = document.getElementById('travelBar');
    const txt = document.getElementById('travelText');
    if (bar) bar.style.display = 'flex';
    if (txt) txt.textContent = '羊毛出门去 ' + dest.name + ' 旅行了，过会儿回来～';
  };
  window.onWoolReturn = function(data) {
    const bar = document.getElementById('travelBar');
    if (bar) bar.style.display = 'none';
    showPostcard(data);
    if (typeof refreshEvents === 'function') refreshEvents();
  };
  document.getElementById('pcClose').addEventListener('click', function() {
    document.getElementById('postcardModal').style.display = 'none';
  });
  document.getElementById('pcSave').addEventListener('click', function() {
    const c = document.getElementById('pcCanvas');
    const link = document.createElement('a');
    link.download = 'wool-postcard.png'; link.href = c.toDataURL(); link.click();
  });
  if (window.Travel) window.Travel.init();
})();
