// ============================================
//  Supabase 多人同步 + 真实时间衰减 + 成长
// ============================================
(function () {
  const cfg = window.SB_CONFIG;
  let sb = null;
  let connected = false;

  // 自然衰减速率（每秒）：饥饿掉得最快，心情其次，清洁最慢
  const RATE = { hunger: 100/7200, clean: 100/10800, mood: 100/9000 }; // 约 2h/3h/2.5h 从满到 0
  const FLOOR = 10; // 保底：任何状态不低于 10

  function createClient(){ if(!cfg||!window.supabase)return null; try{return window.supabase.createClient(cfg.url,cfg.anonKey);}catch(e){return null;} }

  function loadState(){
    if(!sb)return Promise.resolve(null);
    return sb.from(cfg.stateTable).select('*').eq('id',1).maybeSingle().then(({data,error})=>error?null:data).catch(()=>null);
  }

  // 基于 last_updated 计算真实时间衰减
  // 返回 handle()：传入要更新的字段，自动算 elapsed 衰减 + 保底 + 写回
  function computeDecay(data){
    if(!data)return {elapsed:0,h:100,c:100,m:100};
    const last = data.last_updated ? new Date(data.last_updated).getTime() : Date.now();
    const now = Date.now();
    let elapsed = Math.max(0, (now-last)/1000);
    elapsed = Math.min(elapsed, 7200); // 上限 2 小时，避免无人管时一次扣空
    const dH = Math.round(elapsed*RATE.hunger);
    const dC = Math.round(elapsed*RATE.clean);
    const dM = Math.round(elapsed*RATE.mood);
    return {
      elapsed,
      h: Math.max(FLOOR, clamp(data.hunger - dH)),
      c: Math.max(FLOOR, clamp(data.clean - dC)),
      m: Math.max(FLOOR, clamp(data.mood - dM)),
      changed: dH>0||dC>0||dM>0,
    };
  }
  function clamp(v){ return Math.max(0, Math.min(100, v)); }

  function saveState(partial){
    if(!sb)return Promise.resolve(false);
    partial.last_updated = new Date().toISOString();
    return sb.from(cfg.stateTable).update(partial).eq('id',1).then(({error})=>!error).catch(()=>false);
  }

  function loadMsgs(){ if(!sb)return Promise.resolve([]); return sb.from(cfg.msgsTable).select('*').order('created_at',{ascending:true}).then(({data,error})=>error?[]:(data||[])).catch(()=>[]); }
  function addMsg(nickname,content){ if(!sb)return Promise.resolve(false); return sb.from(cfg.msgsTable).insert({nickname,content}).then(({error})=>!error).catch(()=>false); }
  // 旅行
  function loadTravels(limit){ if(!sb)return Promise.resolve([]); return sb.from('yangmao_travels').select('*').order('departed_at',{ascending:false}).limit(limit||10).then(({data,error})=>error?[]:(data||[])).catch(()=>[]); }
  function addTravel({destination,gift,duration}){ if(!sb)return Promise.resolve(false); return sb.from('yangmao_travels').insert({destination,gift,duration:duration||3}).then(({error})=>!error).catch(()=>false); }
  function returnTravel(id,story){ if(!sb)return Promise.resolve(false); return sb.from('yangmao_travels').update({returned:true,story,returned_at:new Date().toISOString()}).eq('id',id).then(({error})=>!error).catch(()=>false); }
  // 时间线
  function loadEvents(limit){ if(!sb)return Promise.resolve([]); return sb.from('yangmao_events').select('*').order('created_at',{ascending:false}).limit(limit||30).then(({data,error})=>error?[]:(data||[])).catch(()=>[]); }
  function addEvent(nickname,action){ if(!sb)return Promise.resolve(false); return sb.from('yangmao_events').insert({nickname,action}).then(({error})=>!error).catch(()=>false); }

  // 成长：经验与等级
  function xpForLevel(level){ return (level-1)*100 + 50; } // 每级基础经验
  function addXp(cur={}, amount){
    let xp=(cur.xp||0)+amount, level=cur.level||1;
    while(xp >= xpForLevel(level)){ xp-=xpForLevel(level); level++; if(level>99)break; }
    return { xp, level };
  }

  function subscribe(onState,onMsg){
    if(!sb)return;
    sb.channel(cfg.realtimeChannel)
      .on('postgres_changes',{event:'*',schema:'public',table:cfg.stateTable},onState)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:cfg.msgsTable},onMsg)
      .subscribe();
  }

  function init(opts){
    opts=opts||{};
    sb=createClient();
    if(!sb){ if(opts.onError)opts.onError('supabase 不可用'); return; }
    loadState().then(function(data){
      connected=true;
      if(opts.onReady)opts.onReady();
      if(data && opts.onState){
        const dec = computeDecay(data);
        // 如果随时间有衰减，写回（把"流逝的时间"消化掉）
        if(dec.changed) saveState({hunger:dec.h,clean:dec.c,mood:dec.m}).then(function(ok){
          // 写回后重新拉一份最新的（含新 last_updated）给前端
          loadState().then(function(d2){ if(d2)opts.onState(d2,true); });
        });
        else {
          // 无衰减，直接用
          opts.onState({hunger:dec.h,clean:dec.c,mood:dec.m,xp:data.xp,level:data.level,last_updated:data.last_updated},true);
        }
      }
      else if(opts.onError)opts.onError('未能加载共享状态');
    });
    subscribe(function(payload){ if(opts.onState)opts.onState(payload.new,false); },
              function(payload){ if(opts.onMsg)opts.onMsg(payload.new); });
  }

  window.Sync = {
    init, loadState, saveState, loadMsgs, addMsg,
    computeDecay, addXp,
    loadEvents, addEvent,
    loadTravels, addTravel, returnTravel,
    isConnected:function(){return connected;},
  };
})();
