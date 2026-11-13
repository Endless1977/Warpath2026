// Warpath 2026 — geluid (originele Warpath-samples via WebAudio)
'use strict';
(function () {
const A = {
  ctx: null, buf: {}, master: null, vol: 0.7, muted: false, last: {}, ready: false, ambient: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.loaded; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return Promise.resolve();
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    const S = window.WP_SOUNDS || {};
    const jobs = [];
    // opstartgeluid eerst decoderen zodat het meteen kan klinken
    const keys = Object.keys(S).sort((a, b) => (b === 'busterx') - (a === 'busterx'));
    for (const k of keys) {
      const b64 = S[k].split(',')[1], bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      jobs.push(this.ctx.decodeAudioData(arr.buffer).then(b => { this.buf[k] = b; }).catch(() => {}));
    }
    this.loaded = Promise.all(jobs).then(() => { this.ready = true; });
    return this.loaded;
  },
  // wacht tot één geluid gedecodeerd is en speel het dan
  async playWhenReady(name, vol, timeoutMs = 2500) {
    const t0 = performance.now();
    while (!this.buf[name] && performance.now() - t0 < timeoutMs) await new Promise(r => setTimeout(r, 30));
    this.play(name, vol);
  },
  play(name, vol = 1, pan = 0, rate = 1) {
    if (!this.ctx || this.muted) return;
    const b = this.buf[name]; if (!b) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.06) return;
    this.last[name] = now;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = Math.max(0, Math.min(1, vol));
    let node = g;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
    s.connect(g); node.connect(this.master); s.start();
  },
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.vol; if (this.ambient) this.ambient.g.gain.value = this.muted ? 0 : 0.05; return this.muted; },
  // zachte ruimte-drone als achtergrond
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const c = this.ctx, g = c.createGain(); g.gain.value = 0.05; g.connect(this.master);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.connect(g);
    const oscs = [55, 82.4, 110.2, 164.8].map((fr, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = fr; o.detune.value = (i - 1.5) * 7;
      const og = c.createGain(); og.gain.value = 0.22 / (i + 1); o.connect(og); og.connect(f); o.start();
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + i * 0.031; const lg = c.createGain(); lg.gain.value = 0.12 / (i + 1); lfo.connect(lg); lg.connect(og.gain); lfo.start();
      return o;
    });
    this.ambient = { g, oscs };
  },
};
WP.Audio = A;
})();
