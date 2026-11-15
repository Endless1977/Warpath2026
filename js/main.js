// Warpath 2026 — app: menu, inschrijving, spel-lus, invoer
'use strict';
(function () {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('wp2026_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('wp2026_' + k, JSON.stringify(v)); } catch (e) {} } };

const App = {
  mode: 'menu', role: null, sim: null, net: null, myId: null, view: null, me: null, hoverPlanet: null, hoverShip: null, pov: null,
  mouse: { x: 0, y: 0, g: null, down: false, drag: null, fireHeld: false, fireT: 0 },
  texUrls: new Map(), knownSet: new Set(), labels: [],

  init() {
    this.renderer = new WP.Renderer($('#c'));
    WP.UI.init(this);
    this.bindInput();
    this.me = null;
    this.enlist = store.get('enlist', { name: 'Kapitein ' + ['Nova', 'Orion', 'Vega', 'Rigel'][Math.floor(Math.random() * 4)], path: 'green', empire: 0, design: 0 });
    this.settings = Object.assign(WP.DEFAULT_SETTINGS(), store.get('settings', {}));
    if (this.settings.gameSpeed == null) this.settings.gameSpeed = 2;
    this.startDemo();
    this.menuBind();
    const q = new URLSearchParams(location.search).get('join');
    if (q) { $('#joincode').value = q.toUpperCase(); this.showJoin(); }
    let last = performance.now();
    const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; this.tick(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const unlock = () => { WP.Audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    this.splash(!!q);
    this.menuSounds();
  },

  // ---------- demo achter het titelscherm ----------
  startDemo() {
    const en = [];
    for (let i = 0; i < 6; i++) en.push({ id: 'd' + i, name: WP.BOT_NAMES[i], human: false, path: i % 2 ? 'red' : 'green', empire: i * 2, design: i % 6, octant: [0, 1, 3, 4, 5, 7][i], aiLevel: 3 });
    this.demo = new WP.Sim({ timeLimit: 0, cash: 2000000, tek: 5, map: 'normal' }, en, 2026);
    for (const p of this.demo.players) p.visited = this.demo.planets.map(q => q.id);
    for (let i = 0; i < 30 * 40; i++) this.demo.step(1 / 30);
    this.demo.events.length = 0;
    this.renderer.clearWorld(); this.renderer.setupGalaxy(this.demo, this.demo.settings);
    this.renderer.view.mode = 'map'; this.renderer.view.blend = 1; this.renderer.view.mapZoom = 23000; this.renderer.view.mapPitch = 0.55;
  },

  // ---------- menu ----------
  menuBind() {
    $('#btn-solo').onclick = () => this.openLobby('solo');
    $('#btn-host').onclick = () => this.openLobby('host');
    $('#btn-join').onclick = () => this.showJoin();
    $('#btn-help').onclick = () => { $('#helpbox .body').innerHTML = WP.HELP_HTML; $('#helpbox').classList.remove('hidden'); };
    $('#btn-credits').onclick = () => { $('#creditsbox').classList.remove('hidden'); WP.Audio.init(); setTimeout(() => WP.Audio.play('beg', 0.6), 300); };
    $$('.modal .close').forEach(b => b.onclick = () => b.closest('.modal').classList.add('hidden'));
    $('#joingo').onclick = () => this.joinLobby($('#joincode').value);
    $('#joincode').addEventListener('keydown', e => { if (e.key === 'Enter') this.joinLobby($('#joincode').value); });
    $('#lobby-back').onclick = () => this.quit();
    $('#lobby-launch').onclick = () => this.launch();
    $('#copylink').onclick = () => { const l = this.net.inviteLink(); navigator.clipboard?.writeText(l).then(() => WP.UI.toast('Uitnodigingslink gekopieerd!'), () => prompt('Kopieer deze link:', l)); };
    $('#end-menu').onclick = () => this.quit();
  },
  // Titelkaart: net als in het origineel klinkt bij het opstarten busterx.wav ("Playing Dramatic Wav File")
  splash(skip) {
    const sp = $('#splash');
    const go = () => {
      if (sp.dataset.done) return; sp.dataset.done = 1;
      WP.Audio.init();
      WP.Audio.playWhenReady('busterx', 0.9);
      sp.classList.add('boom');
      setTimeout(() => { this.showScreen('#screen-menu'); sp.classList.add('out'); }, 1700);
      setTimeout(() => sp.remove(), 2600);
    };
    sp.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go, { once: true });
    if (skip) { sp.dataset.done = 1; sp.remove(); this.showScreen('#screen-menu'); }
  },
  // Menu: gechirp bij het over de knoppen bewegen (chirp7/chirp8 uit het originele hoofdmenu),
  // inschrijving: chirp2 bij keuzes, click bij klikken
  menuSounds() {
    let last = null, alt = 0;
    document.addEventListener('pointerover', e => {
      const b = e.target.closest('button'); if (!b || b === last) return;
      last = b;
      if (b.closest('#screen-menu') || b.closest('.modal') || b.closest('#screen-end')) WP.Audio.play(alt++ % 2 ? 'chirp8' : 'chirp7', 0.45);
      else if (b.closest('#screen-lobby')) WP.Audio.play('chirp2', 0.3);
    });
    document.addEventListener('pointerout', e => { if (last && !last.contains(e.relatedTarget)) last = null; });
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.closest('#screen-menu') || b.closest('#screen-lobby') || b.closest('.modal') || b.closest('#screen-end')) WP.Audio.play('click', 0.5);
    });
  },
  showJoin() { $('#joinbox').classList.remove('hidden'); setTimeout(() => $('#joincode').focus(), 50); },
  showScreen(id) { $$('.screen').forEach(s => s.classList.add('hidden')); if (id) $(id).classList.remove('hidden'); },

  // ---------- lobby / inschrijving ----------
  async openLobby(role) {
    WP.Audio.init();
    this.role = role; this.myId = 'host';
    this.lobby = { settings: this.settings, slots: [Object.assign({ id: 'host', human: true }, this.enlist)] };
    const nb = Math.min(7, this.settings.bots);
    for (let i = 0; i < nb; i++) this.addBot(true);
    this.showScreen('#screen-lobby'); this.renderLobby();
    if (role === 'host') {
      $('#invite').classList.remove('hidden'); $('#invite .code').textContent = '…'; $('#invite .status').textContent = 'Verbinden met de PeerJS-server…';
      this.net = new WP.Net();
      try {
        const code = await this.net.hostGame();
        $('#invite .code').textContent = code; $('#invite .status').textContent = 'Deel de code of de link met je vrienden. Spelers verschijnen links zodra ze verbinden.';
      } catch (e) { $('#invite .status').textContent = 'Online hosten mislukt: ' + (e.message || e.type) + '. Je kunt wel solo spelen.'; }
      this.net.on('join', id => { this.hostJoin(id); });
      this.net.on('leave', id => this.hostLeave(id));
      this.net.on('msg', (id, m) => this.hostMsg(id, m));
    } else $('#invite').classList.add('hidden');
  },

  async joinLobby(code) {
    code = (code || '').trim().toUpperCase(); if (code.length < 4) return;
    WP.Audio.init();
    $('#joinbox .status').textContent = 'Verbinden met spel ' + code + '…';
    this.net = new WP.Net();
    try {
      const id = await this.net.joinGame(code);
      this.role = 'client'; this.myId = id;
      $('#joinbox').classList.add('hidden'); $('#joinbox .status').textContent = '';
      this.net.on('msg', (from, m) => this.clientMsg(m));
      this.net.on('lost', () => { if (this.mode !== 'menu') { alert('De verbinding met de host is verbroken.'); this.quit(); } });
      this.net.toHost({ t: 'hello', enlist: this.enlist });
      this.lobby = null;
      this.showScreen('#screen-lobby'); $('#invite').classList.remove('hidden'); $('#invite .code').textContent = code;
      $('#invite .status').textContent = 'Verbonden! Schrijf je in en wacht tot de host het spel lanceert.';
      this.renderLobby();
    } catch (e) { $('#joinbox .status').textContent = e.message || String(e); this.net.close(); this.net = null; }
  },

  addBot(silent) {
    const L = this.lobby; if (L.slots.length >= 8) return;
    const used = new Set(L.slots.map(s => s.empire)), names = new Set(L.slots.map(s => s.name));
    const g = L.slots.filter(s => s.path === 'green').length, r = L.slots.length - g;
    let emp = 0; while (used.has(emp) && emp < 14) emp++;
    const name = WP.BOT_NAMES.find(n => !names.has(n)) || 'Bot';
    L.slots.push({ id: 'bot' + Math.random().toString(36).slice(2, 7), name, human: false, path: g <= r ? 'green' : 'red', empire: emp, design: Math.floor(Math.random() * 6) });
    if (!silent) this.lobbyChanged();
  },
  lobbyChanged() {
    this.settings.bots = this.lobby.slots.filter(s => !s.human).length;
    store.set('settings', this.settings);
    if (this.role === 'host' && this.net) this.net.broadcast({ t: 'lobby', lobby: this.lobby });
    this.renderLobby();
  },
  hostJoin(id) {
    const L = this.lobby;
    if (this.mode === 'game') { this.net.send(id, { t: 'full', msg: 'Het spel is al begonnen.' }); return; }
    if (L.slots.length >= 8) { const bot = L.slots.findIndex(s => !s.human); if (bot >= 0) L.slots.splice(bot, 1); else { this.net.send(id, { t: 'full', msg: 'Het spel zit vol (8 kapiteins).' }); return; } }
    const g = L.slots.filter(s => s.path === 'green').length, r = L.slots.length - g;
    L.slots.push({ id, human: true, name: 'Kapitein ' + (L.slots.length + 1), path: g <= r ? 'green' : 'red', empire: (L.slots.length * 3) % 15, design: L.slots.length % 6 });
    WP.Audio.play('radio', 0.5);
    this.lobbyChanged();
  },
  hostLeave(id) {
    if (this.mode === 'game' && this.sim) {
      const p = this.sim.player(id);
      if (p && p.human) { p.human = false; p.ai = { level: 2, state: 'idle', t: 0 }; this.sim.radio(null, `${p.name} heeft de verbinding verloren — een bot neemt het over.`, '#ffb347'); }
      return;
    }
    if (!this.lobby) return;
    this.lobby.slots = this.lobby.slots.filter(s => s.id !== id); this.lobbyChanged();
  },
  hostMsg(id, m) {
    if (m.t === 'hello' || m.t === 'enlist') {
      const s = this.lobby && this.lobby.slots.find(s => s.id === id); if (!s || this.mode === 'game') return;
      const e = m.enlist || m;
      s.name = String(e.name || s.name).slice(0, 20); s.path = e.path === 'red' ? 'red' : 'green'; s.empire = Math.max(0, Math.min(14, e.empire | 0)); s.design = Math.max(0, Math.min(5, e.design | 0));
      this.lobbyChanged();
    } else if (m.t === 'cmd' && this.sim) this.sim.command(id, m.cmd);
  },
  clientMsg(m) {
    if (m.t === 'lobby') { this.lobby = m.lobby; this.settings = m.lobby.settings; this.renderLobby(); }
    else if (m.t === 'full') { alert(m.msg); this.quit(); }
    else if (m.t === 'start') { this.startClient(m); }
    else if (m.t === 'snap') this.applySnap(m);
  },

  renderLobby() {
    const L = this.lobby, isHost = this.role !== 'client';
    $('#lobby-title').textContent = this.role === 'solo' ? 'Solo-missie' : this.role === 'host' ? 'Online spel hosten' : 'Online spel';
    // inschrijvingsformulier
    const E = this.enlist;
    if (!this._formBuilt) {
      this._formBuilt = true;
      $('#en-name').addEventListener('input', e => { E.name = e.target.value.slice(0, 20) || 'Kapitein'; this.enlistChanged(); });
      $('#en-empires').innerHTML = WP.EMPIRES.map((em, i) => `<button data-emp="${i}" title="${em.name}"><img src="assets/portraits/alien${em.portrait}.png"><span>${em.name}</span></button>`).join('');
      $('#en-empires').onclick = e => { const b = e.target.closest('[data-emp]'); if (b) { E.empire = +b.dataset.emp; this.enlistChanged(); } };
      $('#en-paths').onclick = e => { const b = e.target.closest('[data-path]'); if (b) { E.path = b.dataset.path; this.enlistChanged(); } };
      $('#en-ships').innerHTML = WP.SHIP_DESIGNS.map(s => `<button data-ship="${s.id}">${s.name}</button>`).join('');
      $('#en-ships').onclick = e => { const b = e.target.closest('[data-ship]'); if (b) { E.design = +b.dataset.ship; this.enlistChanged(); } };
      this.initPreview();
    }
    $('#en-name').value = E.name;
    $$('#en-empires button').forEach(b => b.classList.toggle('on', +b.dataset.emp === E.empire));
    $$('#en-paths button').forEach(b => b.classList.toggle('on', b.dataset.path === E.path));
    $$('#en-ships button').forEach(b => b.classList.toggle('on', +b.dataset.ship === E.design));
    this.updatePreview();
    // kapiteins
    if (!L) { $('#lobby-slots').innerHTML = '<p class="muted">Wachten op gegevens van de host…</p>'; return; }
    $('#lobby-slots').innerHTML = L.slots.map((s, i) => `<div class="lslot" style="--pc:${WP.PATHS[s.path].css}">
        <img src="assets/portraits/alien${WP.EMPIRES[s.empire].portrait}.png"><div class="li"><b>${s.human ? '👤' : '🤖'} ${esc(s.name)}${s.id === this.myId ? ' <small>(jij)</small>' : ''}</b>
        <small>${WP.EMPIRES[s.empire].name} · ${WP.SHIP_DESIGNS[s.design].name}</small></div>
        <button class="pth" ${isHost && !s.human ? `data-botpath="${s.id}"` : 'disabled'} title="${isHost && !s.human ? 'Klik om het Pad van deze bot te wisselen' : ''}">${WP.PATHS[s.path].short}</button>
        ${isHost && !s.human ? `<button class="rm" data-rmbot="${s.id}" title="Bot verwijderen">✕</button>` : ''}</div>`).join('') +
      (isHost && L.slots.length < 8 ? `<button class="addbot" id="addbot">+ Bot toevoegen</button>` : '') +
      `<p class="muted small">${L.slots.length}/8 kapiteins · elke kapitein krijgt een eigen octant.</p>`;
    if (isHost) {
      $('#lobby-slots').onclick = e => {
        const bp = e.target.closest('[data-botpath]'), rm = e.target.closest('[data-rmbot]');
        if (e.target.id === 'addbot') this.addBot();
        else if (bp) { const s = L.slots.find(s => s.id === bp.dataset.botpath); s.path = s.path === 'green' ? 'red' : 'green'; this.lobbyChanged(); }
        else if (rm) { L.slots = L.slots.filter(s => s.id !== rm.dataset.rmbot); this.lobbyChanged(); }
      };
    }
    // missie-instellingen
    const S = L.settings, dis = isHost ? '' : 'disabled';
    const sel = (k, opts) => `<select data-set="${k}" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${String(S[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const chk = (k, l, tip) => `<label class="chk" title="${tip || ''}"><input type="checkbox" data-set="${k}" ${S[k] ? 'checked' : ''} ${dis}> ${l}</label>`;
    $('#lobby-settings').innerHTML = `
      <div class="set"><span>Melkweg</span>${sel('map', Object.entries(WP.MAPS).map(([k, m]) => [k, m.name]))}<small>${WP.MAPS[S.map].desc}</small></div>
      <div class="set"><span>Spelsnelheid</span>${sel('gameSpeed', [[1, 'Klassiek (zoals het origineel)'], [2, 'Snel'], [3, 'Turbo']])}<small>Hoe snel bevolking groeit, belasting binnenkomt en winkels aanvullen.</small></div>
      <div class="set"><span>Bot-intelligentie</span>${sel('aiLevel', WP.AI_LEVELS.map((l, i) => [i, l]))}</div>
      <div class="set"><span>Startkapitaal</span>${sel('cash', [[50000, '50.000'], [100000, '100.000'], [250000, '250.000'], [1000000, '1 miljoen'], [10000000, '10 miljoen (schieten!)']])}</div>
      <div class="set"><span>Start Tek-niveau</span>${sel('tek', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(t => [t, WP.TEK_ROMAN[t]]))}</div>
      <div class="set"><span>Tijdslimiet</span>${sel('timeLimit', [[15, '15 minuten'], [30, '30 minuten'], [45, '45 minuten'], [60, '60 minuten'], [90, '90 minuten'], [0, 'Onbeperkt']])}</div>
      <div class="checks">
        ${chk('barrierDamage', 'Barrières doen pijn', 'Rood = schade, geel = ongevaarlijk')}
        ${chk('quickROI', 'Snel rendement op investeringen')}
        ${chk('deadLosesItems', 'Vernietigd schip verliest alles')}
        ${chk('enemyPOV', 'Meekijken bij vijanden')}
        ${chk('noWorm', 'Geen wormgaten')}${chk('noPlague', 'Geen plaagbommen')}${chk('noPlagueCure', 'Geen plaagmedicijn')}
        ${chk('noWarp', 'Geen warp drive')}${chk('noBarrier', 'Geen barrier shields')}${chk('noBuster', 'Geen buster bombs')}${chk('noPause', 'Pauzeren verboden')}
      </div>`;
    if (isHost) $('#lobby-settings').onchange = e => {
      const el = e.target.closest('[data-set]'); if (!el) return;
      const k = el.dataset.set; S[k] = el.type === 'checkbox' ? el.checked : (isNaN(+el.value) ? el.value : +el.value);
      this.lobbyChanged();
    };
    const g = L.slots.filter(s => s.path === 'green').length, r = L.slots.length - g;
    $('#lobby-launch').classList.toggle('hidden', !isHost);
    $('#lobby-wait').classList.toggle('hidden', isHost);
    $('#lobby-warn').textContent = (!g || !r) ? 'Let op: er moet minstens één kapitein op elk Pad zijn, anders is het spel snel voorbij.' : '';
  },
  enlistChanged() {
    store.set('enlist', this.enlist);
    if (this.role === 'client') { this.net.toHost({ t: 'enlist', ...this.enlist }); this.renderLobby(); return; }
    const me = this.lobby.slots.find(s => s.id === 'host'); Object.assign(me, this.enlist); this.lobbyChanged();
  },
  initPreview() {
    const cv = $('#en-preview');
    this.pv = { r: new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }), scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, cv.width / cv.height, 1, 1000) };
    this.pv.r.outputEncoding = THREE.sRGBEncoding; this.pv.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.pv.scene.add(new THREE.HemisphereLight(0x99aaff, 0x221122, 0.8)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(1, 2, 1.5); this.pv.scene.add(d);
    this.pv.cam.position.set(0, 70, 150); this.pv.cam.lookAt(0, 0, 0);
  },
  updatePreview() {
    if (!this.pv) return;
    const key = this.enlist.design + this.enlist.path;
    if (this.pv.key === key) return; this.pv.key = key;
    if (this.pv.ship) this.pv.scene.remove(this.pv.ship);
    this.pv.ship = WP.buildShip(this.enlist.design, WP.PATHS[this.enlist.path].color, 1.4); this.pv.scene.add(this.pv.ship);
  },

  // ---------- spel starten ----------
  launch() {
    const L = this.lobby, n = L.slots.length;
    const enlisted = L.slots.map((s, i) => ({ ...s, octant: Math.floor(i * 8 / n), aiLevel: L.settings.aiLevel }));
    this.sim = new WP.Sim(L.settings, enlisted);
    this.myId = 'host';
    if (this.role === 'host' && this.net) this.net.broadcast({ t: 'start' });
    this.beginGame(this.sim);
    this.sendT = 0; this.fullT = 0; this.netEvents = [];
  },
  startClient() {
    this.mode = 'waiting';
    this.cv = null;
    this.showScreen(null); $('#loading').classList.remove('hidden');
  },
  beginGame(src) {
    this.mode = 'game';
    this.demo = null; this.pov = null; this.knownSet.clear(); this.texUrls.clear();
    $('#loading').classList.add('hidden');
    this.renderer.clearWorld(); this.renderer.setupGalaxy(src, src.settings);
    const V = this.renderer.view; V.mode = 'tactical'; V.blend = 1; V.zoom = 2300; V.mapZoom = 27000; V.mapPitch = 0.85;
    this.showScreen(null); $('#hud').classList.remove('hidden');
    $('#radiolog').innerHTML = '';
    WP.UI.close(); WP.UI._lastOrbit = undefined;
    WP.Audio.startAmbient();
    WP.Audio.play('guide', 0.6);
  },

  quit() {
    if (this.net) this.net.close(); this.net = null;
    this.sim = null; this.cv = null; this.mode = 'menu'; this.role = null; this.lobby = null; this.me = null;
    $('#hud').classList.add('hidden'); $('#loading').classList.add('hidden'); WP.UI.close();
    this.showScreen('#screen-menu');
    for (const l of this.labels) l.style.display = 'none';
    this.startDemo();
    if (location.search) history.replaceState(null, '', location.pathname);
  },

  // ---------- client: snapshots ----------
  applySnap(m) {
    const s = m.s;
    if (!this.cv) {
      if (!s.planets) return; // wacht op volledige snapshot
      this.cv = { planets: s.planets, settings: s.settings, history: s.history, gates: [], projs: [], drones: [] };
    }
    const v = this.cv;
    if (s.planets) { v.planets = s.planets; v.history = s.history; v.settings = s.settings; v.colBonus = s.colBonus; }
    const now = performance.now();
    v.t = s.t; v.over = s.over; v.winner = s.winner; v.reason = s.reason; v.paused = s.paused; v.score = s.score; v.counts = s.counts; v.pops = s.pops; v.taxLast = s.taxLast;
    // posities glad houden
    const old = new Map((v.players || []).map(p => [p.id, p]));
    v.players = s.players.map(p => { const o = old.get(p.id); if (!p.visited && o) p.visited = o.visited; return p; });
    v.projs = s.projs.map(a => ({ id: a[0], type: a[1], x: a[2], z: a[3], vx: a[4], vz: a[5], armed: a[6], path: a[7] }));
    v.drones = s.drones.map(a => ({ id: a[0], kind: a[1], x: a[2], z: a[3], path: a[4] }));
    v.gates = s.gates.map(a => ({ id: a[0], ax: a[1], az: a[2], bx: a[3], bz: a[4], name: a[5] }));
    v.snapT = now;
    if (this.mode === 'waiting') this.beginGame(v);
    if (m.ev) this.handleEvents(m.ev);
  },

  cmd(c) {
    if (!this.myId) return;
    if (this.role === 'client') this.net.toHost({ t: 'cmd', cmd: c });
    else if (this.sim) this.sim.command(this.myId, c);
  },

  // ---------- zichtbaarheid ----------
  known(id) { return this.knownSet.has(id) || !this.me || !this.me.alive; },
  shipVisible(p) {
    const me = this.me;
    if (!me || p.id === me.id || p.path === me.path) return true;
    if (p.stealth) return false;
    if ((p.x - me.x) ** 2 + (p.z - me.z) ** 2 < 2700 * 2700 && me.alive) return true;
    for (const pl of this.radarPlanets) if ((p.x - pl.x) ** 2 + (p.z - pl.z) ** 2 < 2500 * 2500) return true;
    return !me.alive;
  },
  setPOV(id) {
    const v = this.view, me = this.me; if (!v || !me) return;
    const p = v.players.find(q => q.id === id); if (!p) return;
    if (p.id === me.id) { this.pov = null; WP.UI.toast('Terug naar je eigen schip'); return; }
    if (p.path !== me.path && !v.settings.enemyPOV && this.role !== 'solo') { WP.UI.toast('Meekijken kan alleen bij kapiteins van je eigen Pad.'); return; }
    this.pov = id; WP.UI.toast('Je kijkt mee met ' + p.name + ' (klik je eigen gezicht om terug te gaan)');
  },
  planetTexUrl(pl) {
    if (this.texUrls.has(pl.id)) return this.texUrls.get(pl.id);
    const o = this.renderer.planetObjs.get(pl.id);
    if (!o || !o.mesh.material.map) return '';
    const u = o.mesh.material.map.image.toDataURL(); this.texUrls.set(pl.id, u); return u;
  },
  toggleMap() { const V = this.renderer.view; V.mode = V.mode === 'map' ? 'tactical' : 'map'; WP.Audio.play('click', 0.4); },

  // ---------- events ----------
  handleEvents(evs) {
    const me = this.me, V = this.renderer.view;
    for (const e of evs) {
      if (e.to != null && me) {
        if (typeof e.to === 'string' && e.to.startsWith('path:')) { if (e.to.slice(5) !== me.path) continue; }
        else if (e.to !== me.id) continue;
      }
      switch (e.k) {
        case 'snd': {
          if (e.s.startsWith('chirp') && Math.random() < 0.5) break;
          let vol = 0.8, pan = 0;
          if (e.x !== undefined && !(e.x === 0 && e.z === 0 && e.to === null) && e.to == null) {
            const d = Math.hypot(e.x - V.cx * (1 - V.blend), e.z - V.cz * (1 - V.blend));
            const range = 3200 + V.zoom + V.blend * 20000;
            vol = Math.max(0, 1 - d / range) * 0.9; if (vol < 0.03) break;
            pan = Math.max(-1, Math.min(1, (this.renderer.project(e.x, 0, e.z).x / this.renderer.w - 0.5) * 1.6));
          }
          WP.Audio.play(e.s, vol, pan);
          break;
        }
        case 'radio': WP.UI.radio(e.text, e.color, e.from); if (e.from && (!me || e.from !== me.name)) WP.Audio.play('chirp' + (1 + Math.floor(Math.random() * 8)), 0.25); break;
        case 'boom': this.renderer.boom(e.x, e.z, e.s, e.d, e.t); break;
        case 'beam': this.renderer.beam(e.x1, e.z1, e.x2, e.z2, e.c, e.thin); break;
        case 'warp': this.renderer.warpFx(e.x, e.z, e.small); break;
        case 'pulse': this.renderer.pulse(e.x, e.z, e.r, e.c); break;
        case 'shake': if (Math.hypot(e.x - V.cx, e.z - V.cz) < 7000) this.renderer.shake(e.a); break;
        case 'hit': this.renderer.flashShield(e.id); if (me && e.id === me.id && e.d > 150) { const f = $('#hitflash'); f.style.opacity = Math.min(0.6, e.d / 3000); clearTimeout(this._hf); this._hf = setTimeout(() => f.style.opacity = 0, 120); } break;
        case 'barrier': this.renderer.pulse(e.x, e.z, 400, 0xffd84a); break;
        case 'distress': {
          const v = this.view, pl = v && v.planets.find(p => p.id === e.id);
          if (pl && me && WP.calc.aura(pl) === me.path) { WP.Audio.play('distress', 0.7); WP.UI.toast('❗ Noodsignaal van ' + pl.name); }
          break;
        }
        case 'over': this.showEnd(e); break;
      }
    }
  },

  showEnd(e) {
    const v = this.view; const me = this.me;
    const won = me && me.path === e.w;
    WP.Audio.play(won ? 'guide' : 'deadship', 0.8);
    $('#end-title').innerHTML = `<span style="color:${WP.PATHS[e.w].css}">Het ${WP.PATHS[e.w].name} wint!</span>`;
    $('#end-sub').textContent = e.reason + (me ? (won ? ' Gefeliciteerd, kapitein!' : ' Volgende keer beter.') : '');
    const sc = v.score;
    $('#end-body').innerHTML = `<div class="endscore"><div style="color:#3dff7a">Vrede<b>${Math.round(sc.green)}</b><small>${v.counts.green} planeten</small></div><div style="color:#ff4b4b">Oorlog<b>${Math.round(sc.red)}</b><small>${v.counts.red} planeten</small></div></div>
      <table class="caps"><tr><th></th><th>Kapitein</th><th>Pad</th><th>Kills</th><th>Doden</th><th>Krediet</th></tr>${v.players.map(p => `<tr><td><img class="portrait sm" src="assets/portraits/alien${WP.EMPIRES[p.empire].portrait}.png"></td><td>${p.human ? '👤' : '🤖'} ${esc(p.name)}</td><td style="color:${WP.PATHS[p.path].css}">${WP.PATHS[p.path].short}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${WP.fmt(p.credits)}</td></tr>`).join('')}</table>`;
    setTimeout(() => $('#screen-end').classList.remove('hidden'), 1500);
  },

  // ---------- frame ----------
  tick(dt) {
    let view = null;
    // draaiend scheepsvoorbeeld in de inschrijving
    if (this.pv && this.pv.ship && !$('#screen-lobby').classList.contains('hidden')) {
      this.pv.ship.rotation.y += dt * 0.8; this.pv.ship.rotation.x = Math.sin(performance.now() / 1500) * 0.15;
      this.pv.r.render(this.pv.scene, this.pv.cam);
    }
    if (this.mode === 'menu' && this.demo) {
      this.demo.step(dt); this.demo.events.length = 0;
      view = this.hostView(this.demo);
      this.renderer.frame(view, null, dt, { known: () => true, shipVisible: () => true, menu: true });
      return;
    }
    if (this.mode === 'lobby' || (this.mode !== 'game')) { if (this.mode !== 'waiting') this.renderer.frame(this.hostView(this.demo || { players: [], planets: [], projs: [], drones: [], gates: [] }), null, dt, { known: () => true, shipVisible: () => true, menu: true }); return; }
    if (this.role !== 'client') {
      const s = this.sim;
      this.simAcc = (this.simAcc || 0) + dt;
      let n = 0;
      while (this.simAcc >= 1 / 30 && n < 6) { s.step(1 / 30); this.simAcc -= 1 / 30; n++; }
      if (n === 6) this.simAcc = 0;
      const evs = s.events.splice(0);
      view = this.hostView(s);
      this.view = view; this.me = view.players.find(p => p.id === this.myId);
      this.handleEvents(evs);
      if (this.role === 'host' && this.net) {
        this.netEvents.push(...evs);
        this.sendT += dt; this.fullT += dt;
        if (this.sendT >= 0.1) {
          const full = this.fullT >= 1; if (full) this.fullT = 0;
          this.sendT = 0;
          this.net.broadcast({ t: 'snap', s: s.snapshot(full), ev: this.netEvents });
          this.netEvents = [];
        }
      }
    } else {
      view = this.cv; if (!view) return;
      const age = (performance.now() - view.snapT) / 1000;
      for (const p of view.players) { const mv = !p.orbit && p.alive && !(p.respawn > 0); p.ex = mv ? p.x + p.hx * p.speed * WP.calc.SPEED_UNIT * Math.min(age, 0.3) : p.x; p.ez = mv ? p.z + p.hz * p.speed * WP.calc.SPEED_UNIT * Math.min(age, 0.3) : p.z; }
      for (const m of view.projs) { m.ex = m.x + m.vx * Math.min(age, 0.3); m.ez = m.z + m.vz * Math.min(age, 0.3); }
      for (const d of view.drones) { d.ex = d.x; d.ez = d.z; }
      this.view = view; this.me = view.players.find(p => p.id === this.myId);
    }
    const me = this.me;
    if (me && me.visited) for (const id of me.visited) this.knownSet.add(id);
    // radarplaneten
    this.radarPlanets = me ? view.planets.filter(pl => WP.calc.aura(pl) === me.path || (pl.spies && pl.spies[me.path])) : [];
    this.updateHover();
    // vuur ingedrukt
    if (this.mouse.fireHeld) { this.mouse.fireT -= dt; if (this.mouse.fireT <= 0) { this.fireAtMouse(); this.mouse.fireT = 0.32; } }
    const povP = this.pov ? view.players.find(p => p.id === this.pov) : null;
    if (povP && !povP.alive) this.pov = null;
    const sel = me && WP.ITEM[me.slots[me.sel]];
    const range = sel && sel.beam && !me.orbit ? 700 + 1500 * me.charge / WP.calc.chargeMax(me) : 0;
    let hover = null;
    if (this.hoverPlanet != null) { const pl = view.planets.find(p => p.id === this.hoverPlanet); if (pl) hover = { x: pl.x, z: pl.z, r: pl.r * 1.75, col: 0xffffff }; }
    else if (this.hoverShip) { const p = view.players.find(q => q.id === this.hoverShip); if (p) hover = { x: p.ex ?? p.x, z: p.ez ?? p.z, r: 70, col: WP.PATHS[p.path].color }; }
    this.renderer.frame(view, me, dt, { known: id => this.known(id), shipVisible: p => this.shipVisible(p), client: this.role === 'client', hover, range, camId: this.pov || (me && me.alive ? me.id : null), follow: povP || (me && !me.alive ? { x: 0, z: 0 } : null) });
    WP.UI.update(view, me, dt);
    this.updateLabels(view, me);
  },
  hostView(s) {
    for (const p of s.players) { p.ex = p.x; p.ez = p.z; }
    for (const m of s.projs) { m.ex = m.x; m.ez = m.z; }
    for (const d of s.drones) { d.ex = d.x; d.ez = d.z; }
    return {
      t: s.t, over: s.over, paused: s.paused, settings: s.settings, players: s.players, planets: s.planets, projs: s.projs, drones: s.drones, gates: s.gates,
      score: s.score, counts: s.counts, taxLast: s.taxLast, history: s.history,
    };
  },

  // ---------- labels ----------
  updateLabels(v, me) {
    const R = this.renderer, V = R.view, box = $('#labels');
    let n = 0;
    const get = () => { let l = this.labels[n]; if (!l) { l = document.createElement('div'); l.className = 'lbl'; box.appendChild(l); this.labels.push(l); } n++; l.style.display = ''; return l; };
    const put = (l, x, y, html, cls) => { if (l._h !== html) { l._h = html; l.innerHTML = html; } l.className = 'lbl ' + (cls || ''); l.style.transform = `translate(${x | 0}px,${y | 0}px)`; };
    const map = V.blend > 0.5;
    const AC = { white: '#d8e4ff', yellow: '#ffd84a', green: '#3dff7a', red: '#ff3b3b', unknown: '#8a93a8' };
    const range = map ? 1e9 : (V.zoom * 1.8) ** 2;
    for (const pl of v.planets) {
      if (!map && (pl.x - V.cx) ** 2 + (pl.z - V.cz) ** 2 > range) continue;
      if (map && !pl.homeOf && pl.id !== this.hoverPlanet && !pl.distress) continue;
      const k = this.known(pl.id), a = k ? WP.calc.aura(pl) : 'unknown';
      const sc = 1 + V.blend * 1.8;
      const p = R.project(pl.x, 0, pl.z + pl.r * 1.5 * sc); if (!p.vis || p.x < -100 || p.x > R.w + 100 || p.y < -50 || p.y > R.h + 50) continue;
      const dist = !map && me && k && pl.pop > 0 ? '' : '';
      put(get(), p.x, p.y, `<span style="color:${AC[a]}">${pl.distress && k ? '❗' : ''}${esc(pl.name)}</span>${!map && k && pl.pop > 0 ? `<small>${WP.EMPIRES[pl.empire].name} · ${WP.fmt(pl.pop)}</small>` : ''}`, 'pl');
    }
    for (const p of v.players) {
      if (!p.alive || p.respawn > 0 || !this.shipVisible(p)) continue;
      const o = R.shipObjs.get(p.id); if (!o) continue;
      const sp = R.project(o.rx, 0, o.rz - 90 * (1 + V.blend * 4)); if (!sp.vis) continue;
      const own = me && p.path === me.path;
      const en = own ? `<i class="eb"><b style="width:${Math.max(0, Math.min(100, p.energy / WP.calc.energyMax(p) * 100))}%"></b></i>` : '';
      put(get(), sp.x, sp.y, `<span style="color:${WP.PATHS[p.path].css}">${esc(p.name)}</span>${en}`, 'sh' + (me && p.id === me.id ? ' me' : ''));
    }
    for (const g of v.gates) for (const [x, z] of [[g.ax, g.az], [g.bx, g.bz]]) {
      if (!map && (x - V.cx) ** 2 + (z - V.cz) ** 2 > range) continue;
      const p = R.project(x, 0, z + 110); if (!p.vis) continue;
      put(get(), p.x, p.y, `<span style="color:#c9a0ff">${esc(g.name)}</span>`, 'pl');
    }
    for (let i = n; i < this.labels.length; i++) this.labels[i].style.display = 'none';
  },

  // ---------- invoer ----------
  updateHover() {
    const v = this.view, R = this.renderer, V = R.view;
    this.hoverPlanet = null; this.hoverShip = null;
    if (!v || this.mouse.overUI) return;
    const g = R.ground(this.mouse.x, this.mouse.y); this.mouse.g = g; if (!g) return;
    const sc = 1 + V.blend * 1.8;
    let best = null, bd = 1e18;
    for (const pl of v.planets) { const d = (pl.x - g.x) ** 2 + (pl.z - g.z) ** 2, rr = (pl.r * sc + 50 * sc) ** 2; if (d < rr && d < bd) { bd = d; best = pl; } }
    if (best) { this.hoverPlanet = best.id; return; }
    const ss = 1 + V.blend * 4;
    for (const p of v.players) { if (!p.alive || p.respawn > 0 || !this.shipVisible(p) || (this.me && p.id === this.me.id)) continue; const d = (p.ex - g.x) ** 2 + (p.ez - g.z) ** 2; if (d < (70 * ss) ** 2 && d < bd) { bd = d; this.hoverShip = p.id; } }
  },
  fireAtMouse() {
    const g = this.mouse.g, me = this.me; if (!g || !me) return;
    const v = this.view;
    let x = g.x, z = g.z, tid = null;
    if (this.hoverShip) { const p = v.players.find(q => q.id === this.hoverShip); tid = p.id; if (WP.ITEM[me.slots[me.sel]]?.homing) { x = p.x; z = p.z; } }
    this.cmd({ c: 'fire', x, z, tid });
  },
  clickAt() {
    const g = this.mouse.g, me = this.me; if (!g || !me) return;
    const v = this.view, armed = me.warpArmed || me.wormArmed;
    if (!armed) {
      if (this.hoverPlanet != null) return this.cmd({ c: 'orbitPlanet', id: this.hoverPlanet });
      for (const gt of v.gates) for (const [x, z] of [[gt.ax, gt.az], [gt.bx, gt.bz]]) if ((x - g.x) ** 2 + (z - g.z) ** 2 < 110 * 110 * (1 + this.renderer.view.blend * 3) ** 2) return this.cmd({ c: 'gate', id: gt.id });
    }
    this.cmd({ c: 'course', x: g.x, z: g.z, map: armed || this.renderer.view.mode === 'map' });
  },
  bindInput() {
    const cv = $('#c'), M = this.mouse;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('pointermove', e => {
      M.x = e.clientX; M.y = e.clientY; M.overUI = e.target !== cv;
      if (M.drag && (M.drag.btn === 0 || M.drag.btn === 1)) {
        const dx = e.clientX - M.drag.x, dy = e.clientY - M.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) M.drag.moved = true;
        if (M.drag.moved) {
          const V = this.renderer.view;
          if (V.mode === 'map') { V.mapYaw -= (e.clientX - M.drag.lx) * 0.005; V.mapPitch = Math.max(0.25, Math.min(1.5, V.mapPitch + (e.clientY - M.drag.ly) * 0.004)); }
          else { V.yaw -= (e.clientX - M.drag.lx) * 0.005; V.pitch = Math.max(0.45, Math.min(1.45, V.pitch + (e.clientY - M.drag.ly) * 0.004)); }
          M.drag.lx = e.clientX; M.drag.ly = e.clientY;
        }
      }
    });
    cv.addEventListener('pointerdown', e => {
      if (this.mode !== 'game') return;
      if (e.button === 2) { this.fireAtMouse(); M.fireHeld = true; M.fireT = 0.4; return; }
      M.drag = { btn: e.button, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
      cv.setPointerCapture(e.pointerId);
    });
    window.addEventListener('pointerup', e => {
      if (e.button === 2) M.fireHeld = false;
      if (M.drag && e.button === M.drag.btn) { if (!M.drag.moved && M.drag.btn === 0 && this.mode === 'game') this.clickAt(); M.drag = null; }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const V = this.renderer.view, f = Math.pow(1.12, Math.sign(e.deltaY));
      if (this.mode !== 'game') return;
      if (V.mode === 'map') { V.mapZoom = Math.min(48000, V.mapZoom * f); if (V.mapZoom < 9000) { V.mapZoom = 27000; V.mode = 'tactical'; } }
      else { V.zoom = Math.max(600, V.zoom * f); if (V.zoom > 9500) { V.zoom = 6000; V.mode = 'map'; } }
    }, { passive: false });
    const ri = $('#radioin');
    ri.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const t = ri.value.trim(); if (t) this.cmd({ c: 'chat', text: t }); ri.value = ''; ri.blur(); }
      if (e.key === 'Escape') { ri.value = ''; ri.blur(); }
    });
    window.addEventListener('keydown', e => {
      if (this.mode !== 'game' || e.target.tagName === 'INPUT') return;
      const me = this.me, V = this.renderer.view, k = e.key.toLowerCase(), code = e.code;
      if (code.startsWith('Numpad') && /\d/.test(code.slice(-1))) {
        const nn = +code.slice(-1); e.preventDefault();
        if (nn === 5) return this.cmd({ c: 'stop' });
        const dirs = { 8: [0, 1], 2: [0, -1], 4: [-1, 0], 6: [1, 0], 7: [-1, 1], 9: [1, 1], 1: [-1, -1], 3: [1, -1] }[nn]; if (!dirs || !me) return;
        const y = V.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
        const dx = rx * dirs[0] + fx * dirs[1], dz = rz * dirs[0] + fz * dirs[1];
        return this.cmd({ c: 'course', x: me.x + dx * 4000, z: me.z + dz * 4000 });
      }
      if (e.key >= '1' && e.key <= '7') return this.cmd({ c: 'sel', slot: +e.key - 1 });
      switch (k) {
        case 'w': case 'arrowup': this.cmd({ c: 'speed', d: 1 }); break;
        case 's': case 'arrowdown': this.cmd({ c: 'speed', d: -1 }); break;
        case 'x': this.cmd({ c: 'stop' }); break;
        case 'r': this.cmd({ c: 'reverse' }); break;
        case 'h': this.cmd({ c: 'shields' }); break;
        case ' ': e.preventDefault(); this.fireAtMouse(); break;
        case 'm': this.toggleMap(); break;
        case 'q': case 'arrowleft': V.yaw += 0.15; break;
        case 'e': case 'arrowright': V.yaw -= 0.15; break;
        case 'n': this.cmd({ c: 'mine' }); break;
        case 'l': this.cmd({ c: 'colonize' }); break;
        case 'c': WP.UI.scanPlanet = null; WP.UI.open('scan'); break;
        case 'b': WP.UI.open('bank'); break;
        case 't': WP.UI.open('shop'); break;
        case 'k': WP.UI.open('dock'); break;
        case 'g': WP.UI.open('guide'); break;
        case 'j': WP.UI.open('chart'); break;
        case 'y': WP.UI.open('tek'); break;
        case 'tab': e.preventDefault(); WP.UI.open('captains'); break;
        case 'f1': e.preventDefault(); WP.UI.open('help'); break;
        case 'p': case 'pause': this.cmd({ c: 'pause' }); break;
        case 'enter': e.preventDefault(); ri.focus(); break;
        case 'escape': if (WP.UI.win) WP.UI.close(); else WP.UI.open('menu'); break;
      }
    });
  },
};
WP.App = App;
window.addEventListener('load', () => App.init());
})();
