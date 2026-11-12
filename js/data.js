// Warpath 2026 — speldata
// Gebaseerd op Warpath 21st Century / Warpath 97 van Dan Samuel, Synthetic Reality (www.synthetic-reality.com)
'use strict';
window.WP = window.WP || {};

WP.GALAXY_R = 12000;      // straal van de melkweg
WP.OCTANTS = 8;
WP.CORE_R = 1300;         // centrale kern (zwart gat) - geen planeten

WP.PATHS = {
  green: { name: 'Pad van Vrede', short: 'Groen', color: 0x3dff7a, css: '#3dff7a', sign: 1 },
  red:   { name: 'Pad van Oorlog', short: 'Rood', color: 0xff3b3b, css: '#ff3b3b', sign: -1 },
};

// 15 rijken (uit de originele atmosfeertabel), elk met een origineel portret
WP.EMPIRES = [
  { name: 'Human',   portrait: 1 }, { name: 'Tauran', portrait: 2 }, { name: 'Ditt',   portrait: 3 },
  { name: 'Klepton', portrait: 4 }, { name: 'Gnarf',  portrait: 5 }, { name: 'Gryll',  portrait: 6 },
  { name: 'Ynik',    portrait: 7 }, { name: 'Bjork',  portrait: 8 }, { name: 'Karg',   portrait: 9 },
  { name: 'Limmp',   portrait: 10 }, { name: 'Merp',  portrait: 11 }, { name: 'Nikk',   portrait: 12 },
  { name: 'Okre',    portrait: 13 }, { name: 'Panz',  portrait: 14 }, { name: 'Rull',   portrait: 15 },
];

WP.SHIP_DESIGNS = [
  { id: 0, name: 'Schotel' }, { id: 1, name: 'Lander' }, { id: 2, name: 'Kruiser X' },
  { id: 3, name: 'Pijl' }, { id: 4, name: 'Ringschip' }, { id: 5, name: 'Manta' },
];

