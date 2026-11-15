// Warpath 2026 — HUD en vensters
'use strict';
(function () {
const $ = s => document.querySelector(s);
const C = WP.calc;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (n, cls = '') => `<img class="ic ${cls}" src="assets/icons/${n}.png" alt="">`;
const portrait = (emp, cls = '') => `<img class="portrait ${cls}" src="assets/portraits/alien${WP.EMPIRES[emp] ? WP.EMPIRES[emp].portrait : 0}.png" alt="">`;
const AURA_NL = { white: 'Onbewoond', yellow: 'Ongebonden', green: 'Pad van Vrede', red: 'Pad van Oorlog', unknown: 'Onbekend' };
const AURA_CSS = { white: '#d8e4ff', yellow: '#ffd84a', green: '#3dff7a', red: '#ff3b3b', unknown: '#6a7388' };
const pct = v => Math.round(v * 100) + '%';
const bar = (v, col, extra = '') => `<div class="bar ${extra}"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%;background:${col}"></i></div>`;
const fmtT = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function setHTML(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }

const UI = {
  win: null, winArg: null, scanPlanet: null, investAmt: 50000, shopSel: null, dockSel: null, guideSort: 'name', guideDir: 1, mapTab: 'map',
  init(app) {
    this.app = app;
    // vensters: acties via pointerdown (robuust tegen her-renders)
    const act = e => {
      const el = e.target.closest('[data-act]'); if (!el || el.classList.contains('dis')) return;
      e.preventDefault(); e.stopPropagation();
      this.action(el.dataset.act, el.dataset);
    };
    for (const id of ['#win', '#actionbar', '#shipbox', '#sidebtns', '#mapbox', '#scanbox', '#overlay']) $(id).addEventListener('pointerdown', act);
    $('#win .x').addEventListener('pointerdown', e => { e.stopPropagation(); this.close(); });
    // venster verslepen
    const wt = $('#win .wtitle'); let drag = null;
    wt.addEventListener('pointerdown', e => { if (e.target.closest('.x')) return; const r = $('#win').getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; wt.setPointerCapture(e.pointerId); });
    wt.addEventListener('pointermove', e => { if (!drag) return; const w = $('#win'); w.style.left = (e.clientX - drag.dx) + 'px'; w.style.top = (e.clientY - drag.dy) + 'px'; w.style.transform = 'none'; });
    wt.addEventListener('pointerup', () => drag = null);
    $('#minimap').addEventListener('pointerdown', e => this.minimapClick(e));
    $('#minimap').addEventListener('contextmenu', e => e.preventDefault());
  },

  sendCmd(c) { this.app.cmd(c); },

  action(a, d) {
    const app = this.app, me = app.me;
    WP.Audio.play('click', 0.4);
    switch (a) {
      case 'win': this.open(d.w, d.arg); break;
      case 'close': this.close(); break;
      case 'cmd': this.sendCmd(JSON.parse(d.c)); break;
      case 'slot': this.sendCmd({ c: 'sel', slot: +d.i }); break;
      case 'mine': this.sendCmd({ c: 'mine' }); break;
      case 'sell': this.sendCmd({ c: 'sell', all: d.all === '1' }); break;
      case 'colonize': this.sendCmd({ c: 'colonize' }); break;
      case 'amt': this.investAmt = +d.v; this.refresh(true); break;
      case 'invest': this.sendCmd({ c: 'invest', cat: d.cat, amt: this.investAmt === -1 ? Math.max(0, me.credits) : this.investAmt }); break;
      case 'borrow': this.sendCmd({ c: 'borrow' }); break;
      case 'repay': this.sendCmd({ c: 'repay' }); break;
      case 'shopsel': this.shopSel = d.id; this.refresh(true); break;
      case 'buy': this.sendCmd({ c: 'buy', item: d.id, n: +d.n }); break;
      case 'autoshop': this.sendCmd({ c: 'autoshop' }); break;
      case 'docksel': this.dockSel = d.id; WP.Audio.play('conveyor', 0.3); this.refresh(true); break;
      case 'equip': if (this.dockSel) { this.sendCmd({ c: 'equip', slot: +d.i, item: this.dockSel }); this.dockSel = null; WP.Audio.play('dockspin', 0.4); } else if (me.slots[+d.i]) this.sendCmd({ c: 'unequip', slot: +d.i }); break;
      case 'course': this.sendCmd({ c: 'orbitPlanet', id: +d.id }); break;
      case 'warpto': this.sendCmd({ c: 'warpTo', id: +d.id }); break;
      case 'scan': this.scanPlanet = +d.id; this.open('scan'); break;
      case 'sort': if (this.guideSort === d.k) this.guideDir *= -1; else { this.guideSort = d.k; this.guideDir = d.k === 'name' ? 1 : -1; } this.refresh(true); break;
      case 'pov': app.setPOV(d.id); break;
      case 'maptab': this.mapTab = d.t; break;
      case 'speed': this.sendCmd({ c: 'speed', d: +d.d }); break;
      case 'stop': this.sendCmd({ c: 'stop' }); break;
      case 'reverse': this.sendCmd({ c: 'reverse' }); break;
      case 'shields': this.sendCmd({ c: 'shields' }); break;
      case 'map': app.toggleMap(); break;
      case 'mute': { const m = WP.Audio.toggleMute(); this.toast(m ? 'Geluid uit' : 'Geluid aan'); this.refresh(true); break; }
      case 'quit': app.quit(); break;
      case 'resume': this.close(); break;
      case 'pause': this.sendCmd({ c: 'pause' }); break;
    }
  },

  open(w, arg, side) {
    if (this.win === w && arg == null && !side) { this.close(); return; }
    this.win = w; this.winArg = arg;
    const el = $('#win');
    el.classList.remove('hidden'); el.dataset.w = w;
    // planeetvensters staan opzij, zodat het schip in het midden klikbaar blijft
    el.classList.toggle('side', ['scan', 'bank', 'shop', 'dock'].includes(w));
    el.style.left = el.style.top = el.style.transform = '';
    if (w === 'shop' || w === 'dock' || w === 'bank') WP.Audio.play(w === 'dock' ? 'craneup' : 'service', 0.35);
    this.refresh(true);
  },
  close() { this.win = null; $('#win').classList.add('hidden'); },
  toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('show'), 2200); },

  radio(text, color, from) {
    const log = $('#radiolog');
    const d = document.createElement('div');
    d.innerHTML = (from ? `<b style="color:${color}">${esc(from)}:</b> ${esc(text)}` : `<span style="color:${color}">${esc(text)}</span>`);
    log.appendChild(d);
    while (log.children.length > 80) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  },

  // ---------- per frame / 10 Hz ----------
  refresh(force) { this._force = true; },
  update(view, me, dt) {
    this._acc = (this._acc || 0) + dt;
    if (this._acc < 0.1 && !this._force) return;
    this._acc = 0; this._force = false;
    this.view = view; this.me = me;
    if (!me) return;
    // Automatisch scannen: komt het schip in een baan, dan opent de planetaire scan.
    // Bij vertrek sluiten alle open vensters vanzelf (behalve het pauzemenu).
    const orbit = me.alive && !(me.respawn > 0) ? me.orbit : null;
    if (this._lastOrbit === undefined) this._lastOrbit = orbit;   // niet bij de start van het spel
    else if (orbit !== this._lastOrbit) {
      const planetWin = ['scan', 'bank', 'shop', 'dock'].includes(this.win);
      if (orbit != null && (!this.win || planetWin)) { this.scanPlanet = null; this.win = null; this.open('scan', null, true); WP.Audio.play('guide', 0.25); }
      else if (orbit == null && this.win && this.win !== 'menu') this.close();   // wegvliegen: alle vensters dicht, zodat je je schip weer ziet
      this._lastOrbit = orbit;
    }
    this.topbar(view, me); this.shipbox(view, me); this.actionbar(view, me); this.scanbox(view, me); this.minimap(view, me); this.overlay(view, me);
    if (this.win) this.renderWin(view, me);
  },

  topbar(v, me) {
    const S = v.settings, lim = S.timeLimit ? S.timeLimit * 60 : 0;
    const left = lim ? lim - v.t : v.t;
    const cnt = v.counts || {}, sc = v.score || { green: 0, red: 0 };
    setHTML($('#topbar'), `
      <div class="clock ${lim && left < 300 ? 'warn' : ''}" title="Speeltijd${lim ? ' (resterend)' : ''}">⏱ ${fmtT(left)}${lim ? '' : ''}</div>
      <div class="pcount g" title="Planeten op het Pad van Vrede · score">${icon('green')} ${cnt.green || 0} <small>${Math.round(sc.green)}</small></div>
      <div class="pcount r" title="Planeten op het Pad van Oorlog · score">${icon('red')} ${cnt.red || 0} <small>${Math.round(sc.red)}</small></div>
      <div class="pcount y" title="Ongebonden planeten">● ${cnt.yellow || 0}</div>
      <div class="pcount w" title="Onbewoonde planeten">○ ${cnt.white || 0}</div>
      <div class="tek" title="Jouw Tek-niveau">TEK ${WP.TEK_ROMAN[me.tek]}</div>
      ${v.paused ? '<div class="paused">GEPAUZEERD</div>' : ''}`);
  },

  shipbox(v, me) {
    const em = C.energyMax(me), cm = C.chargeMax(me), cg = C.cargoMax(me), fs = C.freeSpeed(me);
    const en = me.energy / em, path = WP.PATHS[me.path];
    const sh = me.items.shield || 0, shUp = me.shieldsOn && sh > 0 && !me.stealth && !me.mining;
    let pods = ''; for (let i = 0; i < (me.items.cargopod || 0); i++) { const f = Math.max(0, Math.min(1, (me.cargo - i * 1000) / 1000)); pods += `<span class="pod"><i style="height:${f * 100}%"></i></span>`; }
    let shl = ''; for (let i = 0; i < 5; i++) shl += `<span class="sl ${i < sh ? (shUp ? 'on' : 'off') : ''}"></span>`;
    let spd = ''; for (let i = 1; i <= 10; i++) spd += `<span class="sp ${i <= me.speed ? (i > fs ? 'hot' : 'on') : ''} ${i === fs ? 'free' : ''}"></span>`;
    const chips = [];
    if (me.mining) chips.push('<span class="chip mine">MIJNSTRAAL</span>');
    if (me.stealth) chips.push('<span class="chip">STEALTH</span>'); else if (me.stealthT > 0) chips.push('<span class="chip warn">STEALTH WISSEL</span>');
    if (me.scream) chips.push('<span class="chip warn">SONIC SCREAM</span>');
    if (me.warpArmed) chips.push('<span class="chip blue">WARP GEREED – klik op kaart</span>');
    if (me.wormArmed) chips.push('<span class="chip blue">WORMGATE – klik op kaart</span>');
    if (me.sd > 0) chips.push(`<span class="chip red">ZELFVERNIETIGING ${me.sd.toFixed(1)}s</span>`);
    if (me.plague) chips.push('<span class="chip plague">PLAAG AAN BOORD</span>');
    if (me.autoshop) chips.push('<span class="chip">AUTO-SHOP</span>');
    setHTML($('#shipbox'), `
      <div class="cap" style="--pc:${path.css}">${portrait(me.empire)}<div><div class="nm">${esc(me.name)}</div><div class="sub">${WP.EMPIRES[me.empire].name} · <span style="color:${path.css}">${path.name}</span></div></div></div>
      <div class="money"><div title="Krediet">${icon('bank')} <b>${WP.fmt(me.credits)}</b> cr</div>${me.loan ? `<div class="loan" title="Lening">Lening ${WP.fmt(me.loan)}</div>` : ''}
        <div title="Kolonisten aan boord">${icon('colonize')} ${WP.fmt(me.colonists)}</div><div title="Reserveschepen">${icon('hull')} ${me.items.hull || 0}</div></div>
      <div class="meter" title="Energie: je levensader. Op = schip vernietigd. Bijtanken bij planeten van je eigen Pad."><label>Energie <small>${me.items.energypod} pods</small></label>${bar(en, en < 0.25 ? '#ff4040' : en < 0.5 ? '#ffb347' : 'linear-gradient(90deg,#2bd96b,#7dffb0)')}<span>${WP.fmt(me.energy)}</span></div>
      <div class="meter" title="Lading: voor lasers, lanceren, warp en stealth. Laadt vanzelf op."><label>Lading <small>${me.items.chargepod} pods</small></label>${bar(me.charge / cm, 'linear-gradient(90deg,#2a7dff,#7fd8ff)')}<span>${WP.fmt(me.charge)}</span></div>
      <div class="meter" title="Vracht: gemijnd erts (1000 ton per cargo pod)"><label>Vracht</label><div class="pods">${pods}</div><span>${WP.fmt(me.cargo)} / ${WP.fmt(cg)} t</span></div>
      <div class="meter" title="Schildlagen: elke laag halveert de schade. Hitte te hoog = buitenste laag knapt. [H] aan/uit"><label>Schilden</label><div class="shields">${shl}</div>
        <div class="heat">${bar(me.shieldHeat / 1600, '#ff7a3d')}</div><button class="tg ${shUp ? 'on' : ''}" data-act="shields">${me.shieldsOn ? 'AAN' : 'UIT'}</button></div>
      <div class="meter speed" title="Snelheid 0–10. Boven het witte streepje kost vliegen energie. [W]/[S] [X]=stop [R]=keer"><label>Snelheid</label><div class="spd">${spd}</div>
        <div class="sbtn"><button data-act="speed" data-d="-1">−</button><button data-act="speed" data-d="1">+</button><button data-act="stop" title="Stop [X]">■</button><button data-act="reverse" title="Keer om [R]">↺</button></div></div>
      <div class="chips">${chips.join('')}</div>`);
  },

  actionbar(v, me) {
    const pl = me.orbit ? v.planets.find(p => p.id === me.orbit) : null;
    let svc = '';
    if (pl) {
      const a = C.aura(pl), friendly = pl.pop > 0 && (a === 'yellow' || a === me.path);
      const b = (act, ic, label, ok, tip, extra = '') => `<button class="svc ${ok ? '' : 'dis'} ${extra}" data-act="${act}" title="${tip}">${icon(ic)}<span>${label}</span></button>`;
      svc += pl.pop <= 0
        ? b('mine', 'mining', me.mining ? 'Stop mijnen' : 'Mijnen', pl.ore > 0, 'Mijnstraal: erts uit deze onbewoonde planeet halen. Schilden staan dan uit! [N]', me.mining ? 'active' : '')
        : b('sell', 'bag', 'Verkoop erts', friendly && me.cargo > 0, `Verkoop al je erts (${C.orePrice(pl)} cr/ton) [N]`, '" data-all="1');
      svc += b('win', 'scan', 'Scan', true, 'Planetaire scan: gegevens, bod op je erts, koloniseren [C]', '" data-w="scan');
      svc += b('win', 'invest', 'Bank', friendly, 'Investeren in de planeet en lenen bij de First Galactic Bank [B]', '" data-w="bank');
      svc += b('win', 'shop', 'Winkel', friendly, 'Honest Xzyll\'s Trading Post [T]', '" data-w="shop');
      svc += b('win', 'dock', 'Dok', friendly, 'Ruimtedok: kies welke 7 wapens/apparaten geïnstalleerd zijn [K]', '" data-w="dock');
      svc += b('colonize', 'colonize', 'Koloniseer', me.colonists >= 200 && (pl.pop <= 0 || pl.empire === me.empire), `Zet je ${WP.fmt(me.colonists)} kolonisten af (min. 200) [L]`);
    }
    let slots = '';
    for (let i = 0; i < 7; i++) {
      const id = me.slots[i], it = WP.ITEM[id];
      if (!it) { slots += `<div class="slot empty" title="Leeg slot – installeer items in het Ruimtedok"><kbd>${i + 1}</kbd></div>`; continue; }
      const cnt = it.beam ? '∞' : (me.items[id] || 0);
      const active = (id === 'stealth' && (me.stealth || me.stealthT > 0)) || (id === 'scream' && me.scream) || (id === 'warp' && me.warpArmed) || (id === 'wormgate' && me.wormArmed) || (id === 'selfdestruct' && me.sd > 0);
      slots += `<div class="slot ${me.sel === i && it.kind === 'weapon' ? 'sel' : ''} ${active ? 'active' : ''} ${it.kind === 'device' ? 'dev' : ''} ${!it.beam && !cnt ? 'empty-ammo' : ''}" data-act="slot" data-i="${i}" title="${esc(it.name)} – ${esc(it.desc)}">
        ${icon(it.id)}<kbd>${i + 1}</kbd><b>${cnt}</b></div>`;
    }
    const sel = WP.ITEM[me.slots[me.sel]];
    const hint = me.alive ? (pl ? `In een baan rond <b>${esc(pl.name)}</b> · klik ergens om te vertrekken` : `Linksklik: vliegen/planeet · Rechtsklik: vuur ${sel ? esc(sel.name) : ''} · [M] sterrenkaart`) : 'Toeschouwer';
    setHTML($('#actionbar'), `<div class="hint">${hint}</div>${svc ? `<div class="services">${svc}</div>` : ''}<div class="slots">${slots}</div>`);
  },

  planetCard(pl, me, compact) {
    const known = this.app.known(pl.id);
    const a = known ? C.aura(pl) : 'unknown';
    const love = Math.max(-1, Math.min(1, pl.love / 1000));
    const emp = pl.empire >= 0 ? WP.EMPIRES[pl.empire].name : '—';
    return `<div class="pcard">
      <div class="phead"><span class="dot" style="background:${AURA_CSS[a]}"></span><b>${pl.distress && known ? '❗ ' : ''}${esc(pl.name)}</b><span class="aura" style="color:${AURA_CSS[a]}">${AURA_NL[a]}</span></div>
      ${known ? `<div class="pgrid">
        <span>Rijk</span><b>${emp}</b><span>Bevolking</span><b>${WP.fmt(pl.pop)}</b>
        <span>Erts</span><b>${WP.fmt(pl.ore)} t</b><span>Ontwikkeling</span><b>${pct(C.devAvg(pl))}</b>
        ${pl.pop > 0 ? `<span>Ertsprijs</span><b>${C.orePrice(pl)} cr/t</b>` : ''}${pl.plague > 0 ? `<span>Plaag</span><b class="plague">${pct(Math.min(1, pl.plague))}</b>` : ''}
      </div>
      ${pl.pop > 0 ? `<div class="love" title="Houding: links = Pad van Oorlog, rechts = Pad van Vrede"><span class="r"></span><span class="g"></span><i style="left:${50 + love * 50}%"></i></div>` : ''}` : '<div class="muted">Nog niet bezocht. Ga in een baan om de status te leren kennen.</div>'}
    </div>`;
  },

  scanbox(v, me) {
    const id = this.app.hoverPlanet != null ? this.app.hoverPlanet : me.orbit;
    const pl = id != null ? v.planets.find(p => p.id === id) : null;
    const el = $('#scanbox');
    if (!pl) { setHTML(el, ''); el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    setHTML(el, this.planetCard(pl, me, true));
  },

  overlay(v, me) {
    let h = '';
    if (!me.alive) h = `<div class="ov"><h2>Geen schepen meer</h2><p>Je bent nu toeschouwer tot het einde van het spel.</p></div>`;
    else if (me.respawn > 0) h = `<div class="ov"><h2>Schip vernietigd!</h2><p>Reserveschip wordt klaargemaakt… ${Math.ceil(me.respawn)}</p></div>`;
    setHTML($('#overlay'), h);
  },

  // ---------- minimap ----------
  minimap(v, me) {
    const cv = $('#minimap'), g = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, s = (W / 2 - 8) / (WP.GALAXY_R * 1.08);
    g.clearRect(0, 0, W, H);
    // octanten
    for (let o = 0; o < 8; o++) {
      const owner = v.players.find(p => p.octant === o);
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, WP.GALAXY_R * s, o * Math.PI / 4, (o + 1) * Math.PI / 4); g.closePath();
      g.fillStyle = owner ? (owner.path === 'green' ? 'rgba(61,255,122,0.06)' : 'rgba(255,59,59,0.06)') : 'rgba(80,90,120,0.04)'; g.fill();
    }
    g.strokeStyle = v.settings.barrierDamage ? 'rgba(255,70,70,0.55)' : 'rgba(255,216,74,0.55)'; g.lineWidth = 1;
    for (let o = 0; o < 8; o++) { const a = o * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * WP.GALAXY_R * s, cy + Math.sin(a) * WP.GALAXY_R * s); g.stroke(); }
    g.strokeStyle = 'rgba(120,150,220,0.3)'; g.beginPath(); g.arc(cx, cy, WP.GALAXY_R * s, 0, 7); g.stroke();
    if (this.mapTab === 'pol') {
      for (const p of v.players) {
        const a = (p.octant + 0.5) * Math.PI / 4, r = WP.GALAXY_R * 0.62 * s;
        g.fillStyle = WP.PATHS[p.path].css; g.font = '11px Rajdhani, sans-serif'; g.textAlign = 'center';
        g.fillText((p.alive ? '' : '☠ ') + p.name, cx + Math.cos(a) * r, cy + Math.sin(a) * r + 30);
      }
      this.polFaces(v);
    } else this.polFaces(null);
    const t = performance.now() / 1000;
    for (const pl of v.planets) {
      const known = this.app.known(pl.id);
      const a = known ? C.aura(pl) : 'unknown';
      const x = cx + pl.x * s, y = cy + pl.z * s;
      let r = pl.distress && known && a === me.path ? 3.5 + Math.sin(t * 6) * 1.5 : 2.2;
      g.fillStyle = AURA_CSS[a]; g.globalAlpha = known ? 1 : 0.45;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (pl.homeOf) { g.strokeStyle = AURA_CSS[a]; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.stroke(); }
      if (pl.id === this.app.hoverPlanet) { g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke(); }
    }
    g.globalAlpha = 1;
    for (const gt of v.gates) { g.fillStyle = '#b48cff'; for (const [x, z] of [[gt.ax, gt.az], [gt.bx, gt.bz]]) { g.beginPath(); g.arc(cx + x * s, cy + z * s, 3, 0, 7); g.fill(); } }
    for (const p of v.players) {
      if (!p.alive || p.respawn > 0 || !this.app.shipVisible(p)) continue;
      const x = cx + p.x * s, y = cy + p.z * s;
      g.strokeStyle = p.id === me.id ? '#fff' : WP.PATHS[p.path].css; g.lineWidth = p.id === me.id ? 2 : 1.5;
      g.strokeRect(x - 4, y - 4, 8, 8);
    }
    // camera-gebied
    const V = this.app.renderer.view;
    g.strokeStyle = 'rgba(255,216,74,0.6)'; g.lineWidth = 1;
    const vr = V.zoom * 0.9 * s; g.strokeRect(cx + V.cx * s - vr, cy + V.cz * s - vr * 0.6, vr * 2, vr * 1.2);
  },
  polFaces(v) {
    const box = $('#polfaces');
    if (!v) { setHTML(box, ''); return; }
    const W = 260, s = (W / 2 - 8) / (WP.GALAXY_R * 1.08);
    setHTML(box, v.players.map(p => {
      const a = (p.octant + 0.5) * Math.PI / 4, r = WP.GALAXY_R * 0.62 * s;
      return `<img data-act="pov" data-id="${p.id}" class="pf ${p.alive ? '' : 'dead'}" style="left:${W / 2 + Math.cos(a) * r - 16}px;top:${W / 2 + Math.sin(a) * r - 16}px;border-color:${WP.PATHS[p.path].css}" src="assets/portraits/alien${WP.EMPIRES[p.empire].portrait}.png" title="${esc(p.name)} – klik om mee te kijken">`;
    }).join(''));
  },
  minimapClick(e) {
    if (this.mapTab === 'pol' && e.target.closest('.pf')) return;
    const cv = $('#minimap'), r = cv.getBoundingClientRect();
    const s = (cv.width / 2 - 8) / (WP.GALAXY_R * 1.08);
    const x = ((e.clientX - r.left) * cv.width / r.width - cv.width / 2) / s, z = ((e.clientY - r.top) * cv.height / r.height - cv.height / 2) / s;
    e.preventDefault();
    if (e.button === 2) { this.app.renderer.view.cx = x; this.app.renderer.view.cz = z; return; }
    // planeet aangeklikt?
    let best = null, bd = 260 * 260;
    for (const pl of this.view.planets) { const d = (pl.x - x) ** 2 + (pl.z - z) ** 2; if (d < bd) { bd = d; best = pl; } }
    const me = this.me;
    if (best && !me.warpArmed && !me.wormArmed) this.sendCmd({ c: 'orbitPlanet', id: best.id });
    else this.sendCmd({ c: 'course', x, z, map: true });
  },

  // ---------- vensters ----------
  renderWin(v, me) {
    const w = this.win, body = $('#win .wbody'), title = $('#win .wtitle span');
    let t = '', h = '';
    const pl = me.orbit ? v.planets.find(p => p.id === me.orbit) : null;
    switch (w) {
      case 'scan': { const p = v.planets.find(q => q.id === (this.scanPlanet != null && !me.orbit ? this.scanPlanet : me.orbit)) || (this.scanPlanet != null ? v.planets.find(q => q.id === this.scanPlanet) : null); t = 'Planetaire scan'; h = p ? this.scanWin(p, me) : '<p class="muted">Ga in een baan om een planeet om te scannen.</p>'; break; }
      case 'bank': t = 'First Galactic Bank & McDOW Investment'; h = this.bankWin(pl, me); break;
      case 'shop': t = 'Honest Xzyll\'s Trading Post™'; h = this.shopWin(pl, me); break;
      case 'dock': t = 'Amalgamated Space Docks, Inc.'; h = this.dockWin(pl, me); break;
      case 'guide': t = 'Planetaire Gids'; h = this.guideWin(v, me); break;
      case 'captains': t = 'Kapiteinslijst'; h = this.captainsWin(v, me); break;
      case 'chart': t = 'Bevolkingsgrafiek'; h = this.chartWin(v, me); break;
      case 'tek': t = 'Tek-rapport'; h = this.tekWin(v, me); break;
      case 'help': t = 'Handleiding'; h = WP.HELP_HTML; break;
      case 'menu': t = 'Menu'; h = `<div class="menuwin"><button data-act="resume">Verder spelen</button>${v.settings.noPause ? '' : '<button data-act="pause">Pauze aan/uit [P]</button>'}<button data-act="mute">${WP.Audio.muted ? 'Geluid aan' : 'Geluid uit'}</button><button data-act="win" data-w="help">Handleiding</button><button class="danger" data-act="quit">Spel verlaten</button></div>`; break;
    }
    title.textContent = t;
    const scrolls = [...body.querySelectorAll('.slist, .beltrow')].map(e => e.scrollTop), bs = body.scrollTop;
    setHTML(body, h);
    [...body.querySelectorAll('.slist, .beltrow')].forEach((e, i) => { if (scrolls[i]) e.scrollTop = scrolls[i]; });
    body.scrollTop = bs;
    if (w === 'chart') this.drawChart(v);
  },

  scanWin(pl, me) {
    const known = this.app.known(pl.id), a = known ? C.aura(pl) : 'unknown', inOrbit = me.orbit === pl.id;
    const texUrl = this.app.planetTexUrl(pl);
    const friendly = pl.pop > 0 && (a === 'yellow' || a === me.path);
    let offer = '';
    if (inOrbit && pl.pop > 0) {
      if (!friendly) offer = '<p class="bad">Deze planeet volgt het andere Pad en weigert met je te handelen.</p>';
      else if (me.cargo < 1) offer = `<p>Bod: <b>${C.orePrice(pl)} cr/ton</b>. Je hebt geen erts aan boord.</p>`;
      else { const price = C.orePrice(pl), tons = Math.min(me.cargo, Math.floor(pl.cash / price)); offer = `<p>Bod: <b>${price} cr/ton</b> — ze kunnen <b>${WP.fmt(tons)} t</b> betalen (${WP.fmt(tons * price)} cr).</p><div class="row"><button data-act="sell" data-all="0">Verkoop 1 pod</button><button class="pri" data-act="sell" data-all="1">Verkoop alles</button></div>`; }
    }
    const canCol = inOrbit && me.colonists >= 200 && (pl.pop <= 0 || pl.empire === me.empire);
    const d = pl.dev;
    return `<div class="scan">
      <div class="globe" style="background-image:url(${texUrl});box-shadow:0 0 40px ${AURA_CSS[a]}66, inset -30px -18px 50px #000c, inset 8px 6px 20px #fff3"></div>
      <div class="sinfo">${this.planetCard(pl, me)}
        ${known && pl.pop > 0 ? `<div class="devs">${WP.INVEST.map(c => `<div title="${c.desc}">${icon(c.icon)}<span>${c.name}</span>${bar(d[c.id], '#7fd8ff')}</div>`).join('')}</div>
        <div class="pgrid"><span>Ontwikkelingsniveau</span><b>${WP.fmt(C.devLevel(pl))}</b><span>Planetaire schilden</span><b>${Math.floor(pl.shields)}</b><span>Kolonisten beschikbaar</span><b>${WP.fmt(pl.colonists)}</b><span>Kas</span><b>${WP.fmt(pl.cash)} cr</b></div>` : ''}
      </div></div>
      ${offer}
      ${inOrbit && pl.pop <= 0 ? `<div class="row"><button class="${pl.ore > 0 && me.cargo < C.cargoMax(me) ? 'pri' : 'dis'}" data-act="mine">${icon('mining')} ${me.mining ? 'Stop mijnen' : 'Start mijnen'} (${WP.fmt(me.cargo)} / ${WP.fmt(C.cargoMax(me))} t)</button></div>` : ''}
      ${inOrbit ? `<div class="row"><button class="${canCol ? 'pri' : 'dis'}" data-act="colonize">${icon('colonize')} Koloniseer (${WP.fmt(me.colonists)} aan boord)</button></div>
        <p class="muted small">Koloniseren kan op onbewoonde planeten (claimt de planeet voor jouw Pad) of op planeten van je eigen rijk. Minimaal 200 kolonisten; die haal je automatisch op bij ontwikkelde planeten van je eigen Pad of rijk.</p>` : ''}`;
  },

  bankWin(pl, me) {
    const acct = `<div class="acct"><div>Saldo <b>${WP.fmt(me.credits)} cr</b></div><div>Lening <b>${WP.fmt(me.loan)}</b></div><div>Geïnvesteerd <b>${WP.fmt(me.invested)}</b></div><div>Leenlimiet <b>${WP.fmt(C.loanLimit(me))}</b></div>
      <button data-act="borrow" class="${me.loan + 100000 <= C.loanLimit(me) ? '' : 'dis'}">Leen 100.000</button><button data-act="repay" class="${me.loan > 0 && me.credits >= 100000 ? '' : 'dis'}">Los 100.000 af</button></div>
      <p class="muted small">Renteloos! Maar zolang je een lening hebt mag je niet investeren. Lenen kan tot 50% van je totale investeringen.</p>`;
    if (!pl || pl.pop <= 0) return acct + '<p class="muted">Ga in een baan om een bewoonde, vriendelijke planeet om te investeren.</p>';
    const a = C.aura(pl);
    if (a !== 'yellow' && a !== me.path) return acct + '<p class="bad">Deze planeet volgt het andere Pad: geen zaken.</p>';
    const c100 = C.cost100(pl);
    const amts = [[10000, '10k'], [50000, '50k'], [100000, '100k'], [250000, '250k'], [1000000, '1 mln'], [-1, 'Alles']];
    const amt = this.investAmt === -1 ? me.credits : this.investAmt;
    const sign = WP.PATHS[me.path].sign, loveGain = Math.round(amt / c100 * 1000);
    const love = Math.max(-1, Math.min(1, pl.love / 1000));
    return acct + `<h3>Investeren in ${esc(pl.name)} <small>(${WP.EMPIRES[pl.empire].name})</small></h3>
      <div class="love big"><span class="r"></span><span class="g"></span><i style="left:${50 + love * 50}%"></i><em style="left:${50 + Math.max(-1, Math.min(1, (pl.love + sign * loveGain) / 1000)) * 50}%"></em></div>
      <p class="small">Bedrag: ${amts.map(([v, l]) => `<button class="amt ${this.investAmt === v ? 'on' : ''}" data-act="amt" data-v="${v}">${l}</button>`).join('')} → ≈ <b style="color:${WP.PATHS[me.path].css}">${sign > 0 ? '+' : '−'}${loveGain}</b> liefde (300 = om). 100% van een categorie kost hier ~${WP.fmt(c100)} cr.</p>
      <div class="invest">${WP.INVEST.map(c => {
        const dv = pl.dev[c.id], pend = Math.min(1 - dv, pl.cap[c.id] / c100);
        return `<div class="ivr ${dv >= 1 ? 'full' : ''}">${icon(c.icon)}<div><b>${c.name}</b><small>${c.desc}</small><div class="bar"><i style="width:${dv * 100}%;background:#7fd8ff"></i><i style="width:${pend * 100}%;background:#ffd84a88"></i></div></div><span>${pct(dv)}</span>
          <button class="${dv >= 1 || me.loan > 0 || me.credits < 1000 ? 'dis' : 'pri'}" data-act="invest" data-cat="${c.id}">Investeer</button></div>`;
      }).join('')}</div>`;
  },

  shopWin(pl, me) {
    if (!pl || pl.pop <= 0) return '<p class="muted">Winkels vind je bij bewoonde planeten (geel of van jouw Pad).</p>';
    const a = C.aura(pl);
    if (a !== 'yellow' && a !== me.path) return '<p class="bad">"Wij verkopen niet aan jouw soort." — deze planeet volgt het andere Pad.</p>';
    const S = this.view.settings, dl = C.devLevel(pl), disc = a === me.path ? 0.9 : 1;
    const rows = WP.ITEMS.filter(it => C.itemAllowed(S, it)).map(it => {
      const avail = it.tek <= me.tek && it.dev <= dl;
      const have = me.items[it.id] || 0, stock = Math.floor(pl.stock[it.id] || 0), price = Math.round(it.price * disc);
      const why = it.tek > me.tek ? `Tek ${WP.TEK_ROMAN[it.tek]} nodig` : it.dev > dl ? 'Planeet te weinig ontwikkeld' : '';
      return { it, avail, have, stock, price, why };
    });
    const sel = rows.find(r => r.it.id === this.shopSel) || rows.find(r => r.avail) || rows[0];
    this.shopSel = sel.it.id;
    const list = rows.map(r => `<div class="srow ${r.avail ? '' : 'na'} ${r === sel ? 'on' : ''}" data-act="shopsel" data-id="${r.it.id}">${icon(r.it.id)}<span class="nm">${r.it.name}</span><span class="tk">${WP.TEK_ROMAN[r.it.tek]}</span><span class="pr">${WP.fmt(r.price)}</span><span class="st">${r.avail ? r.stock : '—'}</span><span class="hv">${r.have}/${r.it.maxS}</span></div>`).join('');
    const r = sel, maxN = Math.max(0, Math.min(r.it.maxS - r.have, r.stock, Math.floor(me.credits / r.price)));
    const can = r.avail && maxN > 0;
    return `<div class="shop"><div class="slist"><div class="srow hd"><span></span><span class="nm">Artikel</span><span class="tk">Tek</span><span class="pr">Prijs</span><span class="st">Voorraad</span><span class="hv">Aan boord</span></div>${list}</div>
      <div class="sdet">${icon(r.it.id, 'big')}<h3>${r.it.name}</h3><p>${r.it.desc}</p>
        <div class="pgrid"><span>Prijs</span><b>${WP.fmt(r.price)} cr${disc < 1 ? ' (−10%)' : ''}</b><span>Tek-niveau</span><b>${WP.TEK_ROMAN[r.it.tek]}</b><span>Min. ontwikkeling</span><b>${WP.fmt(r.it.dev)}</b>${r.it.dmg ? `<span>Kracht</span><b>${WP.fmt(r.it.dmg)} kJ</b>` : ''}<span>Max aan boord</span><b>${r.it.maxS}</b></div>
        ${r.avail ? `<div class="row"><button class="${can ? 'pri' : 'dis'}" data-act="buy" data-id="${r.it.id}" data-n="1">Koop 1</button><button class="${maxN >= 10 ? '' : 'dis'}" data-act="buy" data-id="${r.it.id}" data-n="10">Koop 10</button><button class="${can ? '' : 'dis'}" data-act="buy" data-id="${r.it.id}" data-n="${maxN}">Max (${maxN})</button></div>` : `<p class="bad">${r.why}</p>`}
        <div class="row"><button class="${me.autoshop ? 'on' : ''}" data-act="autoshop" title="Koopt bij elke vriendelijke planeet automatisch schilden, energie- en ladingpods en meer van je geselecteerde wapen">${icon('shop')} Auto-shop ${me.autoshop ? 'AAN' : 'UIT'}</button></div>
        <p class="muted small">Ontwikkelingsniveau planeet: ${WP.fmt(dl)} · jouw krediet: ${WP.fmt(me.credits)} cr</p></div></div>`;
  },

  dockWin(pl, me) {
    if (!pl || pl.pop <= 0 || !(C.aura(pl) === 'yellow' || C.aura(pl) === me.path)) return '<p class="muted">Ruimtedokken vind je bij bewoonde, vriendelijke planeten.</p>';
    const owned = Object.keys(me.items).filter(id => WP.ITEM[id] && (WP.ITEM[id].kind === 'weapon' || WP.ITEM[id].kind === 'device') && me.items[id] > 0);
    const slots = me.slots.map((id, i) => `<div class="dslot ${this.dockSel ? 'target' : ''}" data-act="equip" data-i="${i}" title="${id ? 'Klik om te verwijderen' : 'Leeg'}">${id ? icon(id) + `<small>${WP.ITEM[id].name}</small>` : '<small>leeg</small>'}<kbd>${i + 1}</kbd></div>`).join('');
    const belt = owned.map(id => `<div class="belt ${this.dockSel === id ? 'on' : ''} ${me.slots.includes(id) ? 'inst' : ''}" data-act="docksel" data-id="${id}" title="${WP.ITEM[id].desc}">${icon(id)}<small>${WP.ITEM[id].name}</small><b>${WP.ITEM[id].beam ? '∞' : me.items[id]}</b></div>`).join('');
    return `<p class="small">Je schip heeft <b>7 gondels</b>. Alleen geïnstalleerde items kun je gebruiken. ${this.dockSel ? `<b>Klik nu op een gondel</b> om <b>${WP.ITEM[this.dockSel].name}</b> te installeren.` : 'Kies een item van de lopende band en klik daarna op een gondel. Klik op een gevulde gondel om hem leeg te maken.'}</p>
      <h3>Lopende band (in je ruim)</h3><div class="beltrow">${belt || '<span class="muted">Niets in je ruim.</span>'}</div>
      <h3>Gondels</h3><div class="dslots">${slots}</div>
      <p class="muted small">Passieve uitrusting (schilden, pods, gids, Auto-Miner, Barrier Shield) werkt altijd en neemt geen gondel in.</p>`;
  },

  guideWin(v, me) {
    const live = (me.items.guide || 0) > 0;
    let list = v.planets.filter(pl => this.app.known(pl.id) || (pl.distress && C.aura(pl) === me.path));
    const k = this.guideSort, dir = this.guideDir;
    const val = pl => k === 'name' ? pl.name : k === 'empire' ? (pl.empire >= 0 ? WP.EMPIRES[pl.empire].name : '') : k === 'pop' ? pl.pop : k === 'ore' ? pl.ore : k === 'price' ? (pl.pop > 0 ? C.orePrice(pl) : 0) : k === 'dev' ? C.devAvg(pl) : k === 'love' ? pl.love : k === 'dist' ? -Math.hypot(pl.x - me.x, pl.z - me.z) : pl.plague;
    list.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    const th = (key, l) => `<th data-act="sort" data-k="${key}" class="${k === key ? 'on' : ''}">${l}${k === key ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const warp = me.slots.includes('warp');
    return `${live ? '' : '<p class="small warnbox">Zonder <b>Planetary Guide</b> zie je alleen namen en Pad-kleuren. Koop er één in een winkel voor live bevolking, erts, prijzen en liefde.</p>'}
      <table class="guide"><tr>${th('name', 'Planeet')}${th('empire', 'Rijk')}${live ? th('pop', 'Bevolking') + th('ore', 'Erts') + th('price', 'Prijs') + th('dev', 'Ontw.') + th('love', 'Liefde') + th('plague', 'Plaag') : ''}${th('dist', 'Afstand')}<th></th></tr>
      ${list.map(pl => { const a = C.aura(pl); return `<tr><td><span class="dot" style="background:${AURA_CSS[a]}"></span>${pl.distress ? '❗' : ''}${esc(pl.name)}</td><td>${pl.empire >= 0 ? WP.EMPIRES[pl.empire].name : '—'}</td>
        ${live ? `<td>${WP.fmt(pl.pop)}</td><td>${WP.fmt(pl.ore)}</td><td>${pl.pop > 0 ? C.orePrice(pl) : '—'}</td><td>${pct(C.devAvg(pl))}</td><td style="color:${pl.love > 0 ? '#3dff7a' : '#ff6b6b'}">${Math.round(pl.love)}</td><td>${pl.plague > 0 ? pct(Math.min(1, pl.plague)) : ''}</td>` : ''}
        <td>${WP.fmt(Math.hypot(pl.x - me.x, pl.z - me.z))}</td>
        <td class="acts"><button data-act="scan" data-id="${pl.id}">Scan</button><button data-act="course" data-id="${pl.id}">Koers</button>${warp ? `<button data-act="warpto" data-id="${pl.id}">Warp</button>` : ''}</td></tr>`; }).join('')}</table>`;
  },

  captainsWin(v, me) {
    return `<table class="caps"><tr><th></th><th>Kapitein</th><th>Pad</th><th>Rijk</th><th>Tek</th><th>Kills</th><th>Doden</th><th>Reserve</th><th>Status</th></tr>
      ${v.players.map(p => `<tr class="${p.alive ? '' : 'dead'}" data-act="pov" data-id="${p.id}" title="Klik om mee te kijken (alleen eigen Pad tenzij de host het toestaat)"><td>${portrait(p.empire, 'sm')}</td><td>${p.human ? '👤' : '🤖'} <b>${esc(p.name)}</b>${p.id === me.id ? ' (jij)' : ''}</td>
        <td style="color:${WP.PATHS[p.path].css}">${WP.PATHS[p.path].short}</td><td>${WP.EMPIRES[p.empire].name}</td><td>${WP.TEK_ROMAN[p.tek]}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.items.hull || 0}</td><td>${p.alive ? (p.respawn > 0 ? 'herstart' : 'actief') : '☠'}</td></tr>`).join('')}</table>
      <p class="small">Belasting laatste minuut: <span style="color:#3dff7a">Vrede ${WP.fmt(v.taxLast.green)} cr</span> · <span style="color:#ff6b6b">Oorlog ${WP.fmt(v.taxLast.red)} cr</span> (verdeeld over de kapiteins van elk Pad)</p>`;
  },

  chartWin(v) { return `<canvas id="chart" width="640" height="300"></canvas><p class="small">Totale bevolking van planeten per Pad. Score = bevolking × (0,5 + ontwikkeling) + 20 per kolonie.</p>`; },
  drawChart(v) {
    const cv = $('#chart'); if (!cv || !v.history) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, h = v.history;
    g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(10,16,30,0.6)'; g.fillRect(0, 0, W, H);
    const max = Math.max(1, ...h.green, ...h.red) * 1.1, n = h.t.length;
    g.strokeStyle = 'rgba(255,255,255,0.08)'; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, H * i / 5); g.lineTo(W, H * i / 5); g.stroke(); }
    for (const [k, c] of [['green', '#3dff7a'], ['red', '#ff4b4b']]) {
      g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath();
      h[k].forEach((y, i) => { const x = n > 1 ? i / (n - 1) * W : 0, yy = H - y / max * H; i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.stroke();
    }
    g.fillStyle = '#9fb3d9'; g.font = '12px Rajdhani, sans-serif'; g.fillText(WP.fmt(max), 6, 14); g.fillText(fmtT(h.t[n - 1] || 0), W - 40, H - 6);
  },

  tekWin(v, me) {
    const S = v.settings;
    let h = `<p class="small">Je Tek-niveau stijgt naarmate de bevolking en ontwikkeling van jouw Pad groeit. Wapens worden ook sterker per niveau (×2 over tien niveaus). Jij bent nu <b>Tek ${WP.TEK_ROMAN[me.tek]}</b>.</p><table class="tek">`;
    for (let t = 1; t <= 10; t++) {
      const its = WP.ITEMS.filter(i => i.tek === t && C.itemAllowed(S, i)); if (!its.length) continue;
      h += `<tr class="${t <= me.tek ? 'ok' : ''}"><th>${WP.TEK_ROMAN[t]}</th><td>${its.map(i => `<span title="${esc(i.desc)}">${icon(i.id)} ${i.name} <small>${WP.fmt(i.price)} cr · ontw. ${WP.fmt(i.dev)}</small></span>`).join('')}</td></tr>`;
    }
    return h + '</table>';
  },
};
WP.UI = UI;

WP.HELP_HTML = `<div class="help">
<h3>Het doel</h3>
<p>De melkweg is verdeeld in 8 octanten, gescheiden door <b>energiebarrières</b>. Je kiest het <b style="color:#3dff7a">Pad van Vrede</b> of het <b style="color:#ff3b3b">Pad van Oorlog</b>. Overtuig zoveel mogelijk planeten om jouw Pad te volgen — door te <b>investeren</b>, te <b>koloniseren</b>, of door vijandelijke planeten te ontvolken. Wie aan het eind de hoogste score heeft (bevolking × ontwikkeling) of de laatste kapitein heeft, wint.</p>
<h3>Planeten (aura)</h3>
<p><b style="color:#d8e4ff">Wit</b> = onbewoond: hier kun je mijnen en koloniseren. <b style="color:#ffd84a">Geel</b> = ongebonden: handel, winkelen en investeren. <b style="color:#3dff7a">Groen</b>/<b style="color:#ff3b3b">rood</b> = volgt een Pad. Planeten van jouw Pad tanken je bij en beschermen je; planeten van het andere Pad sturen drones op je af. Grijs = nog niet bezocht.</p>
<h3>Geld verdienen</h3>
<ol><li>Vlieg naar een witte planeet, ga in een baan en druk op <b>Mijnen</b> (schilden staan dan uit!).</li><li>Verkoop het erts aan een bewoonde planeet — hoe minder erts ze hebben, hoe meer ze betalen.</li><li>Koop <b>Cargo Pods</b> (meer winst per reis), dan Energy Pods, schilden en wapens.</li><li><b>Investeer</b> in gele planeten tot ze jouw kleur krijgen. Elke minuut krijgt jouw Pad <b>belasting</b> van al zijn planeten.</li></ol>
<p>Tip van Dan Samuel: mijn een planeet leeg en koloniseer hem — dan heb je een nieuwe markt die topprijzen betaalt.</p>
<h3>Noodsignalen</h3><p>Een knipperende planeet op de kaart wordt aangevallen of heeft geen grondstoffen meer. Ga er zo snel mogelijk heen — zolang je wegblijft verliest hij zijn vertrouwen in je.</p>
<h3>Besturing</h3>
<table class="keys">
<tr><td>Linksklik</td><td>Vlieg ernaartoe · klik op planeet = in een baan · klik op wormgate = erdoor</td></tr>
<tr><td>Rechtsklik / Spatie</td><td>Vuur het geselecteerde wapen op dat punt (ingedrukt houden = blijven vuren)</td></tr>
<tr><td>1 – 7</td><td>Selecteer wapen / activeer apparaat</td></tr>
<tr><td>W / S &nbsp; ↑ / ↓</td><td>Sneller / langzamer</td></tr>
<tr><td>X · R</td><td>Stop · keer om</td></tr>
<tr><td>Numpad 1–9</td><td>Vlieg in die richting (zoals in het origineel)</td></tr>
<tr><td>H</td><td>Schilden aan/uit</td></tr>
<tr><td>M · muiswiel</td><td>3D sterrenkaart (slepen = draaien) · zoomen</td></tr>
<tr><td>Q / E</td><td>Camera draaien</td></tr>
<tr><td>N · C · B · T · K · L</td><td>Mijnen/verkopen · Scan · Bank · Winkel · Dok · Koloniseer</td></tr>
<tr><td>G · Tab · J · Y</td><td>Gids · Kapiteins · Grafiek · Tek-rapport</td></tr>
<tr><td>Enter</td><td>Radiobericht (begin met <b>]</b> voor alleen je team)</td></tr>
<tr><td>Esc · P · F1</td><td>Menu · Pauze · Help</td></tr>
</table>
<h3>Wapens en schilden</h3><p>Wapens ontploffen op het punt waar je klikt — richt vóór bewegende schepen. Schade neemt kwadratisch af met de afstand. Elke schildlaag halveert de schade; met 5 lagen kom je (gehavend) door een rode barrière. Een <b>Barrier Shield</b> maakt barrières ongevaarlijk.</p>
<h3>Credits</h3><p><b>Warpath 2026</b> is een liefdevolle remake van <b>Warpath / Warpath 97 / Warpath: 21st Century</b> door <b>Dan Samuel</b> (met Benjamin Samuel), <b>Synthetic Reality</b> — www.synthetic-reality.com. De originele geluiden, portretten en iconen zijn van Synthetic Reality en worden hier met eerbied hergebruikt. Remake: Joris "Endless" Zuijdervliet, 2026.</p>
</div>`;
})();
