// Warpath 2026 — simulatie (draait alleen op de host / in solo)
'use strict';
(function () {
const R = WP.GALAXY_R, TAU = Math.PI * 2;
const SPEED_UNIT = 85;                // eenheden/s per snelheidsstap (sneller dan het origineel)
const PT_SPEED = 950;                  // snelheid planeettorpedo's
const EN_UNIT = 4000, CH_UNIT = 1500, CARGO_UNIT = 1000;
const SHIELD_HEAT_MAX = 1600;
const ORBIT_GAP = 110;

const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

class Sim {
  constructor(settings, enlisted, seed) {
    this.settings = Object.assign(WP.DEFAULT_SETTINGS(), settings);
    this.seed = seed || (Math.random() * 1e9) | 0;
    this.rnd = WP.rng(this.seed);
    this.t = 0; this.nextId = 1; this.events = [];
    this.players = []; this.planets = []; this.projs = []; this.drones = []; this.gates = [];
    this.over = false; this.winner = null; this.reason = '';
    this.taxLast = { green: 0, red: 0 }; this.colBonus = { green: 0, red: 0 };
    this.history = { green: [], red: [], t: [] };
    this.minuteAcc = 0; this.secAcc = 0; this.paused = false;
    this.buildGalaxy(enlisted);
    this.updateScores();
    this.players.forEach(p => this.updateTek(p, true));
    this.radio(null, 'Welkom bij Warpath 2026! Kies je Pad en verover de melkweg. (Gebaseerd op Warpath door Dan Samuel, Synthetic Reality)', '#ffd84a');
  }

  id() { return this.nextId++; }
  ev(e) { this.events.push(e); }
  snd(s, x, z, to) { this.ev({ k: 'snd', s, x, z, to }); }
  radio(to, text, color, from) { this.ev({ k: 'radio', to, text, color: color || '#9fd3ff', from: from || null }); }

  // ---------- melkweg opbouwen ----------
  buildGalaxy(enlisted) {
    const S = this.settings, rnd = this.rnd;
    const octs = [0, 1, 2, 3, 4, 5, 6, 7];
    // spelers krijgen octanten; rest wordt aangevuld met neutrale octanten
    const usedEmp = new Set(enlisted.map(e => e.empire));
    enlisted.forEach((e, i) => {
      const p = this.makePlayer(e, i);
      this.players.push(p);
    });
    // planeten per octant
    const wedge = TAU / 8;
    for (let o = 0; o < 8; o++) {
      const owner = this.players.find(p => p.octant === o);
      const pts = [];
      const homePt = { x: Math.cos((o + 0.5) * wedge) * 6800, z: Math.sin((o + 0.5) * wedge) * 6800 };
      pts.push(homePt);
      let tries = 0;
      while (pts.length < 16 && tries < 5000) {
        tries++;
        const r = 2300 + Math.sqrt(rnd()) * (R - 2900);
        const a = o * wedge + (0.08 + rnd() * 0.84) * wedge;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        // afstand tot barrière-lijnen
        const da = Math.min(a - o * wedge, (o + 1) * wedge - a) * r;
        if (da < 520) continue;
        if (pts.some(q => dist2(q.x, q.z, x, z) < 1150 * 1150)) continue;
        pts.push({ x, z });
      }
      pts.forEach((pt, k) => {
        let kind;
        if (k === 0) kind = owner ? 'home' : (S.map === 'empty' ? 'white' : 'yellow');
        else if (S.map === 'power') kind = owner ? 'homeLike' : 'yellow';
        else if (S.map === 'empty') kind = 'white';
        else if (S.map === 'dense') kind = 'yellow';
        else kind = k <= 7 ? 'yellow' : 'white';
        const empireForYellow = () => {
          let e; do { e = Math.floor(rnd() * WP.EMPIRES.length); } while (usedEmp.has(e) && rnd() < 0.85);
          return e;
        };
        const pl = this.makePlanet(pt.x, pt.z, o, kind, owner, kind === 'yellow' ? empireForYellow() : -1);
        this.planets.push(pl);
        if (k === 0 && owner) { owner.home = pl.id; }
      });
    }
    // spelers in de baan van hun thuisplaneet plaatsen
    this.players.forEach(p => this.placeAtHome(p, true));
    this.players.forEach(p => this.visit(p, this.planetById(p.home)));
  }

  makePlayer(e, i) {
    const S = this.settings;
    const items = { cargopod: 1, energypod: 1, chargepod: 1, shield: 1, laser: 1, torpedo: 25, hull: 2 };
    const p = {
      id: e.id, name: e.name, human: !!e.human, path: e.path, empire: e.empire, design: e.design,
      octant: e.octant != null ? e.octant : i, home: null, alive: true, respawn: 0,
      x: 0, z: 0, hx: 1, hz: 0, speed: 0, tx: null, tz: null, tPlanet: null, tGate: null, orbit: null, orbitAng: 0,
      energy: 0, charge: 0, cargo: 0, shieldsOn: true, shieldHeat: 0,
      items, slots: ['laser', 'torpedo', null, null, null, null, null], sel: 1,
      credits: S.cash, loan: 0, invested: 0, colonists: 600, tek: S.tek, plague: 0,
      mining: false, stealth: 0, stealthT: 0, scream: false, warpArmed: false, wormArmed: false, sd: 0,
      visited: [], kills: 0, deaths: 0, autoshop: false, cd: 0, wormCd: 0, lastHit: null, lastHitT: -99,
      ai: e.human ? null : { level: e.aiLevel != null ? e.aiLevel : S.aiLevel, state: 'idle', t: 0 },
      xp: 0,
    };
    p.energy = this.energyMax(p); p.charge = this.chargeMax(p);
    return p;
  }

  makePlanet(x, z, oct, kind, owner, empire) {
    const rnd = this.rnd;
    const types = ['terran', 'desert', 'ice', 'lava', 'gas', 'ocean', 'barren', 'jungle'];
    const pl = {
      id: this.id(), name: WP.makeName(rnd), x, z, oct, r: 60 + rnd() * 70, type: types[Math.floor(rnd() * types.length)],
      tex: Math.floor(rnd() * 1e6), empire: -1, pop: 0, maxPop: 30000 + rnd() * 70000, ore: 15000 + rnd() * 40000, cash: 0, love: 0,
      dev: { mining: 0, port: 0, manu: 0, agri: 0, defense: 0, edu: 0 }, cap: { mining: 0, port: 0, manu: 0, agri: 0, defense: 0, edu: 0 },
      plague: 0, distress: false, dReason: '', shields: 0, stock: {}, colonists: 0, spies: { green: 0, red: 0 },
      droneCd: 2, gunCd: 3, homeOf: null, lastAtk: -99, invHist: { green: 0, red: 0 },
    };
    if (kind === 'home' || kind === 'homeLike') {
      pl.empire = owner.empire; pl.maxPop = 150000; pl.pop = 120000; pl.ore = 40000;
      for (const k in pl.dev) pl.dev[k] = kind === 'home' ? 0.55 : 0.5;
      pl.love = WP.PATHS[owner.path].sign * 1000; pl.r = 150; pl.type = kind === 'home' ? 'terran' : pl.type;
      if (kind === 'home') { pl.homeOf = owner.id; pl.name = WP.EMPIRES[owner.empire].name + ' Prime'; }
      pl.shields = 6; pl.colonists = 2000;
    } else if (kind === 'yellow') {
      pl.empire = empire; pl.pop = pl.maxPop * (0.5 + rnd() * 0.3); pl.ore = 18000 + rnd() * 30000;
      for (const k in pl.dev) pl.dev[k] = 0.04 + rnd() * 0.22;
      pl.love = (rnd() - 0.5) * 200;
    }
    pl.cash = pl.pop * 1.5;
    if (pl.pop > 0) for (const it of WP.ITEMS) if (this.itemAllowed(it) && it.dev <= this.devLevel(pl)) pl.stock[it.id] = Math.max(it.maxP > 50 ? 1 : 0, Math.round(it.maxP * (0.25 + rnd() * 0.3)));
    return pl;
  }

  itemAllowed(it) {
    const S = this.settings;
    if (S.noPlague && it.id === 'plague') return false;
    if (S.noPlagueCure && it.id === 'antiplague') return false;
    if (S.noWarp && it.id === 'warp') return false;
    if (S.noBarrier && it.id === 'barrier') return false;
    if (S.noBuster && it.id === 'buster') return false;
    if (S.noWorm && it.id === 'wormgate') return false;
    return true;
  }

  // ---------- afgeleide waarden ----------
  planetById(id) { return this.planets.find(p => p.id === id); }
  player(id) { return this.players.find(p => p.id === id); }
  energyMax(p) { return EN_UNIT * (1 + (p.items.energypod || 0)); }
  chargeMax(p) { return CH_UNIT * (1 + (p.items.chargepod || 0)); }
  cargoMax(p) { return CARGO_UNIT * (p.items.cargopod || 0); }
  freeSpeed(p) { return clamp(2 + (p.items.energypod || 0) - (this.shieldsUp(p) ? 1 : 0), 0, 10); }
  shieldsUp(p) { return p.shieldsOn && (p.items.shield || 0) > 0 && !p.stealth && !p.mining && !(p.stealthT > 0); }
  devAvg(pl) { const d = pl.dev; return (d.mining + d.port + d.manu + d.agri + d.defense + d.edu) / 6; }
  devLevel(pl) { return pl.pop <= 0 ? 0 : Math.round(this.devAvg(pl) * 32000 + pl.pop / 40); }
  aura(pl) { if (pl.pop <= 0) return 'white'; if (pl.love >= 300) return 'green'; if (pl.love <= -300) return 'red'; return 'yellow'; }
  tekFactor(p) { return 1 + (p.tek - 1) / 9; }
  cost100(pl) { return 300000 + pl.pop * 6; }
  orePrice(pl) { return Math.round(clamp(2400000 / (pl.ore + 14000), 8, 260) * (1 - 0.5 * pl.dev.mining)); }
  friendly(pl, p) { const a = this.aura(pl); return a === 'yellow' || a === p.path; }
  hostile(pl, p) { const a = this.aura(pl); return (a === 'green' || a === 'red') && a !== p.path; }
  screamFactor(x, z) {
    let f = 1;
    for (const q of this.players) if (q.alive && q.scream && !q.respawn && dist2(q.x, q.z, x, z) < 2600 * 2600) f *= 2;
    return f;
  }
  effShields(p) { return this.shieldsUp(p) ? Math.floor((p.items.shield || 0) / this.screamFactor(p.x, p.z)) : 0; }
  pathPlayers(path) { return this.players.filter(p => p.path === path); }

  visit(p, pl) { if (pl && !p.visited.includes(pl.id)) p.visited.push(pl.id); }

  placeAtHome(p, initial) {
    let pl = this.planetById(p.home);
    if (!pl || this.aura(pl) !== p.path) {
      const own = this.planets.filter(q => this.aura(q) === p.path).sort((a, b) => b.pop - a.pop);
      if (own.length) pl = own[0];
    }
    if (!pl) pl = this.planetById(p.home);
    p.orbit = pl.id; p.orbitAng = this.rnd() * TAU; p.tPlanet = null; p.tx = p.tz = null; p.speed = 0;
    const r = pl.r + ORBIT_GAP;
    p.x = pl.x + Math.cos(p.orbitAng) * r; p.z = pl.z + Math.sin(p.orbitAng) * r;
  }

  // ---------- commando's (van spelers en bots) ----------
  command(pid, cmd) {
    const p = this.player(pid);
    if (!p || this.over) return;
    if (cmd.c === 'chat') return this.chat(p, cmd.text, cmd.team);
    if (!p.alive || p.respawn > 0) return;
    const S = this.settings;
    switch (cmd.c) {
      case 'course': {
        p.mining = false;
        if (p.warpArmed && cmd.map) return this.warp(p, cmd.x, cmd.z);
        if (p.wormArmed && cmd.map) return this.makeGate(p, cmd.x, cmd.z);
        this.leaveOrbit(p);
        p.tx = cmd.x; p.tz = cmd.z; p.tPlanet = null; p.tGate = null;
        this.setHeading(p, cmd.x, cmd.z);
        if (p.speed === 0) p.speed = Math.max(1, this.freeSpeed(p));
        break;
      }
      case 'orbitPlanet': {
        p.mining = false;
        const pl = this.planetById(cmd.id); if (!pl) return;
        if (p.orbit === pl.id) return;
        this.leaveOrbit(p);
        p.tPlanet = pl.id; p.tGate = null; p.tx = pl.x; p.tz = pl.z; this.setHeading(p, pl.x, pl.z);
        if (p.speed === 0) p.speed = Math.max(1, this.freeSpeed(p));
        break;
      }
      case 'gate': {
        const g = this.gates.find(g => g.id === cmd.id); if (!g) return;
        this.leaveOrbit(p);
        const end = dist2(p.x, p.z, g.ax, g.az) < dist2(p.x, p.z, g.bx, g.bz) ? 'a' : 'b';
        p.tGate = { id: g.id, end }; p.tPlanet = null;
        p.tx = end === 'a' ? g.ax : g.bx; p.tz = end === 'a' ? g.az : g.bz; this.setHeading(p, p.tx, p.tz);
        if (p.speed === 0) p.speed = Math.max(1, this.freeSpeed(p));
        break;
      }
      case 'speed': if (p.orbit && cmd.d > 0) { this.leaveOrbit(p, true); } p.speed = clamp(p.speed + cmd.d, 0, 10); break;
      case 'stop': p.speed = 0; break;
      case 'reverse': if (p.orbit) return; p.hx = -p.hx; p.hz = -p.hz; p.tx = p.tz = null; p.tPlanet = null; this.snd('click', p.x, p.z, p.id); break;
      case 'sel': if (cmd.slot >= 0 && cmd.slot < 7) { const it = WP.ITEM[p.slots[cmd.slot]]; if (it && it.kind === 'device') this.activate(p, it.id); else if (it) p.sel = cmd.slot; } break;
      case 'fire': this.fire(p, cmd.x, cmd.z, cmd.tid); break;
      case 'shields': if (!p.stealth) { p.shieldsOn = !p.shieldsOn; this.snd('click', p.x, p.z, p.id); } break;
      case 'mine': this.toggleMine(p); break;
      case 'sell': this.sell(p, cmd.all); break;
      case 'colonize': this.colonize(p); break;
      case 'invest': this.invest(p, cmd.cat, cmd.amt); break;
      case 'borrow': this.borrow(p); break;
      case 'repay': this.repay(p); break;
      case 'buy': this.buy(p, cmd.item, cmd.n); break;
      case 'sellItem': this.sellItem(p, cmd.item); break;
      case 'equip': this.equip(p, cmd.slot, cmd.item); break;
      case 'unequip': if (p.slots[cmd.slot]) { p.slots[cmd.slot] = null; this.snd('cranedn', p.x, p.z, p.id); } break;
      case 'warpTo': { const pl = this.planetById(cmd.id); if (pl && p.items.warp && p.slots.includes('warp')) { this.warp(p, pl.x + pl.r + 400, pl.z, pl.id); } break; }
      case 'autoshop': p.autoshop = !p.autoshop; break;
      case 'pause': if (!S.noPause) this.paused = !this.paused; break;
    }
  }

  chat(p, text, team) {
    text = String(text || '').slice(0, 200); if (!text) return;
    if (text.startsWith(']')) { team = true; text = text.slice(1).trim(); }
    this.ev({ k: 'radio', to: team ? 'path:' + p.path : null, text, color: WP.PATHS[p.path].css, from: p.name, team });
    this.snd('radio', p.x, p.z);
  }

  setHeading(p, x, z) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > 1) { p.hx = dx / d; p.hz = dz / d; } }

  leaveOrbit(p, keepTarget) {
    if (!p.orbit) return;
    const pl = this.planetById(p.orbit);
    p.orbit = null; p.mining = false;
    if (pl) { const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz) || 1; p.hx = dx / d; p.hz = dz / d; }
    if (keepTarget) { p.tx = p.tz = null; }
  }

  enterOrbit(p, pl) {
    p.orbit = pl.id; p.tPlanet = null; p.tx = p.tz = null; p.speed = 0;
    p.orbitAng = Math.atan2(p.z - pl.z, p.x - pl.x);
    this.visit(p, pl);
    const a = this.aura(pl);
    // noodsignaal stillen
    if (pl.distress) { pl.distress = false; if (a === p.path) this.radio(p.id, `${pl.name} is gerustgesteld. Bedankt, kapitein!`, '#9fd3ff'); }
    // plaag overdracht
    if (pl.plague > 0.05 && pl.pop > 0) p.plague = Math.max(p.plague, 1);
    else if (p.plague > 0 && pl.pop > 0) { pl.plague = Math.min(1, pl.plague + 0.06); }
    // bijtanken
    if (a === p.path) {
      const target = this.energyMax(p) * (0.25 + 0.75 * pl.dev.port);
      if (p.energy < target) { p.energy = target; this.snd('service', p.x, p.z, p.id); }
      p.charge = Math.max(p.charge, this.chargeMax(p) * (0.3 + 0.7 * pl.dev.port));
    }
    // kolonisten oppikken
    if (pl.pop > 0 && (a === p.path || pl.empire === p.empire) && pl.colonists >= 50) {
      const n = Math.min(Math.floor(pl.colonists), 5000 - p.colonists);
      if (n > 0) { p.colonists += n; pl.colonists -= n; }
    }
    if (p.autoshop && this.friendly(pl, p) && pl.pop > 0) this.autoshop(p, pl);
    this.snd('pop', p.x, p.z, p.id);
  }

  // ---------- mijnen, verkopen, koloniseren ----------
  toggleMine(p) {
    const pl = this.planetById(p.orbit);
    if (!pl) return;
    if (pl.pop > 0) return this.sell(p, true);
    if (p.mining) { p.mining = false; return; }
    if (pl.ore <= 0) return this.radio(p.id, `${pl.name} is leeggemijnd.`, '#ffb347');
    if (p.cargo >= this.cargoMax(p) - 1) return this.radio(p.id, 'Je laadruim is vol. Verkoop je erts aan een bewoonde planeet.', '#ffb347');
    p.mining = true; p.mineStop = p.items.autominer ? this.cargoMax(p) : Math.min(this.cargoMax(p), (Math.floor(p.cargo / CARGO_UNIT) + 1) * CARGO_UNIT);
    this.snd('mining', p.x, p.z);
  }

  sell(p, all) {
    const pl = this.planetById(p.orbit);
    if (!pl || pl.pop <= 0 || !this.friendly(pl, p) || p.cargo < 1) return;
    const price = this.orePrice(pl);
    let tons = all ? p.cargo : Math.min(p.cargo, p.cargo % CARGO_UNIT || CARGO_UNIT);
    tons = Math.min(tons, Math.floor(pl.cash / price));
    if (tons < 1) return this.radio(p.id, `${pl.name} kan je erts niet betalen. (Investeer om ze geld te geven.)`, '#ffb347');
    p.cargo -= tons; pl.ore += tons; pl.cash -= tons * price; p.credits += tons * price;
    pl.love += WP.PATHS[p.path].sign * tons / 1000 * 12;
    pl.love = clamp(pl.love, -1000, 1000);
    if (pl.distress && pl.dReason === 'ore') pl.distress = false;
    this.radio(p.id, `${WP.fmt(tons)} ton erts verkocht aan ${pl.name} voor ${WP.fmt(tons * price)} cr (${price} cr/ton).`, '#7dffb0');
    this.snd('clink', p.x, p.z, p.id);
  }

  colonize(p) {
    const pl = this.planetById(p.orbit);
    if (!pl) return;
    if (p.colonists < 200) return this.radio(p.id, 'Je hebt minimaal 200 kolonisten nodig. Haal ze op bij ontwikkelde planeten van je eigen Pad of rijk.', '#ffb347');
    const sign = WP.PATHS[p.path].sign;
    if (pl.pop <= 0) {
      pl.empire = p.empire; pl.pop = p.colonists; pl.love = sign * 700; pl.plague = p.plague ? 0.05 : 0;
      for (const k in pl.dev) pl.dev[k] = 0.02;
      pl.cash = 20000; pl.stock = {}; pl.shields = 0; pl.distress = false; pl.maxPop = Math.max(pl.maxPop, 40000);
      this.colBonus[p.path]++;
      this.radio(null, `${p.name} heeft ${pl.name} gekoloniseerd voor het ${WP.PATHS[p.path].name}!`, WP.PATHS[p.path].css);
    } else if (pl.empire === p.empire || this.aura(pl) === p.path) {
      pl.pop += p.colonists;
      this.radio(p.id, `${WP.fmt(p.colonists)} kolonisten afgezet op ${pl.name}.`, '#7dffb0');
    } else return this.radio(p.id, 'Je kunt alleen onbewoonde planeten of planeten van je eigen rijk koloniseren.', '#ffb347');
    p.colonists = 0;
    this.snd('service', p.x, p.z, p.id);
  }

  // ---------- bank & investeren ----------
  invest(p, cat, amt) {
    const pl = this.planetById(p.orbit);
    if (!pl || pl.pop <= 0 || !this.friendly(pl, p)) return;
    if (p.loan > 0) return this.radio(p.id, 'De First Galactic Bank weigert: los eerst je lening af voordat je investeert.', '#ffb347');
    if (!(cat in pl.dev)) return;
    if (pl.dev[cat] >= 1) return this.radio(p.id, 'Deze categorie is al 100% ontwikkeld.', '#ffb347');
    amt = Math.min(amt, p.credits); if (amt < 1000) return;
    const c100 = this.cost100(pl), sign = WP.PATHS[p.path].sign;
    p.credits -= amt; p.invested += amt; pl.cap[cat] += amt; pl.cash += amt * 0.2;
    pl.love = clamp(pl.love + sign * amt / c100 * 1000, -1000, 1000);
    pl.invHist[p.path] += amt;
    for (const q of this.planets) if (q !== pl && q.empire === pl.empire && q.pop > 0) q.love = clamp(q.love + sign * amt / c100 * 110, -1000, 1000);
    this.snd('clink', p.x, p.z, p.id);
  }
  loanLimit(p) { return Math.floor(p.invested * 0.5 / 100000) * 100000; }
  borrow(p) {
    if (p.loan + 100000 > this.loanLimit(p)) return this.radio(p.id, 'Onvoldoende onderpand. Investeer meer in planeten om te kunnen lenen.', '#ffb347');
    p.loan += 100000; p.credits += 100000; this.snd('clink', p.x, p.z, p.id);
  }
  repay(p) { if (p.loan > 0 && p.credits >= 100000) { p.loan -= 100000; p.credits -= 100000; this.snd('clink', p.x, p.z, p.id); } }

  // ---------- winkel & dok ----------
  shopList(p, pl) {
    if (!pl || pl.pop <= 0 || !this.friendly(pl, p)) return [];
    const dl = this.devLevel(pl);
    return WP.ITEMS.filter(it => this.itemAllowed(it) && it.tek <= p.tek && it.dev <= dl);
  }
  price(p, pl, it) { return Math.round(it.price * (this.aura(pl) === p.path ? 0.9 : 1)); }
  buy(p, itemId, n) {
    const pl = this.planetById(p.orbit), it = WP.ITEM[itemId];
    if (!pl || !it || !this.shopList(p, pl).includes(it)) return;
    const have = p.items[it.id] || 0, price = this.price(p, pl, it);
    n = Math.min(n || 1, it.maxS - have, Math.floor(pl.stock[it.id] || 0), Math.floor(p.credits / price));
    if (n <= 0) {
      if (have >= it.maxS) this.radio(p.id, `Je schip kan niet meer ${it.name} dragen (max ${it.maxS}).`, '#ffb347');
      else if (!(pl.stock[it.id] >= 1)) this.radio(p.id, `${it.name} is uitverkocht op ${pl.name}.`, '#ffb347');
      else this.radio(p.id, 'Onvoldoende krediet.', '#ffb347');
      return;
    }
    p.items[it.id] = have + n; pl.stock[it.id] -= n; p.credits -= n * price; pl.cash += n * price * 0.5;
    if (it.id === 'energypod') p.energy += EN_UNIT * n;
    if (it.id === 'chargepod') p.charge += CH_UNIT * n;
    if (it.id === 'shield' && have === 0) p.shieldHeat = 0;
    if ((it.kind === 'weapon' || it.kind === 'device') && !p.slots.includes(it.id)) {
      const free = p.slots.indexOf(null); if (free >= 0) p.slots[free] = it.id;
    }
    this.snd('clink', p.x, p.z, p.id);
  }
  sellItem(p, itemId) { /* gereserveerd */ }
  autoshop(p, pl) {
    const list = this.shopList(p, pl);
    const sel = p.slots[p.sel];
    for (const id of ['shield', 'energypod', 'chargepod', sel]) {
      const it = WP.ITEM[id]; if (!it || !list.includes(it) || it.beam) continue;
      this.buy(p, id, id === sel ? 50 : 5);
    }
  }
  equip(p, slot, itemId) {
    const it = WP.ITEM[itemId];
    if (!it || !(p.items[itemId] > 0) || (it.kind !== 'weapon' && it.kind !== 'device')) return;
    if (slot < 0 || slot > 6) return;
    const old = p.slots.indexOf(itemId); if (old >= 0) p.slots[old] = null;
    p.slots[slot] = itemId; this.snd('craneup', p.x, p.z, p.id);
  }

  // ---------- wapens ----------
  fire(p, x, z, tid) {
    const id = p.slots[p.sel]; const it = WP.ITEM[id];
    if (!it || it.kind !== 'weapon') return;
    if (p.stealth || p.stealthT > 0) return this.radio(p.id, 'Wapens werken niet terwijl stealth actief is.', '#ffb347');
    if (p.mining) return;
    if (p.cd > 0) return;
    if (!it.beam && !(p.items[id] > 0)) return this.radio(p.id, `Geen ${it.name} meer. Koop meer in een winkel.`, '#ffb347');
    if (p.charge < it.cost) return this.radio(p.id, 'Onvoldoende lading om te vuren.', '#ffb347');
    p.charge -= it.cost; p.cd = it.beam ? 0.45 : 0.3;
    const tf = this.tekFactor(p);
    if (it.beam) {
      const cf = clamp(p.charge / this.chargeMax(p), 0, 1);
      const range = 700 + 1500 * cf;
      let dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d > range) { x = p.x + dx / d * range; z = p.z + dz / d * range; }
      this.ev({ k: 'beam', x1: p.x, z1: p.z, x2: x, z2: z, c: p.path });
      this.snd('laser', p.x, p.z);
      this.explode(x, z, it.dmg * (0.5 + 0.5 * cf) * tf, it.blast, p.id, 'laser');
      return;
    }
    p.items[id]--;
    let target = null;
    if (it.homing) {
      // dichtstbijzijnde vijandelijke schip bij de klik
      let best = null, bd = 400 * 400;
      for (const q of this.players) if (q !== p && q.alive && !q.respawn && q.path !== p.path) { const d = dist2(q.x, q.z, x, z); if (d < bd) { bd = d; best = q; } }
      if (!best) { p.items[id]++; p.charge += it.cost; return this.radio(p.id, 'Klik precies op een vijandelijk schip om een Hunter-Seeker te lanceren.', '#ffb347'); }
      target = best.id;
    }
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1;
    const sp = it.speed;
    this.projs.push({ id: this.id(), type: id, owner: p.id, path: p.path, x: p.x + dx / d * 30, z: p.z + dz / d * 30, vx: dx / d * sp, vz: dz / d * sp, tx: x, tz: z,
      target, life: it.homing ? 70 : d / sp + 0.05, armed: false, dmg: (it.dmg || 0) * tf, blast: it.blast || 60, age: 0 });
    this.snd(id === 'mine' ? 'mine' : id === 'neutron' ? 'neutron' : id === 'plague' ? 'plague' : id === 'spy' ? 'spy' : id === 'raiders' ? 'raiders' : id === 'buster' ? 'buster' : 'torpedo', p.x, p.z);
  }

  activate(p, id) {
    const it = WP.ITEM[id]; if (!(p.items[id] > 0)) return;
    switch (id) {
      case 'stealth':
        p.stealthT = 1.5; p.stealthTo = !p.stealth; p.stealth = false;
        this.snd(p.stealthTo ? 'stelon' : 'steloff', p.x, p.z);
        break;
      case 'scream': p.scream = !p.scream; this.snd(p.scream ? 'scrmon' : 'scrmoff', p.x, p.z); break;
      case 'antiplague': {
        if (p.charge < it.cost) return;
        p.charge -= it.cost; p.items.antiplague--; p.plague = 0;
        let n = 0;
        for (const pl of this.planets) if (pl.plague > 0 && dist2(pl.x, pl.z, p.x, p.z) < 2200 * 2200) { pl.plague = Math.max(0, pl.plague - 0.45); n++; }
        this.snd('antibio', p.x, p.z); this.ev({ k: 'pulse', x: p.x, z: p.z, r: 2200, c: '#7dffb0' });
        this.radio(p.id, `Anti-plaagveld geactiveerd (${n} planeten behandeld).`, '#7dffb0');
        break;
      }
      case 'slaves': {
        const mine = this.drones.filter(d => d.kind === 'slave' && d.owner === p.id).length;
        if (mine >= 6) return this.radio(p.id, 'Maximaal 6 androids tegelijk.', '#ffb347');
        p.items.slaves--;
        this.drones.push({ id: this.id(), kind: 'slave', owner: p.id, path: p.path, x: p.x, z: p.z, vx: 0, vz: 0, hp: 2500, cd: 1, life: 240, target: null, slot: mine });
        this.snd('tommy', p.x, p.z);
        break;
      }
      case 'warp': p.warpArmed = !p.warpArmed; p.wormArmed = false; this.radio(p.id, p.warpArmed ? 'Warp-sprong gereed: klik op de sterrenkaart (of gebruik de gids).' : 'Warp uitgeschakeld.', '#9fd3ff'); this.snd('click', p.x, p.z, p.id); break;
      case 'wormgate': p.wormArmed = !p.wormArmed; p.warpArmed = false; this.radio(p.id, p.wormArmed ? 'Wormgate-lanceerder gereed: klik op de sterrenkaart voor het tweede poort.' : 'Wormgate geannuleerd.', '#9fd3ff'); this.snd('click', p.x, p.z, p.id); break;
      case 'selfdestruct':
        if (p.sd > 0) { p.sd = 0; this.radio(p.id, 'Zelfvernietiging geannuleerd.', '#7dffb0'); }
        else { p.sd = 5; this.radio(null, `${p.name}: ZELFVERNIETIGING GESTART!`, '#ff5555'); }
        this.snd('static', p.x, p.z);
        break;
      case 'escape':
        p.items.escape--; this.leaveOrbit(p); this.ev({ k: 'warp', x: p.x, z: p.z });
        this.placeAtHome(p); this.ev({ k: 'warp', x: p.x, z: p.z }); this.snd('wormout', p.x, p.z);
        break;
    }
  }

  warp(p, x, z) {
    const cost = 900;
    if (p.charge < cost) return this.radio(p.id, `Warp vereist ${cost} lading.`, '#ffb347');
    const r = Math.hypot(x, z); if (r > R * 1.25) { x *= R * 1.25 / r; z *= R * 1.25 / r; }
    p.charge -= cost; p.warpArmed = false; this.leaveOrbit(p);
    this.ev({ k: 'warp', x: p.x, z: p.z }); this.snd('wormin', p.x, p.z);
    p.x = x; p.z = z; p.tx = p.tz = null; p.tPlanet = null; p.speed = 0;
    this.ev({ k: 'warp', x, z }); this.snd('wormout', x, z);
  }

  makeGate(p, x, z) {
    if (!(p.items.wormgate > 0)) return;
    for (const pl of this.planets) if (dist2(pl.x, pl.z, p.x, p.z) < 500 * 500 || dist2(pl.x, pl.z, x, z) < 500 * 500)
      return this.radio(p.id, 'Te dicht bij een planeet! Plaats wormgates in open ruimte.', '#ffb347');
    p.items.wormgate--; p.wormArmed = false;
    const g = { id: this.id(), owner: p.id, ax: p.x, az: p.z, bx: x, bz: z, name: 'Wormgate ' + (this.gates.length + 1) };
    this.gates.push(g); this.snd('wormin', p.x, p.z);
    this.radio(null, `${p.name} heeft een wormgat geopend.`, '#c9a0ff');
  }

  explode(x, z, dmg, blast, ownerId, type) {
    const owner = this.player(ownerId);
    const size = Math.min(6, 0.6 + Math.log10(dmg + 10) - 2.4);
    this.ev({ k: 'boom', x, z, s: blast, d: dmg, t: type });
    if (type !== 'laser') this.snd(dmg > 100000 ? 'busterx' : dmg > 10000 ? 'boom3' : dmg > 1500 ? 'boom' : 'boom2', x, z);
    if (dmg >= 30000) this.ev({ k: 'shake', x, z, a: Math.min(1, dmg / 100000) });
    const reach = blast * 7;
    for (const q of this.players) {
      if (!q.alive || q.respawn > 0) continue;
      const d = dist(q.x, q.z, x, z); if (d > reach) continue;
      const f = d <= blast ? 1 : (blast / d) * (blast / d);
      this.damageShip(q, dmg * f, ownerId);
    }
    for (const pl of this.planets) {
      if (pl.pop <= 0) continue;
      const d = Math.max(0, dist(pl.x, pl.z, x, z) - pl.r); if (d > reach) continue;
      const f = d <= blast ? 1 : (blast / d) * (blast / d);
      this.damagePlanet(pl, dmg * f, owner);
    }
    for (const dr of this.drones) {
      const d = dist(dr.x, dr.z, x, z); if (d > reach) continue;
      const f = d <= blast ? 1 : (blast / d) * (blast / d); dr.hp -= dmg * f;
      if (dr.kind === 'drone' && owner && dr.path === owner.path) { /* friendly fire */ }
    }
    for (const m of this.projs) if (m.type === 'mine' && m.armed && !m.trig && dist2(m.x, m.z, x, z) < (blast + 60) * (blast + 60)) { m.trig = 1; m.life = 0.12 + Math.random() * 0.15; }
    for (const g of this.gates) { /* poorten zijn onverwoestbaar */ }
  }

  damageShip(q, amt, attackerId) {
    if (amt <= 1) return;
    const sh = this.effShields(q);
    const dmg = amt / Math.pow(2, sh);
    if (sh > 0) {
      q.shieldHeat += dmg * 1.2;
      if (q.shieldHeat > SHIELD_HEAT_MAX) { q.items.shield--; q.shieldHeat = 0; this.snd('crack', q.x, q.z); this.ev({ k: 'shieldpop', id: q.id }); }
    }
    q.energy -= dmg;
    if (attackerId && attackerId !== q.id) { q.lastHit = attackerId; q.lastHitT = this.t; }
    this.ev({ k: 'hit', id: q.id, d: dmg });
    if (q.energy <= 0) this.killShip(q, attackerId);
  }

  killShip(q, killerId) {
    if (q.respawn > 0 || !q.alive) return;
    const S = this.settings;
    this.ev({ k: 'boom', x: q.x, z: q.z, s: 160, d: 20000, t: 'ship' });
    this.snd('deadship', q.x, q.z);
    const killer = this.player(killerId);
    q.deaths++;
    if (killer && killer !== q) killer.kills++;
    this.radio(null, killer && killer !== q ? `${q.name} is vernietigd door ${killer.name}!` : `${q.name} is vernietigd!`, '#ff8a5c');
    q.cargo = 0; q.colonists = 0; q.mining = false; q.orbit = null; q.stealth = 0; q.stealthT = 0; q.scream = false; q.sd = 0; q.warpArmed = q.wormArmed = false; q.plague = 0;
    for (const d of this.drones) if (d.kind === 'slave' && d.owner === q.id) d.hp = 0;
    const spare = q.items.hull || 0;
    if (S.deadLosesItems) {
      q.items = { cargopod: 1, energypod: 1, chargepod: 1, shield: 1, laser: 1, torpedo: 25, hull: spare };
      q.slots = ['laser', 'torpedo', null, null, null, null, null]; q.sel = 1;
    } else { q.items.shield = Math.max(1, q.items.shield || 0); }
    if (spare > 0) {
      q.items.hull = spare - 1; q.respawn = 3; q.energy = 1;
    } else {
      q.alive = false; q.energy = 0;
      this.radio(null, `${q.name} heeft geen schepen meer en is nu toeschouwer.`, '#ff8a5c');
    }
  }

  damagePlanet(pl, amt, attacker) {
    if (amt < 1 || pl.pop <= 0) return;
    const sh = Math.floor(pl.shields / this.screamFactor(pl.x, pl.z));
    const dmg = amt / Math.pow(2, Math.min(sh, 12));
    pl.shields = Math.max(0, pl.shields - dmg / 9000);
    const loss = dmg * 1.6;
    pl.pop -= loss;
    const df = clamp(dmg / (pl.pop + 60000), 0, 0.5);
    for (const k in pl.dev) pl.dev[k] *= (1 - df * 0.6);
    for (const k in pl.stock) pl.stock[k] *= (1 - df);
    pl.colonists *= (1 - df);
    if (pl.spies.green || pl.spies.red) { pl.spies.green = 0; pl.spies.red = 0; }
    if (attacker) {
      const sign = WP.PATHS[attacker.path].sign;
      pl.love = clamp(pl.love - sign * dmg / 40, -1000, 1000);
      for (const q of this.planets) if (q !== pl && q.empire === pl.empire && q.pop > 0) q.love = clamp(q.love - sign * dmg / 600, -1000, 1000);
    }
    if (this.t - pl.lastAtk > 8 && dmg > 50) {
      pl.distress = true; pl.dReason = 'attack';
      const a = this.aura(pl);
      if (a === 'green' || a === 'red') this.radio('path:' + a, `NOODSIGNAAL: ${pl.name} wordt aangevallen!`, '#ff5555');
      this.ev({ k: 'distress', id: pl.id });
    }
    pl.lastAtk = this.t;
    if (pl.pop <= 0) this.planetDies(pl, attacker);
  }

  planetDies(pl, attacker) {
    const a = this.aura({ pop: 1, love: pl.love });
    pl.pop = 0; pl.empire = -1; pl.love = 0; pl.plague = 0; pl.cash = 0; pl.stock = {}; pl.shields = 0; pl.colonists = 0; pl.distress = false;
    for (const k in pl.dev) { pl.dev[k] = 0; pl.cap[k] = 0; }
    this.radio(null, `${pl.name} is ontvolkt${attacker ? ' door ' + attacker.name : ''}! Er is geen leven meer.`, '#ff8a5c');
    this.ev({ k: 'boom', x: pl.x, z: pl.z, s: pl.r * 2, d: 50000, t: 'planet' });
    this.snd('fry', pl.x, pl.z);
  }

  planetHitSpecial(proj) {
    let best = null, bd = 1e18;
    for (const pl of this.planets) { const d = dist2(pl.x, pl.z, proj.x, proj.z); if (d < (pl.r + 90) * (pl.r + 90) && d < bd) { bd = d; best = pl; } }
    this.ev({ k: 'boom', x: proj.x, z: proj.z, s: 40, d: 200, t: proj.type });
    if (!best || best.pop <= 0) return;
    const owner = this.player(proj.owner);
    if (proj.type === 'plague') {
      best.plague = Math.min(1.2, best.plague + 0.1);
      this.radio(null, `${best.name} is besmet met de plaag!`, '#b6ff3d');
      if (owner) best.love = clamp(best.love - WP.PATHS[owner.path].sign * 120, -1000, 1000);
      best.distress = true; best.dReason = 'plague';
    } else if (proj.type === 'spy') {
      best.spies[proj.path] = 1; this.radio(proj.owner, `Spionnen zijn geland op ${best.name}.`, '#9fd3ff');
    } else if (proj.type === 'raiders') {
      best.dev.defense = Math.max(0, best.dev.defense - 0.15); best.shields = Math.max(0, best.shields - 3);
      this.radio(proj.owner, `Raiders saboteren de verdediging van ${best.name}.`, '#9fd3ff');
      if (owner) best.love = clamp(best.love - WP.PATHS[owner.path].sign * 40, -1000, 1000);
    }
  }

  // ---------- hoofdlus ----------
  step(dt) {
    if (this.over || this.paused) return;
    this.t += dt;
    this.stepPlayers(dt);
    this.stepProjs(dt);
    this.stepDrones(dt);
    // economie-tempo (spelsnelheid): 1 = klassiek, 2 = snel, 3 = turbo
    const eco = this.settings.gameSpeed || 1;
    this.secAcc += dt * eco;
    if (this.secAcc >= 1) { this.secAcc -= 1; this.stepEconomy(1); }
    this.minuteAcc += dt * eco;
    if (this.minuteAcc >= 60) { this.minuteAcc -= 60; this.payTaxes(); }
    if (WP.AI) for (const p of this.players) if (p.ai && p.alive) WP.AI.think(this, p, dt);
  }

  stepPlayers(dt) {
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.respawn > 0) {
        p.respawn -= dt;
        if (p.respawn <= 0) { p.respawn = 0; this.placeAtHome(p); p.energy = this.energyMax(p); p.charge = this.chargeMax(p); p.shieldHeat = 0; this.ev({ k: 'warp', x: p.x, z: p.z }); this.radio(p.id, 'Een reserveschip staat klaar bij je thuisplaneet.', '#9fd3ff'); }
        continue;
      }
      p.cd = Math.max(0, p.cd - dt); p.wormCd = Math.max(0, p.wormCd - dt);
      // stealth overgang
      if (p.stealthT > 0) { p.stealthT -= dt; if (p.stealthT <= 0) { p.stealthT = 0; p.stealth = p.stealthTo ? 1 : 0; } }
      if (p.stealth) { p.charge -= 45 * dt; if (p.charge <= 0) { p.charge = 0; p.stealth = 0; this.radio(p.id, 'Stealth uitgevallen: lading op!', '#ff5555'); this.snd('steloff', p.x, p.z); } }
      if (p.scream) { p.charge -= 60 * dt; if (p.charge <= 0) { p.charge = 0; p.scream = false; this.snd('scrmoff', p.x, p.z); } }
      if (p.sd > 0) { p.sd -= dt; if (p.sd <= 0) { p.sd = 0; const x = p.x, z = p.z; this.killShip(p, p.id); this.explode(x, z, 320000, 400, p.id, 'buster'); this.snd('busterx', x, z); continue; } }
      // schilden koelen
      p.shieldHeat = Math.max(0, p.shieldHeat - 90 * dt);
      // lading herladen
      const cm = this.chargeMax(p);
      if (!p.stealth && !p.scream) p.charge = Math.min(cm, p.charge + (65 + 25 * (p.items.chargepod || 0)) * dt);
      const em = this.energyMax(p);
      if (p.orbit) {
        const pl = this.planetById(p.orbit);
        if (!pl) { p.orbit = null; continue; }
        p.orbitAng += dt * 0.25;
        const r = pl.r + ORBIT_GAP;
        p.x = pl.x + Math.cos(p.orbitAng) * r; p.z = pl.z + Math.sin(p.orbitAng) * r;
        p.hx = -Math.sin(p.orbitAng); p.hz = Math.cos(p.orbitAng);
        // energie bijvullen bij eigen planeet
        if (this.aura(pl) === p.path) { const tgt = em * (0.25 + 0.75 * pl.dev.port); if (p.energy < tgt) p.energy = Math.min(tgt, p.energy + em * 0.1 * dt); }
        else p.energy = Math.min(em, p.energy + 15 * dt);
        if (p.mining) {
          const take = Math.min(500 * dt, pl.ore, p.mineStop - p.cargo);
          p.cargo += take; pl.ore -= take;
          if (pl.pop > 0 || pl.ore <= 0 || p.cargo >= p.mineStop - 0.01) { p.mining = false; if (pl.ore <= 0) this.radio(p.id, `${pl.name} is volledig leeggemijnd.`, '#ffb347'); this.snd('click', p.x, p.z, p.id); }
        }
        continue;
      }
      // vrije vlucht
      if (p.tGate) {
        const g = this.gates.find(g => g.id === p.tGate.id);
        if (g) { p.tx = p.tGate.end === 'a' ? g.ax : g.bx; p.tz = p.tGate.end === 'a' ? g.az : g.bz; }
      }
      if (p.tx != null && p.speed > 0) this.setHeading(p, p.tx, p.tz);
      // energie
      const free = this.freeSpeed(p);
      if (p.speed > free) {
        p.energy -= 6 * Math.pow(p.speed - free, 1.6) * dt;
        if (p.energy < em * 0.08) p.speed = free;
      } else if (p.speed === 0) p.energy = Math.min(em, p.energy + (25 + 10 * (p.items.energypod || 0)) * dt);
      if (this.shieldsUp(p) && p.speed > 0) p.energy -= 1.2 * dt;
      if (p.energy <= 0) { this.killShip(p, p.lastHit && this.t - p.lastHitT < 20 ? p.lastHit : null); continue; }
      const oct0 = WP.octantOf(p.x, p.z), r0 = Math.hypot(p.x, p.z);
      let step = p.speed * SPEED_UNIT * dt;
      // aankomst
      if (p.tPlanet) {
        const pl = this.planetById(p.tPlanet);
        const d = dist(p.x, p.z, pl.x, pl.z);
        if (d - step <= pl.r + ORBIT_GAP) { this.enterOrbit(p, pl); continue; }
      } else if (p.tGate) {
        const d = dist(p.x, p.z, p.tx, p.tz);
        if (d - step <= 60) { this.throughGate(p); continue; }
      } else if (p.tx != null) {
        const d = dist(p.x, p.z, p.tx, p.tz);
        if (d < step) { p.tx = p.tz = null; }
      }
      p.x += p.hx * step; p.z += p.hz * step;
      // wormgaten passeren zonder target
      if (p.wormCd <= 0) for (const g of this.gates) {
        if (dist2(p.x, p.z, g.ax, g.az) < 55 * 55) { p.tGate = { id: g.id, end: 'a' }; this.throughGate(p); break; }
        if (dist2(p.x, p.z, g.bx, g.bz) < 55 * 55) { p.tGate = { id: g.id, end: 'b' }; this.throughGate(p); break; }
      }
      // rand van het universum
      const r1 = Math.hypot(p.x, p.z);
      if (r1 > R * 1.35) { p.x *= R * 1.35 / r1; p.z *= R * 1.35 / r1; p.speed = 0; this.radio(p.id, 'Je hebt de rand van het bekende universum bereikt.', '#ffb347'); }
      // energiebarrière
      const oct1 = WP.octantOf(p.x, p.z);
      if (oct1 !== oct0 && Math.min(r0, r1) < R * 1.02) this.crossBarrier(p);
      // ontdekking
      for (const pl of this.planets) if (!p.visited.includes(pl.id) && dist2(pl.x, pl.z, p.x, p.z) < 260 * 260) this.visit(p, pl);
    }
  }

  crossBarrier(p) {
    const S = this.settings;
    this.ev({ k: 'barrier', x: p.x, z: p.z, id: p.id });
    if (!S.barrierDamage || p.items.barrier) { this.snd('barrier', p.x, p.z); return; }
    this.snd('fry', p.x, p.z);
    const sh = this.effShields(p);
    if (sh < 5) this.radio(p.id, `Energiebarrière! Met ${sh} actieve schild(en) is dat pijnlijk. (5 schilden of een Barrier Shield nodig)`, '#ff5555');
    this.damageShip(p, 64000, null);
  }

  throughGate(p) {
    const g = this.gates.find(g => g.id === p.tGate.id); if (!g) { p.tGate = null; return; }
    const out = p.tGate.end === 'a' ? { x: g.bx, z: g.bz } : { x: g.ax, z: g.az };
    this.ev({ k: 'warp', x: p.x, z: p.z }); this.snd('wormin', p.x, p.z);
    p.x = out.x + p.hx * 140; p.z = out.z + p.hz * 140; p.tGate = null; p.tx = p.tz = null; p.wormCd = 3;
    if ((p.items.shield || 0) > 0 && this.rnd() < 0.3) { p.items.shield--; this.radio(p.id, 'Je schampte de rand van het wormgat en verloor een schild!', '#ff5555'); this.snd('crack', p.x, p.z); }
    this.ev({ k: 'warp', x: p.x, z: p.z }); this.snd('wormout', p.x, p.z);
  }

  stepProjs(dt) {
    const keep = [];
    for (const m of this.projs) {
      m.age += dt;
      if (m.type === 'mine' && m.armed) {
        m.life -= dt;
        if (m.life <= 0 && !m.trig) { m.life = 0; }
        if (m.trig == null) {
          for (const q of this.players) {
            if (!q.alive || q.respawn > 0) continue;
            if (q.id === m.owner && m.age < 6) continue;
            if (dist2(q.x, q.z, m.x, m.z) < 75 * 75) { m.trig = 1; m.life = 0; break; }
          }
        }
        if (m.life <= 0) {
          if (m.trig) this.explode(m.x, m.z, m.dmg, m.blast, m.owner, 'mine');
          else this.ev({ k: 'warp', x: m.x, z: m.z, small: 1 });
          continue;
        }
        keep.push(m); continue;
      }
      if (m.type === 'seeker') {
        const t = this.player(m.target);
        if (!t || !t.alive || t.respawn > 0) { m.life = Math.min(m.life, 0.01); }
        else if (t.stealth) { m.vx *= 0.9; m.vz *= 0.9; }
        else {
          const dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz);
          const sp = WP.ITEM.seeker.speed;
          m.vx += (dx / d * sp - m.vx) * Math.min(1, dt * 3); m.vz += (dz / d * sp - m.vz) * Math.min(1, dt * 3);
          if (d < 55) { this.explode(m.x, m.z, m.dmg, m.blast, m.owner, 'seeker'); continue; }
        }
      }
      m.x += m.vx * dt; m.z += m.vz * dt; m.life -= dt;
      // torpedo's ontploffen ook bij voltreffer op vijandelijk schip of drone
      if (!WP.ITEM[m.type].planetOnly && m.type !== 'mine' && m.age > 0.15) {
        let hit = false;
        for (const q of this.players) if (q.alive && !q.respawn && q.path !== m.path && !q.stealth && dist2(q.x, q.z, m.x, m.z) < 38 * 38) { hit = true; break; }
        if (!hit) for (const dr of this.drones) if (dr.path !== m.path && dist2(dr.x, dr.z, m.x, m.z) < 30 * 30) { hit = true; break; }
        if (hit) { this.explode(m.x, m.z, m.dmg, m.blast, m.owner, m.type); continue; }
      }
      if (m.life <= 0) {
        if (m.type === 'mine') { m.armed = true; m.life = 150; m.vx = m.vz = 0; m.age = 0; keep.push(m); continue; }
        if (WP.ITEM[m.type].planetOnly) { this.planetHitSpecial(m); continue; }
        this.explode(m.x, m.z, m.dmg, m.blast, m.owner, m.type);
        continue;
      }
      keep.push(m);
    }
    this.projs = keep;
  }

  stepDrones(dt) {
    // planeten lanceren drones en vuren
    for (const pl of this.planets) {
      if (pl.pop <= 0) continue;
      const a = this.aura(pl); if (a !== 'green' && a !== 'red') continue;
      pl.droneCd -= dt; pl.gunCd -= dt;
      let target = null, td = 2100 * 2100;
      for (const q of this.players) {
        if (!q.alive || q.respawn > 0 || q.path === a || q.stealth) continue;
        const d = dist2(q.x, q.z, pl.x, pl.z); if (d < td) { td = d; target = q; }
      }
      if (!target) continue;
      const maxD = 1 + Math.floor(pl.dev.defense * 5) + (pl.homeOf ? 2 : 0);
      if (pl.droneCd <= 0 && this.drones.filter(d => d.home === pl.id).length < maxD) {
        pl.droneCd = 7 - pl.dev.defense * 3;
        this.drones.push({ id: this.id(), kind: 'drone', home: pl.id, path: a, x: pl.x, z: pl.z, vx: 0, vz: 0, hp: 700 + 1500 * pl.dev.defense, cd: 2, life: 70, target: target.id });
      }
      if (pl.dev.defense > 0.2 && pl.gunCd <= 0 && td < 1300 * 1300) {
        pl.gunCd = 5 - 3 * pl.dev.defense;
        const lead = Math.sqrt(td) / PT_SPEED, tx = target.x + target.hx * target.speed * SPEED_UNIT * lead, tz = target.z + target.hz * target.speed * SPEED_UNIT * lead;
        const dx = tx - pl.x, dz = tz - pl.z, d = Math.hypot(dx, dz) || 1;
        this.projs.push({ id: this.id(), type: 'torpedo', owner: null, path: a, x: pl.x + dx / d * (pl.r + 20), z: pl.z + dz / d * (pl.r + 20), vx: dx / d * PT_SPEED, vz: dz / d * PT_SPEED, tx, tz, life: d / PT_SPEED, armed: false, dmg: 1000 * (1 + pl.dev.edu), blast: 70, age: 0 });
        this.snd('torpedo', pl.x, pl.z);
      }
    }
    const keep = [];
    for (const d of this.drones) {
      d.life -= dt; d.cd -= dt;
      if (d.hp <= 0) { this.ev({ k: 'boom', x: d.x, z: d.z, s: 50, d: 800, t: 'drone' }); this.snd('deadrone', d.x, d.z); continue; }
      if (d.life <= 0) { this.ev({ k: 'warp', x: d.x, z: d.z, small: 1 }); continue; }
      let tx, tz, sp;
      if (d.kind === 'slave') {
        const o = this.player(d.owner);
        if (!o || !o.alive || o.respawn > 0) { d.hp = 0; continue; }
        // aanvaller zoeken
        let t = null;
        if (o.lastHit && this.t - o.lastHitT < 15) { const q = this.player(o.lastHit); if (q && q.alive && !q.respawn && !q.stealth) t = q; }
        if (!t) { let bd = 900 * 900; for (const dr of this.drones) if (dr.kind === 'drone' && dr.path !== d.path) { const dd = dist2(dr.x, dr.z, o.x, o.z); if (dd < bd) { bd = dd; t = dr; } } }
        const ang = this.t * 0.8 + d.slot * TAU / 6;
        tx = o.x + Math.cos(ang) * 120; tz = o.z + Math.sin(ang) * 120; sp = 1000;
        if (t && dist2(t.x, t.z, d.x, d.z) < 800 * 800 && d.cd <= 0) {
          d.cd = 0.9; this.ev({ k: 'beam', x1: d.x, z1: d.z, x2: t.x, z2: t.z, c: d.path, thin: 1 });
          if (t.kind) t.hp -= 500; else this.damageShip(t, 600, d.owner);
          this.snd('tommy', d.x, d.z);
        }
      } else {
        const t = this.player(d.target);
        if (!t || !t.alive || t.respawn > 0 || t.stealth) { const h = this.planetById(d.home); tx = h ? h.x : d.x; tz = h ? h.z : d.z; d.life = Math.min(d.life, 6); sp = 450; }
        else {
          const dd = dist(t.x, t.z, d.x, d.z);
          const a = Math.atan2(d.z - t.z, d.x - t.x) + 0.6;
          tx = t.x + Math.cos(a) * 280; tz = t.z + Math.sin(a) * 280; sp = 650;
          if (dd < 520 && d.cd <= 0) {
            d.cd = 1.6; this.ev({ k: 'beam', x1: d.x, z1: d.z, x2: t.x, z2: t.z, c: d.path, thin: 1 });
            this.damageShip(t, 420, null); this.snd('laser', d.x, d.z);
          }
        }
      }
      const dx = tx - d.x, dz = tz - d.z, dd = Math.hypot(dx, dz) || 1;
      const want = Math.min(sp, dd * 3);
      d.vx += (dx / dd * want - d.vx) * Math.min(1, dt * 2.5); d.vz += (dz / dd * want - d.vz) * Math.min(1, dt * 2.5);
      d.x += d.vx * dt; d.z += d.vz * dt;
      keep.push(d);
    }
    this.drones = keep;
  }

  stepEconomy(dt) {
    const S = this.settings;
    const perMin = dt / 60;
    for (const pl of this.planets) {
      if (pl.pop <= 0) continue;
      const dev = this.devAvg(pl), c100 = this.cost100(pl);
      // investeringen omzetten in ontwikkeling
      const rate = c100 * (S.quickROI ? 0.4 : 0.06) * dt;   // snel: een categorie is binnen enkele seconden klaar
      for (const k in pl.cap) if (pl.cap[k] > 0) {
        const use = Math.min(pl.cap[k], rate);
        pl.cap[k] -= use; pl.dev[k] = Math.min(1, pl.dev[k] + use / c100);
        if (pl.dev[k] >= 1) pl.cap[k] = 0;
      }
      // bevolking
      const maxPop = pl.maxPop * (0.6 + 1.4 * pl.dev.agri);
      if (pl.ore > 0) pl.pop += pl.pop * 0.05 * perMin * (1 - pl.pop / maxPop);
      else pl.pop -= pl.pop * 0.03 * perMin;
      // erts verbruik / diepe mijnbouw
      pl.ore = Math.max(0, pl.ore - pl.pop / 1000 * 0.12 * (1 - 0.6 * dev) * dt + pl.dev.mining * 8 * dt);
      // inkomsten
      pl.cash = Math.min(pl.pop * 4, pl.cash + pl.pop / 1000 * 400 * (0.5 + dev) * perMin);
      // kolonisten
      if (pl.pop > maxPop * 0.45) pl.colonists = Math.min(6000, pl.colonists + pl.pop * 0.006 * perMin);
      // winkelvoorraad
      const dl = this.devLevel(pl);
      for (const it of WP.ITEMS) {
        if (it.dev > dl || !this.itemAllowed(it)) continue;
        const cur = pl.stock[it.id] || 0;
        if (cur < it.maxP) pl.stock[it.id] = Math.min(it.maxP, cur + it.rate / 1000 * (0.3 + 1.7 * pl.dev.manu) * perMin);
      }
      // planetaire schilden
      const shT = pl.dev.defense * 8 + pl.dev.manu * 4 + (pl.homeOf ? 2 : 0);
      if (pl.shields < shT) pl.shields = Math.min(shT, pl.shields + 0.05 * dt);
      // plaag
      if (pl.plague > 0) {
        pl.plague = Math.min(1, pl.plague + pl.plague * 0.012 * dt);
        pl.pop -= pl.pop * pl.plague * 0.0035 * dt;
        if (pl.pop < 50) { this.planetDies(pl, null); continue; }
      }
      // noodsignalen
      if (!pl.distress && pl.ore < 1500) { pl.distress = true; pl.dReason = 'ore'; const a = this.aura(pl); if (a !== 'yellow') this.radio('path:' + a, `NOODSIGNAAL: ${pl.name} heeft bijna geen grondstoffen meer!`, '#ffb347'); this.ev({ k: 'distress', id: pl.id }); }
      if (pl.distress) {
        // verliest vertrouwen, sterkere planeten minder
        const decay = (6 - 4 * dev) * dt;
        if (pl.love > 0) pl.love = Math.max(0, pl.love - decay); else pl.love = Math.min(0, pl.love + decay);
        if (pl.dReason === 'attack' && this.t - pl.lastAtk > 60) pl.distress = false;
      }
      // empire-liefde normaliseert heel langzaam naar neutraal voor gele planeten
    }
    for (const pl of this.planets) if (pl.pop <= 0 && pl.ore < 20000) pl.ore += 0; // onbewoond: niets
    this.updateScores();
    for (const p of this.players) this.updateTek(p);
    this.checkVictory();
  }

  updateScores() {
    const sc = { green: 0, red: 0 }, cnt = { green: 0, red: 0, yellow: 0, white: 0 }, pop = { green: 0, red: 0 };
    for (const pl of this.planets) {
      const a = this.aura(pl); cnt[a]++;
      if (a === 'green' || a === 'red') { sc[a] += pl.pop / 1000 * (0.5 + this.devAvg(pl)); pop[a] += pl.pop; }
    }
    sc.green += this.colBonus.green * 20; sc.red += this.colBonus.red * 20;
    this.score = sc; this.counts = cnt; this.pops = pop;
    if (!this.history.t.length || this.t - this.history.t[this.history.t.length - 1] >= 10) {
      this.history.t.push(Math.round(this.t)); this.history.green.push(Math.round(pop.green)); this.history.red.push(Math.round(pop.red));
      if (this.history.t.length > 400) { this.history.t.shift(); this.history.green.shift(); this.history.red.shift(); }
    }
  }

  updateTek(p, quiet) {
    const n = Math.max(1, this.pathPlayers(p.path).length);
    const tek = clamp(Math.max(this.settings.tek, 1 + Math.floor(this.score[p.path] / n / 150)), 1, 10);
    if (tek > p.tek && !quiet) { this.radio(p.id, `Je Tek-niveau is gestegen naar ${WP.TEK_ROMAN[tek]}! Nieuwe technologie beschikbaar in de winkels.`, '#ffd84a'); this.snd('guide', p.x, p.z, p.id); }
    p.tek = tek;
  }

  payTaxes() {
    for (const path of ['green', 'red']) {
      let tax = 0;
      for (const pl of this.planets) if (this.aura(pl) === path) tax += pl.pop / 1000 * 120 * (0.5 + this.devAvg(pl));
      const ps = this.pathPlayers(path).filter(p => p.alive);
      this.taxLast[path] = Math.round(tax);
      if (!ps.length) continue;
      const each = tax / ps.length;
      for (const p of ps) { p.credits += each; this.radio(p.id, `Belasting ontvangen: ${WP.fmt(each)} cr.`, '#7dffb0'); }
    }
    this.snd('chirp' + (1 + Math.floor(this.rnd() * 8)), 0, 0, null);
  }

  checkVictory() {
    const S = this.settings;
    const aliveG = this.players.some(p => p.path === 'green' && p.alive), aliveR = this.players.some(p => p.path === 'red' && p.alive);
    const hasG = this.players.some(p => p.path === 'green'), hasR = this.players.some(p => p.path === 'red');
    if (hasG && hasR) {
      if (!aliveG && aliveR) return this.end('red', 'Alle groene kapiteins zijn uitgeschakeld.');
      if (!aliveR && aliveG) return this.end('green', 'Alle rode kapiteins zijn uitgeschakeld.');
    }
    if (!aliveG && !aliveR) return this.end(this.score.green >= this.score.red ? 'green' : 'red', 'Niemand heeft nog schepen.');
    if (S.timeLimit && this.t >= S.timeLimit * 60) return this.end(this.score.green >= this.score.red ? 'green' : 'red', 'De tijd is om — het Pad met de hoogste score wint.');
  }
  end(w, reason) {
    if (this.over) return;
    this.over = true; this.winner = w; this.reason = reason;
    this.ev({ k: 'over', w, reason });
  }

  // ---------- netwerk ----------
  snapshot(full) {
    const r = v => Math.round(v);
    const s = {
      t: Math.round(this.t * 100) / 100, over: this.over, winner: this.winner, reason: this.reason, paused: this.paused,
      score: this.score, counts: this.counts, pops: this.pops, taxLast: this.taxLast,
      players: this.players.map(p => ({
        id: p.id, name: p.name, human: p.human, path: p.path, empire: p.empire, design: p.design, octant: p.octant, home: p.home, alive: p.alive, respawn: p.respawn,
        x: r(p.x), z: r(p.z), hx: +p.hx.toFixed(3), hz: +p.hz.toFixed(3), speed: p.speed, tx: p.tx == null ? null : r(p.tx), tz: p.tz == null ? null : r(p.tz), tPlanet: p.tPlanet, orbit: p.orbit,
        energy: r(p.energy), charge: r(p.charge), cargo: r(p.cargo), shieldsOn: p.shieldsOn, shieldHeat: r(p.shieldHeat), items: p.items, slots: p.slots, sel: p.sel,
        credits: r(p.credits), loan: p.loan, invested: r(p.invested), colonists: r(p.colonists), tek: p.tek, plague: p.plague, mining: p.mining, stealth: p.stealth, stealthT: +p.stealthT.toFixed(2),
        scream: p.scream, warpArmed: p.warpArmed, wormArmed: p.wormArmed, sd: +p.sd.toFixed(1), kills: p.kills, deaths: p.deaths, autoshop: p.autoshop,
        visited: full ? p.visited : undefined, nVisited: p.visited.length,
      })),
      projs: this.projs.map(m => [m.id, m.type, r(m.x), r(m.z), r(m.vx), r(m.vz), m.armed ? 1 : 0, m.path]),
      drones: this.drones.map(d => [d.id, d.kind, r(d.x), r(d.z), d.path]),
      gates: this.gates.map(g => [g.id, r(g.ax), r(g.az), r(g.bx), r(g.bz), g.name]),
    };
    if (full) {
      s.planets = this.planets.map(pl => ({
        id: pl.id, name: pl.name, x: r(pl.x), z: r(pl.z), r: r(pl.r), oct: pl.oct, type: pl.type, tex: pl.tex, empire: pl.empire, pop: r(pl.pop), maxPop: r(pl.maxPop),
        ore: r(pl.ore), cash: r(pl.cash), love: r(pl.love), dev: roundObj(pl.dev, 3), cap: roundObj(pl.cap, 0), plague: +pl.plague.toFixed(3), distress: pl.distress,
        shields: +pl.shields.toFixed(1), stock: roundObj(pl.stock, 0, true), colonists: r(pl.colonists), spies: pl.spies, homeOf: pl.homeOf,
      }));
      s.history = this.history; s.colBonus = this.colBonus; s.settings = this.settings;
    }
    return s;
  }
}
function roundObj(o, d, floor) { const r = {}; const m = Math.pow(10, d); for (const k in o) r[k] = floor ? Math.floor(o[k]) : Math.round(o[k] * m) / m; return r; }

