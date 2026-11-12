// Warpath 2026 — synthetische tegenstanders ("ze spelen een beetje vals: ze kennen alle planeten")
'use strict';
(function () {
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);
const TAUNTS = {
  red: ['Jouw planeten zien er zo... bewoond uit.', 'Ik ruik plaag in de lucht. Of ben jij dat?', 'Het Pad van Oorlog wacht op niemand!', 'Mooie kolonie. Zou zonde zijn als er iets mee gebeurde.', 'Hot Plasma Missiles: de beste koop van de melkweg.'],
  green: ['Belasting, kapitein. BELASTING is de sleutel.', 'Vrede is een uitstekende investering.', 'Mijn planeten houden van mij. De jouwe twijfelen.', 'Ik ben de Schildpad, jij de Haas. Niet gaan slapen!', 'Nog één investering en die gele planeet is van mij.'],
};

const AI = {
  think(sim, p, dt) {
    const ai = p.ai;
    if (p.respawn > 0 || sim.over) return;
    const L = ai.level;
    ai.t -= dt; ai.fireT = (ai.fireT || 0) - dt; ai.tauntT = (ai.tauntT == null ? 40 + Math.random() * 80 : ai.tauntT - dt);
    if (ai.tauntT <= 0) {
      ai.tauntT = 70 + Math.random() * 120;
      const list = TAUNTS[p.path];
      sim.chat(p, list[Math.floor(Math.random() * list.length)], false);
    }
    this.combat(sim, p, dt);
    if (ai.t > 0) return;
    ai.t = 0.8 + (4 - L) * 0.25;
    this.decide(sim, p);
  },

  canReach(sim, p, x, z) {
    if (!sim.settings.barrierDamage || p.items.barrier) return true;
    if (WP.octantOf(x, z) === WP.octantOf(p.x, p.z)) return true;
    return (p.items.shield || 0) >= 5 && p.energy > sim.energyMax(p) * 0.6;
  },

  enemyNear(sim, p, range) {
    let best = null, bd = range * range;
    for (const q of sim.players) {
      if (q === p || !q.alive || q.respawn > 0 || q.path === p.path || q.stealth) continue;
      const d = d2(p, q); if (d < bd) { bd = d; best = q; }
    }
    return best;
  },

  pickWeapon(p, vsPlanet) {
    const order = vsPlanet ? ['buster', 'neutron', 'plasma', 'torpedo', 'laser'] : ['seeker', 'plasma', 'torpedo', 'laser'];
    for (const id of order) {
      const s = p.slots.indexOf(id);
      if (s >= 0 && (WP.ITEM[id].beam || p.items[id] > 0)) return s;
    }
    return -1;
  },

  combat(sim, p, dt) {
    const ai = p.ai, L = ai.level;
    const t = this.enemyNear(sim, p, 1300 + L * 250);
    ai.enemy = t ? t.id : null;
    if (L === 0 && Math.random() < 0.7) return;
    if (p.mining || p.stealth) return;
    if (t && ai.fireT <= 0 && p.cd <= 0) {
      const s = this.pickWeapon(p, false);
      if (s < 0) return;
      const id = p.slots[s], it = WP.ITEM[id];
      const d = Math.sqrt(d2(p, t));
      if (it.beam && d > 700 + 1500 * p.charge / sim.chargeMax(p)) return;
      const sp = it.speed || 1e9, lead = d / sp * (L >= 2 ? 1 : 0.5);
      const v = t.orbit ? 0 : t.speed * WP.calc.SPEED_UNIT;
      const err = (4 - L) * 70;
      const x = t.x + t.hx * v * lead + (Math.random() - 0.5) * err, z = t.z + t.hz * v * lead + (Math.random() - 0.5) * err;
      if (p.sel !== s) sim.command(p.id, { c: 'sel', slot: s });
      // niet op jezelf schieten
      if (Math.hypot(x - p.x, z - p.z) < (it.blast || 60) * 2.2) return;
      sim.command(p.id, { c: 'fire', x, z, tid: t.id });
      ai.fireT = [2.2, 1.5, 0.9, 0.55, 0.35][L] * (0.7 + Math.random() * 0.6);
    }
    // aanvallen van vijandelijke planeten
    if (!t && ai.goal && ai.goal.type === 'attack') {
      const pl = sim.planetById(ai.goal.id);
      if (pl && pl.pop > 0 && sim.hostile(pl, p)) {
        const d = Math.sqrt(d2(p, pl));
        if (d < 1100 && ai.fireT <= 0 && p.cd <= 0) {
          const s = this.pickWeapon(p, true); if (s < 0) return;
          if (p.sel !== s) sim.command(p.id, { c: 'sel', slot: s });
          const it = WP.ITEM[p.slots[s]];
          if (d < (it.blast || 60) * 3 + pl.r) { sim.command(p.id, { c: 'reverse' }); return; }
          sim.command(p.id, { c: 'fire', x: pl.x, z: pl.z });
          ai.fireT = 1.2 + Math.random();
        }
      }
    }
  },

  go(sim, p, goal) {
    p.ai.goal = goal;
    if (goal.type === 'point') sim.command(p.id, { c: 'course', x: goal.x, z: goal.z });
    else sim.command(p.id, { c: 'orbitPlanet', id: goal.id });
    const want = Math.min(10, sim.freeSpeed(p) + (p.energy > sim.energyMax(p) * 0.5 ? 2 : 0));
    p.speed = Math.max(1, want);
  },

  decide(sim, p) {
    const ai = p.ai, L = ai.level;
    const em = sim.energyMax(p);
    const enemy = ai.enemy ? sim.player(ai.enemy) : null;
    // vluchten / vechten
    if (enemy) {
      const brave = (p.path === 'red' ? 1 : 0) + L * 0.5 + (p.items.shield || 0) * 0.3 > 2.2;
      if (p.energy < em * 0.35 || !brave) {
        const safe = this.nearestOwn(sim, p);
        if (safe && p.orbit !== safe.id && ai.goal?.id !== safe.id) this.go(sim, p, { type: 'planet', id: safe.id, why: 'flee' });
        return;
      }
      if (!p.orbit || p.mining) {
        if (p.mining) { sim.command(p.id, { c: 'mine' }); }
        if (!this.canReach(sim, p, enemy.x, enemy.z)) { ai.enemy = null; return this.chooseGoal(sim, p); }
        const a = Math.atan2(p.z - enemy.z, p.x - enemy.x) + 0.9;
        sim.command(p.id, { c: 'course', x: enemy.x + Math.cos(a) * 650, z: enemy.z + Math.sin(a) * 650 });
        p.speed = Math.min(10, sim.freeSpeed(p) + 2);
        ai.goal = { type: 'fight' };
        return;
      }
    }
    // onder vuur (drones/planeten) en zwak: wegwezen
    if (sim.t - p.lastHitT < 3 && (p.mining || p.energy < em * 0.5)) {
      if (p.mining) sim.command(p.id, { c: 'mine' });
      const safe = this.nearestOwn(sim, p);
      if (safe && p.orbit !== safe.id) return this.go(sim, p, { type: 'planet', id: safe.id, why: 'flee' });
    }
    if (p.energy < em * 0.3 && !(p.orbit && sim.aura(sim.planetById(p.orbit)) === p.path)) {
      const safe = this.nearestOwn(sim, p);
      if (safe) return this.go(sim, p, { type: 'planet', id: safe.id, why: 'refuel' });
    }
    if (p.orbit) return this.inOrbit(sim, p, sim.planetById(p.orbit));
    // onderweg: doel nog geldig?
    if (ai.goal && (p.tPlanet || p.tx != null)) return;
    this.chooseGoal(sim, p);
  },

  dangerous(sim, p, pl) {
    for (const q of sim.planets) if (sim.hostile(q, p) && (q.x - pl.x) ** 2 + (q.z - pl.z) ** 2 < 2400 * 2400) return true;
    return false;
  },

  nearestOwn(sim, p) {
    let best = null, bd = 1e18;
    for (const pl of sim.planets) if (sim.aura(pl) === p.path) { const d = d2(p, pl); if (d < bd && this.canReach(sim, p, pl.x, pl.z)) { bd = d; best = pl; } }
    return best || sim.planetById(p.home);
  },

  inOrbit(sim, p, pl) {
    const ai = p.ai;
    if (!pl) return;
    const cm = sim.cargoMax(p);
    if (pl.pop <= 0) {
      if (p.colonists >= 200 && (pl.ore < 4000 || ai.goal?.why === 'colonize' || Math.random() < 0.15)) { sim.command(p.id, { c: 'colonize' }); return; }
      if (p.mining) return;
      if (pl.ore > 50 && p.cargo < cm - 5) { sim.command(p.id, { c: 'mine' }); return; }
      return this.chooseGoal(sim, p);
    }
    if (sim.friendly(pl, p)) {
      if (p.cargo > 0) sim.command(p.id, { c: 'sell', all: true });
      if (p.colonists >= 200 && pl.empire === p.empire && pl.pop < 8000) sim.command(p.id, { c: 'colonize' });
      this.shop(sim, p, pl);
      if (p.loan > 0) sim.command(p.id, { c: 'repay' });
      const reserve = 60000 + p.ai.level * 20000;
      if (p.credits > reserve + 30000 && pl.dev) {
        const cats = ['agri', 'port', 'defense', 'manu', 'edu', 'mining'];
        const order = sim.aura(pl) === 'yellow' ? ['agri', 'edu', 'port', 'defense', 'manu'] : cats;
        const cat = order.find(c => pl.dev[c] + pl.cap[c] / sim.cost100(pl) < 0.95);
        if (cat) sim.command(p.id, { c: 'invest', cat, amt: Math.min(p.credits - reserve, sim.cost100(pl) * 0.5) });
      }
    }
    if (sim.aura(pl) === p.path && p.energy < sim.energyMax(p) * (0.25 + 0.75 * pl.dev.port) * 0.97) return; // even bijtanken
    this.chooseGoal(sim, p);
  },

  shop(sim, p, pl) {
    const list = sim.shopList(p, pl).map(i => i.id);
    const want = [['cargopod', 5], ['energypod', 3], ['shield', 3], ['chargepod', 2], ['torpedo', 80], ['energypod', 5], ['shield', 5], ['plasma', 40], ['autominer', 1], ['chargepod', 4], ['mine', 30],
      ['seeker', 6], ['neutron', 4], ['barrier', 1], ['stealth', 1], ['warp', 1]];
    for (const [id, n] of want) {
      if (!list.includes(id)) continue;
      const have = p.items[id] || 0; if (have >= n) continue;
      const it = WP.ITEM[id];
      if (it.price * (n - have) > p.credits * (id === 'cargopod' || id === 'shield' ? 1 : 0.5)) continue;
      sim.command(p.id, { c: 'buy', item: id, n: n - have });
      if ((it.kind === 'weapon' || it.kind === 'device') && !p.slots.includes(id)) {
        const free = p.slots.indexOf(null);
        const slot = free >= 0 ? free : p.slots.findIndex(s => s === 'mine' || s === 'torpedo');
        if (slot >= 0 && id !== 'stealth' && id !== 'warp') sim.command(p.id, { c: 'equip', slot, item: id });
      }
    }
  },

  chooseGoal(sim, p) {
    const ai = p.ai, L = ai.level, cm = sim.cargoMax(p);
    const R = (pl) => this.canReach(sim, p, pl.x, pl.z);
    const score = (pl, v) => v / (Math.sqrt(d2(p, pl)) + 1500);
    let best = null, bs = 0;
    const consider = (pl, v, why) => { if (!R(pl)) return; const s = score(pl, v); if (s > bs) { bs = s; best = { type: 'planet', id: pl.id, why }; } };
    for (const pl of sim.planets) {
      const a = sim.aura(pl);
      if (pl.distress && a === p.path) consider(pl, 3000 + 600 * L, 'distress');
      if (p.cargo > cm * 0.5 && pl.pop > 0 && (a === 'yellow' || a === p.path)) {
        const price = sim.orePrice(pl), tons = Math.min(p.cargo, pl.cash / price);
        consider(pl, price * tons / 30, 'sell');
      }
      if (p.cargo < cm * 0.9 && a === 'white' && pl.ore > 400 && !this.dangerous(sim, p, pl)) consider(pl, Math.min(pl.ore, cm - p.cargo) * 0.9 + 300, 'mine');
      if (p.colonists >= 200 && a === 'white' && !this.dangerous(sim, p, pl)) consider(pl, 1200 + (pl.ore < 4000 ? 1500 : 0), 'colonize');
      if (p.credits > 250000 && a === 'yellow') consider(pl, pl.pop / 30 * (1 + Math.abs(pl.love) / 300), 'invest');
      if (p.credits > 250000 && a === p.path && sim.devAvg(pl) < 0.5) consider(pl, pl.pop / 60, 'invest');
      if (L >= 2 && a !== 'white' && a !== 'yellow' && a !== p.path) {
        const fire = (p.items.plasma || 0) * 4000 + (p.items.neutron || 0) * 32000 + (p.items.buster || 0) * 1e6;
        const aggr = (p.path === 'red' ? 2 : 0.6) * (L - 1);
        if (fire > 60000 && (p.items.shield || 0) >= 3) consider(pl, aggr * 900 / (1 + pl.shields), 'attack');
      }
      if (p.energy < sim.energyMax(p) * 0.6 && a === p.path) consider(pl, 1000, 'refuel');
    }
    if (best) {
      const pl = sim.planetById(best.id);
      if (best.why === 'attack') {
        const a = Math.atan2(p.z - pl.z, p.x - pl.x);
        best = { type: 'attack', id: pl.id };
        sim.command(p.id, { c: 'course', x: pl.x + Math.cos(a) * (pl.r + 700), z: pl.z + Math.sin(a) * (pl.r + 700) });
        p.speed = Math.max(1, sim.freeSpeed(p)); ai.goal = best;
        return;
      }
      return this.go(sim, p, best);
    }
    // verkennen
    const a = Math.random() * Math.PI * 2, r = 2500 + Math.random() * 8000;
    const oct = WP.octantOf(p.x, p.z), wa = (oct + 0.2 + Math.random() * 0.6) * Math.PI / 4;
    this.go(sim, p, { type: 'point', x: Math.cos(wa) * r, z: Math.sin(wa) * r });
  },
};
WP.AI = AI;
})();
