// ============================================
//  羊毛旅行系统
//  自动出发 + AI 故事 + 像素明信片 + 分享
// ============================================
(function () {
  const TRAVEL_DESTINATIONS = [
    { name: '金色沙滩', emoji: '🏖️', gift: '一条小鱼干' },
    { name: '雪山之巅', emoji: '🏔️', gift: '一根冰凌羽毛' },
    { name: '樱花森林', emoji: '🌸', gift: '一朵樱花' },
    { name: '星空草原', emoji: '🌌', gift: '一颗流星碎片' },
    { name: '猫咪都市', emoji: '🏙️', gift: '一枚金币' },
    { name: '海底世界', emoji: '🐚', gift: '一颗珍珠' },
    { name: '魔法沙漠', emoji: '🏜️', gift: '一瓶魔法沙子' },
    { name: '云上村庄', emoji: '☁️', gift: '一把彩虹毛线球' },
  ];

  let traveling = false;
  let currentTravel = null;

  function pickDestination() {
    return TRAVEL_DESTINATIONS[Math.floor(Math.random() * TRAVEL_DESTINATIONS.length)];
  }

  async function generateStory(dest) {
    const cfg = window.AI_CONFIG;
    if (!cfg || !cfg.apiKey) return `喵~羊毛去了${dest.name}，遇到一只${['白猫','橘猫','三花猫','小黑猫'][Math.floor(Math.random()*4)]}，玩得超开心！`;
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({
          model: cfg.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是长毛金渐层猫"羊毛"，和主人小易、洋洋一起生活。用第一人称写旅行日记，猫咪语气（偶尔带"喵"），30-50字，温暖俏皮。' },
            { role: 'user', content: `我刚刚去了${dest.name}，写一篇旅行日记。` }
          ],
          max_tokens: 80
        })
      });
      const j = await r.json();
      return j.choices && j.choices[0] ? j.choices[0].message.content.trim() : `喵~我在${dest.name}玩得很开心！`;
    } catch (e) {
      return `喵~羊毛去了${dest.name}，遇到一只${['白猫','橘猫','三花猫'][Math.floor(Math.random()*3)]}，玩得超开心！`;
    }
  }

  // 检查当前旅行状态
  async function checkTravel() {
    if (!window.Sync) return;
    const rows = await window.Sync.loadTravels(1);
    if (rows && rows.length > 0 && !rows[0].returned) {
      // 正在旅行中
      traveling = true;
      currentTravel = rows[0];
      const departed = new Date(rows[0].departed_at).getTime();
      const elapsed = (Date.now() - departed) / 3600000; // 小时
      if (elapsed >= 3) { // 旅行 3 小时后回来
        // 该回来了！
        await returnFromTravel(rows[0]);
      }
    } else {
      traveling = false;
      currentTravel = null;
      // 检查该不该出发（上次回来后 >4h）
      const last = rows && rows.length > 0 ? rows[0] : null;
      const sinceLast = last ? (Date.now() - new Date(last.returned_at || last.departed_at).getTime()) / 3600000 : 999;
      if (sinceLast >= 4 && Math.random() < 0.4) {
        await departTravel();
      }
    }
  }

  async function departTravel() {
    const dest = pickDestination();
    if (window.Sync) {
      await window.Sync.addTravel({ destination: dest.name, gift: dest.emoji + ' ' + dest.gift });
      traveling = true;
      if (window.Sfx) window.Sfx.play();
      if (window.onWoolTravel) window.onWoolTravel(dest);
    }
  }

  async function returnFromTravel(travel) {
    const dest = TRAVEL_DESTINATIONS.find(d => d.name === travel.destination) || { name: travel.destination, gift: travel.gift };
    const story = await generateStory(dest);
    if (window.Sync) {
      await window.Sync.returnTravel(travel.id, story);
      traveling = false;
      currentTravel = null;
      if (window.Sfx) window.Sfx.upgrade();
      if (window.onWoolReturn) window.onWoolReturn({ ...travel, story, gift: travel.gift });
    }
  }

  // 初始化
  function init() {
    checkTravel();
    setInterval(checkTravel, 60000); // 每分钟检查一次
  }

  // 暴露
  window.Travel = {
    init,
    checkTravel,
    isTraveling: () => traveling,
    current: () => currentTravel,
  };
})();