// hulpfuncties die de UI ook op client-snapshots kan gebruiken
WP.calc = {
  energyMax: p => EN_UNIT * (1 + (p.items.energypod || 0)),
  chargeMax: p => CH_UNIT * (1 + (p.items.chargepod || 0)),
  cargoMax: p => CARGO_UNIT * (p.items.cargopod || 0),
  freeSpeed: p => clamp(2 + (p.items.energypod || 0) - (p.shieldsOn && (p.items.shield || 0) > 0 && !p.stealth && !p.mining ? 1 : 0), 0, 10),
  devAvg: pl => { const d = pl.dev; return (d.mining + d.port + d.manu + d.agri + d.defense + d.edu) / 6; },
  devLevel: pl => pl.pop <= 0 ? 0 : Math.round(WP.calc.devAvg(pl) * 32000 + pl.pop / 40),
  aura: pl => pl.pop <= 0 ? 'white' : pl.love >= 300 ? 'green' : pl.love <= -300 ? 'red' : 'yellow',
  orePrice: pl => Math.round(clamp(2400000 / (pl.ore + 14000), 8, 260) * (1 - 0.5 * pl.dev.mining)),
  cost100: pl => 300000 + pl.pop * 6,
  loanLimit: p => Math.floor(p.invested * 0.5 / 100000) * 100000,
  itemAllowed: (S, it) => !((S.noPlague && it.id === 'plague') || (S.noPlagueCure && it.id === 'antiplague') || (S.noWarp && it.id === 'warp') || (S.noBarrier && it.id === 'barrier') || (S.noBuster && it.id === 'buster') || (S.noWorm && it.id === 'wormgate')),
  CARGO_UNIT, SPEED_UNIT,
};
WP.Sim = Sim;
})();