// Wapenkracht (kJ op het doelpunt, onbeschermd) — uit "Relative Weapons Strength"
// Items — prijzen, maxima en productiesnelheid uit het originele tekreport.txt
// kind: weapon (projectiel, gebruikt slot), device (activeerbaar, gebruikt slot), passive (geen slot)
WP.ITEMS = [
  // TEK I
  { id: 'torpedo', name: 'Phased-Matter Torpedo', tek: 1, price: 110, maxP: 10000, maxS: 500, rate: 56888, dev: 600, kind: 'weapon', dmg: 1000, blast: 70, speed: 700, cost: 15,
    desc: 'De standaard torpedo. Vliegt naar het aangeklikte punt en ontploft. Ongeveer twee keer zo sterk als een volle laser.' },
  { id: 'shield', name: 'Defensive Shield Layer', tek: 1, price: 25000, maxP: 100, maxS: 5, rate: 2844, dev: 3000, kind: 'passive',
    desc: 'Elke schildlaag halveert de schade. 5 lagen = 32× sterker. Schilden worden heet en knappen als ze te veel incasseren. Met 5 lagen overleef je de energiebarrière.' },
  { id: 'cargopod', name: 'Cargo Pod', tek: 1, price: 22350, maxP: 10, maxS: 5, rate: 2133, dev: 750, kind: 'passive',
    desc: 'Extra laadruim voor 1000 ton erts, inclusief mijnstraal. Meer pods = meer winst per handelsreis. Koop deze als eerste!' },
  { id: 'energypod', name: 'Energy Pod', tek: 1, price: 37500, maxP: 10, maxS: 5, rate: 2133, dev: 600, kind: 'passive',
    desc: 'Extra energie (levensduur en bereik). Elke pod laat je ook één snelheidsstap harder vliegen zonder energieverbruik.' },
  { id: 'chargepod', name: 'Charge Pod', tek: 1, price: 12500, maxP: 10, maxS: 5, rate: 2133, dev: 600, kind: 'passive',
    desc: 'Extra lading voor lasers, wapenlanceerders, warp en stealth.' },
  { id: 'guide', name: 'Planetary Guide', tek: 1, price: 25000, maxP: 100, maxS: 1, rate: 711, dev: 6000, kind: 'passive',
    desc: 'Houdt live de gegevens bij van alle bezochte planeten (prijzen, erts, liefde) en laat je koers zetten naar elke planeet.' },
  { id: 'hull', name: 'Spare Ship Hull', tek: 1, price: 3000000, maxP: 2, maxS: 9, rate: 71, dev: 15000, kind: 'passive',
    desc: 'Een reserveschip op je thuisplaneet. Als je schip ontploft krijg je een nieuw schip.' },
  { id: 'laser', name: 'Standard Ship Laser', tek: 1, price: 10000, maxP: 4, maxS: 1, rate: 2133, dev: 1500, kind: 'weapon', dmg: 500, blast: 50, cost: 120, beam: true,
    desc: 'Onbeperkt bruikbaar, maar kost lading. Bereik en kracht hangen af van je lading.' },
  // TEK II
  { id: 'mine', name: 'Plasma Mine', tek: 2, price: 230, maxP: 1000, maxS: 250, rate: 19200, dev: 1500, kind: 'weapon', dmg: 2000, blast: 90, speed: 500, cost: 25,
    desc: 'Nabijheidsmijn. Wordt scherp op het doelpunt en ontploft als er een schip langs komt — vriend én vijand (ook jijzelf!).' },
  { id: 'autominer', name: 'Auto-Miner', tek: 2, price: 10000, maxP: 4, maxS: 1, rate: 711, dev: 15000, kind: 'passive',
    desc: 'Je mijnstraal blijft aan tot al je pods vol zijn. Let op: al die tijd staan je schilden uit.' },
  // TEK III
  { id: 'plasma', name: 'Hot-Plasma Missile', tek: 3, price: 1000, maxP: 250, maxS: 100, rate: 4977, dev: 7500, kind: 'weapon', dmg: 4000, blast: 85, speed: 650, cost: 40,
    desc: 'Variant op de torpedo met vier keer de klap. Volgens Dangerdav de beste koop.' },
  { id: 'antiplague', name: 'Anti-Plague Beam', tek: 3, price: 27000, maxP: 10, maxS: 25, rate: 284, dev: 15000, kind: 'device', cost: 60,
    desc: 'Steriliseert alle besmette planeten in de buurt en je eigen schip. Elke activering kost één antistof-kristal.' },
  { id: 'spy', name: 'Planetary Spies', tek: 3, price: 10000, maxP: 100, maxS: 25, rate: 711, dev: 15000, kind: 'weapon', planetOnly: true, speed: 600, cost: 20,
    desc: 'Schiet op een planeet: daarna zie je vijandelijke schepen rond die planeet op je kaart. Spionnen sterven bij de kleinste aanval.' },
  // TEK IV
  { id: 'plague', name: 'Plague Bomb', tek: 4, price: 200000, maxP: 5, maxS: 25, rate: 497, dev: 29000, kind: 'weapon', planetOnly: true, speed: 550, cost: 40,
    desc: 'Besmet ~10% van de bevolking. De plaag verspreidt zich op de planeet én via schepen die er in een baan komen. Verschrikkelijk.' },
  { id: 'raiders', name: 'Planetary Raiders', tek: 4, price: 30000, maxP: 100, maxS: 25, rate: 711, dev: 15000, kind: 'weapon', planetOnly: true, speed: 600, cost: 20,
    desc: 'Huurlingen die de verdediging en schilden van een planeet afbreken, zodat jouw aanval beter werkt.' },
  // TEK V
  { id: 'neutron', name: 'Neutron Bomb', tek: 5, price: 100000, maxP: 10, maxS: 25, rate: 497, dev: 29000, kind: 'weapon', dmg: 32000, blast: 220, speed: 450, cost: 150, shake: true,
    desc: 'Vernietigt een groot deel van het leven op een planeet. Ook effectief tegen de plaag... en tegen jezelf als je te dichtbij richt.' },
  // TEK VI
  { id: 'stealth', name: 'Stealth Invisibility Shield', tek: 6, price: 53000, maxP: 5, maxS: 1, rate: 284, dev: 15000, kind: 'device',
    desc: 'Maakt je onzichtbaar, maar schakelt schilden en wapens uit en kost continu lading. Bij aan/uit zet je even helemaal onbeschermd.' },
  { id: 'seeker', name: 'Hunter-Seeker Torpedo', tek: 6, price: 20000, maxP: 20, maxS: 25, rate: 355, dev: 15000, kind: 'weapon', dmg: 16000, blast: 80, speed: 620, cost: 50, homing: true,
    desc: 'Klik op een vijandelijk schip: de seeker jaagt het op en ontploft bij contact. Wacht als het doel onzichtbaar wordt.' },
  { id: 'wormgate', name: 'Worm Gate Pair', tek: 6, price: 250000, maxP: 10, maxS: 5, rate: 284, dev: 15000, kind: 'device',
    desc: 'Activeer en klik op de sterrenkaart: er ontstaat een wormgat tussen jouw positie en dat punt. Iedereen kan het gebruiken!' },
  // TEK VII
  { id: 'scream', name: 'Sonic Scream Shield Disrupter', tek: 7, price: 147000, maxP: 10, maxS: 1, rate: 284, dev: 15000, kind: 'device',
    desc: 'Halveert alle schilden in de buurt — ook die van jezelf en van planeten. Kost continu lading.' },
  { id: 'slaves', name: 'Android Slave Ship', tek: 7, price: 20000, maxP: 100, maxS: 25, rate: 142, dev: 15000, kind: 'device',
    desc: 'Lanceer een android-gunboat die bij je blijft en iedereen aanvalt die jou beschadigt.' },
  // TEK VIII
  { id: 'warp', name: 'Warp Jump Drive', tek: 8, price: 3000000, maxP: 2, maxS: 1, rate: 71, dev: 15000, kind: 'device',
    desc: 'Activeer en klik op de sterrenkaart (of gebruik de gids) om direct te springen. Kost veel lading.' },
  { id: 'selfdestruct', name: 'Self-Destruct Trigger', tek: 8, price: 5000, maxP: 20, maxS: 1, rate: 142, dev: 15000, kind: 'device',
    desc: 'Aftellen van 5 seconden (nogmaals klikken = annuleren), daarna ontploft je schip met de kracht van een Buster Bomb.' },
  // TEK IX
  { id: 'barrier', name: 'Energy Barrier Shield', tek: 9, price: 1000000, maxP: 10, maxS: 1, rate: 213, dev: 15000, kind: 'passive',
    desc: 'Laat je zonder schade door de energiebarrières tussen de octanten vliegen.' },
  // TEK X
  { id: 'buster', name: 'Quark Buster Bomb', tek: 10, price: 2000000, maxP: 2, maxS: 4, rate: 14, dev: 29000, kind: 'weapon', dmg: 320000, blast: 400, speed: 400, cost: 400, shake: true,
    desc: 'Kan een planeet in één schot vernietigen. Blijf ver weg!' },
  { id: 'escape', name: 'Escape Teleporter', tek: 10, price: 50000, maxP: 20, maxS: 1, rate: 142, dev: 15000, kind: 'device',
    desc: 'De "chicken switch": teleporteert je direct naar je thuisplaneet.' },
];
WP.ITEM = {}; WP.ITEMS.forEach(it => WP.ITEM[it.id] = it);
WP.MAX_SLOTS = 7;

