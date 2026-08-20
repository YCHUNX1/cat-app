// ============================================
//  Supabase 多人同步逻辑
//  共享羊毛状态 + 共享留言 + 实时订阅
// ============================================
(function () {
  const cfg = window.SB_CONFIG;
  let sb = null, stateChannel = null;
  let connected = false; // 是否已连上/加载到共享状态
  const listeners = { state: [], msgs: [] };

  function createClient() {
    if (!cfg || !window.supabase) return null;
    try { return window.supabase.createClient(cfg.url, cfg.anonKey); }
    catch (e) { console.error('supabase init fail', e); return null; }
  }

  // ---- 状态 ----
  function loadState() {
    if (!sb) return Promise.resolve(null);
    return sb.from(cfg.stateTable).select('*').eq('id', 1).maybeSingle()
      .then(({ data, error }) => (error ? null : data))
      .catch(() => null);
  }
  function saveState(partial) {
    if (!sb) return Promise.resolve(false);
    partial.last_updated = new Date().toISOString();
    return sb.from(cfg.stateTable).update(partial).eq('id', 1)
      .then(({ error }) => !error)
      .catch(() => false);
  }

  // ---- 留言 ----
  function loadMsgs() {
    if (!sb) return Promise.resolve([]);
    return sb.from(cfg.msgsTable).select('*').order('created_at', { ascending: true })
      .then(({ data, error }) => (error ? [] : (data || [])))
      .catch(() => []);
  }
  function addMsg(nickname, content) {
    if (!sb) return Promise.resolve(false);
    return sb.from(cfg.msgsTable).insert({ nickname, content })
      .then(({ error }) => !error)
      .catch(() => false);
  }

  // ---- 实时订阅 ----
  function subscribe(onState, onMsg) {
    if (!sb) return;
    // 状态表变化 → 通知
    const ch = sb.channel(cfg.realtimeChannel)
      .on('postgres_changes', { event: '*', schema: 'public', table: cfg.stateTable }, onState)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: cfg.msgsTable }, onMsg)
      .subscribe();
    stateChannel = ch;
  }

  // ---- 主入口 ----
  function init(opts) {
    opts = opts || {};
    sb = createClient();
    if (!sb) { if (opts.onError) opts.onError('supabase 不可用'); return; }
    // 首次加载共享状态
    loadState().then(function (data) {
      connected = true;
      if (data && opts.onState) opts.onState(data, true); // true=来自云端
      else if (opts.onError) opts.onError('未能加载共享状态');
    });
    // 订阅实时
    subscribe(function (payload) { if (opts.onState) opts.onState(payload.new, false); },
      function (payload) { if (opts.onMsg) opts.onMsg(payload.new); });
  }

  window.Sync = {
    init,
    loadState, saveState,
    loadMsgs, addMsg,
    isConnected: function () { return connected; },
    on(t, fn) { listeners[t].push(fn); },
  };
})();
