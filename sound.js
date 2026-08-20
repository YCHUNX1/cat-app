// ============================================
//  音效系统（Web Audio API 程序化生成）
// ============================================
(function () {
  let ctx = null;
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // 单音
  function tone(freq, dur, type, vol, slideTo) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }
  // 噪声（水花/气泡）
  function noise(dur, vol, filterFreq) {
    const a = audio(); if (!a) return;
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq || 800;
    const g = a.createGain(); g.gain.value = vol || 0.1;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(); src.stop(a.currentTime + dur);
  }

  window.Sfx = {
    feed: function () { tone(800, 0.08, 'square', 0.12); setTimeout(() => tone(1200, 0.06, 'sine', 0.1), 60); },
    clean: function () { noise(0.3, 0.12, 1200); setTimeout(() => noise(0.2, 0.08, 1500), 150); },
    pet: function () { tone(120, 0.25, 'sawtooth', 0.06, 80); },
    play: function () { tone(600, 0.08, 'sine', 0.1); setTimeout(() => tone(900, 0.08, 'sine', 0.1), 80); setTimeout(() => tone(1200, 0.1, 'sine', 0.12), 160); },
    upgrade: function () { tone(523, 0.12, 'sine', 0.12); setTimeout(() => tone(659, 0.12, 'sine', 0.12), 120); setTimeout(() => tone(784, 0.15, 'sine', 0.14), 240); setTimeout(() => tone(1047, 0.2, 'sine', 0.12), 380); },
    dizzy: function () { tone(400, 0.5, 'sawtooth', 0.08, 120); },
    walk: function () { tone(200, 0.05, 'square', 0.05); },
    click: function () { tone(1000, 0.03, 'square', 0.08); },
    purr: function () { tone(25, 0.3, 'sawtooth', 0.04); setTimeout(() => tone(30, 0.3, 'sawtooth', 0.04), 150); },
  };
})();