// investeringscategorieën
WP.INVEST = [
  { id: 'mining', name: 'Mijnbouw', icon: 'mining', desc: 'Planeet haalt zelf erts uit de diepe korst → zelfvoorzienend (maar betaalt minder voor jouw erts).' },
  { id: 'port', name: 'Ruimtehaven', icon: 'port', desc: 'Hoe ver deze planeet je energie kan bijvullen. 100% = altijd volledig opladen.' },
  { id: 'manu', name: 'Industrie', icon: 'factory', desc: 'Sneller winkelvoorraad aanvullen en planetaire schilden bouwen.' },
  { id: 'agri', name: 'Landbouw', icon: 'garden', desc: 'Hogere maximale bevolking → meer belasting.' },
  { id: 'defense', name: 'Defensie', icon: 'house', desc: 'Planeet verdedigt zich met drones, torpedo\'s en schilden.' },
  { id: 'edu', name: 'Onderwijs', icon: 'school', desc: 'Hoger ontwikkelingsniveau → complexere producten in de winkel en meer belasting.' },
];

WP.MAPS = {
  normal: { name: 'Normaal', desc: '1 thuisplaneet, 7 gele en 8 onbewoonde planeten per octant.' },
  empty:  { name: 'Leeg', desc: '1 thuisplaneet en 15 onbewoonde planeten. Koloniseren of sterven.' },
  dense:  { name: 'Dicht', desc: '1 thuisplaneet en 15 gele planeten. Alles draait om investeren.' },
  power:  { name: 'Power', desc: '16 volledig ontwikkelde planeten per speler. Eén groot gevecht.' },
};
WP.AI_LEVELS = ['Kanonnenvoer', 'Makkelijk', 'Normaal', 'Moeilijk', 'Krankzinnig'];

WP.DEFAULT_SETTINGS = () => ({
  map: 'normal', aiLevel: 2, bots: 3, cash: 100000, tek: 1, timeLimit: 30,
  barrierDamage: true, deadLosesItems: false, enemyPOV: false, quickROI: true,
  noWorm: false, noPlague: false, noPlagueCure: false, noWarp: false, noBarrier: false, noBuster: false, noPause: true,
  botPaths: [],
});

// planeetnamen generator
WP.makeName = (rnd) => {
  const a = ['Qwa','Zor','Bel','Tri','Xan','Ul','Mor','Kae','Vy','Os','Prax','Ny','Eld','Quo','Jy','Fen','Gal','Ro','Sib','Tey','Wum','Ix','Dra','Ple','Ark','Zim','Lu','Cor','Hav','Ob'];
  const b = ['ak','ory','ani','eth','ul','opa','yx','ine','arr','ion','eus','ix','ova','ur','ade','emi','oth','ia','um','esh'];
  const c = ['','','',' IV',' II','i','yi',' Prime','os','a',' VII','ax'];
  return a[Math.floor(rnd()*a.length)] + b[Math.floor(rnd()*b.length)] + c[Math.floor(rnd()*c.length)];
};

WP.BOT_NAMES = ['Turtle','Dangerdav','Marvin','Zorblax','Kwibus','Hal-9','Mrs. Plague','Baron Ore','Kapitein Krul','Glorbo','Sputnik','Nebulina'];

// seeded RNG
WP.rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};

WP.fmt = (n) => {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace('.', ',') + ' mln';
  return n.toLocaleString('nl-NL');
};
WP.octantOf = (x, z) => {
  let a = Math.atan2(z, x); if (a < 0) a += Math.PI * 2;
  return Math.floor(a / (Math.PI * 2 / WP.OCTANTS)) % WP.OCTANTS;
};
WP.TEK_ROMAN = ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X'];
