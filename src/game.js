// HexCiv v6, Regrow: a place-and-transform puzzle on the ruined Verdant Reach. There are no workers and no clock.
// You spend leaves to place restorers; each one changes the hexes around it the moment it lands, and every hex it
// heals pays leaves back. Wind pumps loosen dust and clear debris and power sprinklers; sprinklers turn bare ground
// to grass; tree planters turn watered grass to forest; scrubbers burn back rot; reed filters clean the river; a
// water gate heals the marsh; opening the old dam refills the dry riverbed. Meet the four goals, then recycle every
// restorer to leave the valley as if no one had been there. v1 to v5 are in archive/.
(() => {
  const X = buildHexTiles(), B = X.BIOMES, C = X.C;

  // ---------- the restorers ----------
  // cost in leaves; `on` says where it may stand, `need` what must be near it. PAY is what each healed hex pays back.
  const PAY = { loosen: 1, clear: 1, scrub: 1, grass: 1, forest: 2, river: 2, marsh: 2 };
  const TOOLS = {
    pump: { name: 'Wind pump', cost: 4, range: 1,
      text: 'Loosens dust and clears dead trees and stumps on the hexes around it. Powers sprinklers within 2 hexes.',
      on: (t) => isLand(t) && t.st !== 'rot' && t.st !== 'forest' },
    sprinkler: { name: 'Sprinkler', cost: 6, range: 1,
      text: 'Waters the hexes around it: bare ground turns to grass. Needs a wind pump within 2 hexes.',
      on: (t) => isLand(t) && (t.st === 'bare' || t.st === 'grass') && !t.debris,
      need: (t) => (near(t, 2, (n) => n.b === 'pump') ? '' : 'Needs power: place it within 2 hexes of a wind pump.') },
    planter: { name: 'Tree planter', cost: 8, range: 1,
      text: 'Plants trees on the grass around it. Needs water within 2 hexes: a sprinkler, clean river, pond or healed marsh.',
      on: (t) => isLand(t) && t.st === 'grass',
      need: (t) => (near(t, 2, wetSource) ? '' : 'Needs water: place it within 2 hexes of a sprinkler, clean river, pond or healed marsh.') },
    scrubber: { name: 'Scrubber', cost: 6, range: 1,
      text: 'Burns back the rot on the hexes around it, leaving dust (or a dirty river).',
      on: (t) => (isLand(t) && t.st !== 'rot' && t.st !== 'forest') || t.kind === 'mine',
      need: (t) => (near(t, 1, (n) => n.st === 'rot') ? '' : 'There is no rot next to this hex.') },
    filter: { name: 'Reed filter', cost: 8, range: 1,
      text: 'Built on a dirty river: cleans the river around it, and the clean water turns bare ground beside it to grass.',
      on: (t) => t.kind === 'river' && t.river === 'dirty' && t.st !== 'rot' },
    gate: { name: 'Water gate', cost: 10, range: 1,
      text: 'Built on a drained marsh: blocks the old ditches so the marsh around it fills and heals.',
      on: (t) => t.kind === 'marsh' && t.marsh === 'drained' },
    dam: { name: 'Open the dam', cost: 12, range: 0, once: true,
      text: 'Breaks the settlers\' mill dam. The dry riverbed fills with water again, and bare ground beside it turns to grass.',
      on: (t) => t.kind === 'river' && t.river === 'dam' },
  };
  const ORDER = ['pump', 'sprinkler', 'planter', 'scrubber', 'filter', 'gate', 'dam'];
  const START_LEAVES = 10;

  // ---------- the ruined Verdant Reach ----------
  // LAND is what each tile was before the settlers; DAMAGE is what they left. '.' means the tile is still alive.
  const KEY = { g: 'grass', m: 'meadow', o: 'grove', p: 'pines', f: 'forest', w: 'pond', l: 'lake', r: 'rocks', h: 'hills',
    s: 'swamp', v: 'river', n: 'mountains', b: 'beach' };
  const LAND = [
    'nnnnnnhhnnrhhnnn',
    'nffvffhgghhrhnnn',
    'fffvfpgmmghhrhnn',
    'fpfvpgmmgmghhhrn',
    'pfppvmmgmmgghghh',
    'ppogvvmgwmmggssh',
    'opgmovgmgmgmssss',
    'goggmgvmgppgssss',
    'ogpggmvvppwbssss',
    'gggbbbggvbbllssb',
    'llllllllllllllll',
  ];
  const DAMAGE = [ // K mine, D deadwood, S stumps, U dust, B bare, R dirty river, Y dry riverbed, A dam, M drained marsh
    '...K............',
    '.SSRSS.UU.......',
    'SSSRDDUUUU......',
    'SDSADUUUUUB.....',
    'DSSDYUUBUUBB.B..',
    'SDDBYYUBUUUBBMM.',
    'DSBUDYBUBUBUMMMM',
    'BDBBUBRUBSSBMMMM',
    'DBSBBUR..D..MMMM',
    'BBB...BB.....MM.',
    '................',
  ];
  const RIVER = [[3, 1], [3, 2], [3, 3], [4, 4], [4, 5], [5, 5], [5, 6], [6, 7], [6, 8], [7, 8], [8, 9]];
  const ROT_START = [[3, 0], [3, 1], [3, 2], [3, 3], [4, 4], [4, 5], [5, 5], [5, 6]];
  const HOUSE = '8,3';
  const SCENERY = new Set(['mountains', 'hills', 'rocks']);
  const TREES = new Set(['pines', 'forest', 'grove']);

  const key = (c, r) => `${c},${r}`;
  const cells = LAND.flatMap((row, r) => [...row].map((ch, c) => ({ c, r, b0: KEY[ch], d0: DAMAGE[r][c] })));
  const byKey = new Map(cells.map((t) => [key(t.c, t.r), t]));
  const get = (c, r) => byKey.get(key(c, r));
  const center = (t) => { const p = X.at(t.c, t.r); return { x: p.x + 16, y: p.y + X.FY + 14 }; };
  const cube = (t) => { const x = t.c, z = t.r - (t.c - (t.c & 1)) / 2; return [x, -x - z, z]; };
  const dist = (a, b) => { const p = cube(a), q = cube(b); return Math.max(...p.map((v, i) => Math.abs(v - q[i]))); };
  const NBS = new Map(cells.map((t) => [t, X.NB(t.c, t.r).map(([c, r]) => get(c, r)).filter(Boolean)]));
  const nbs = (t) => NBS.get(t);
  const area = (t, r) => cells.filter((n) => dist(n, t) <= r);
  const near = (t, r, f) => cells.some((n) => n !== t && dist(n, t) <= r && f(n));
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  function kindOf(t) {
    if (t.d0 === 'K') return 'mine';
    if (t.b0 === 'river') return 'river';
    if (t.b0 === 'swamp') return 'marsh';
    if (t.b0 === 'lake' || t.b0 === 'pond' || t.b0 === 'beach') return t.b0;
    if (SCENERY.has(t.b0)) return 'scenery';
    return 'land';
  }
  cells.forEach((t) => { t.kind = kindOf(t); });
  const isLand = (t) => t.kind === 'land';
  const wetSource = (n) => n.b === 'sprinkler' || ['pond', 'lake', 'beach'].includes(n.kind) || (n.kind === 'river' && n.river === 'clean' && n.st !== 'rot') || (n.kind === 'marsh' && n.marsh === 'healed');

  // ---------- state ----------
  // A land hex is one step on a ladder: rot, dust, bare (maybe with dead trees or stumps), grass, forest.
  let S;
  function freshCell(t) {
    Object.assign(t, { st: null, debris: null, river: null, marsh: null, b: null, wild: null });
    if (t.kind === 'river') t.river = { R: 'dirty', Y: 'dry', A: 'dam' }[t.d0] || 'clean';
    if (t.kind === 'marsh') t.marsh = t.d0 === 'M' ? 'drained' : 'healed';
    if (isLand(t)) {
      const d = t.d0;
      if (d === 'D') Object.assign(t, { st: 'bare', debris: 'dead' });
      else if (d === 'S') Object.assign(t, { st: 'bare', debris: 'stumps' });
      else if (d === 'U') t.st = 'dust';
      else if (d === 'B') t.st = 'bare';
      else Object.assign(t, { st: TREES.has(t.b0) ? 'forest' : 'grass', wild: t.b0 === 'pond' ? 'grass' : t.b0 });
    }
  }
  function fresh() {
    cells.forEach(freshCell);
    ROT_START.forEach(([c, r]) => { get(c, r).st = 'rot'; });
    S = { leaves: START_LEAVES, placed: 0, built: 0, undo: [], done: false, started: false };
    dirty = true;
  }
  const CELL_KEYS = ['st', 'debris', 'river', 'marsh', 'b'];
  const snap = () => ({ leaves: S.leaves, placed: S.placed, built: S.built, cells: cells.map((t) => CELL_KEYS.map((k) => t[k])) });
  function restore(d) { cells.forEach((t, i) => CELL_KEYS.forEach((k, j) => { t[k] = d.cells[i][j]; })); S.leaves = d.leaves; S.placed = d.placed; S.built = d.built || 0; dirty = true; }
  const SAVE = 'hexciv-v6-save';
  function save() { if (!S || !S.started) return; try { localStorage.setItem(SAVE, JSON.stringify({ ...snap(), undo: S.undo.slice(-30), done: S.done })); } catch (e) { /* no storage: it still plays */ } }
  function loadSave() { try { const v = localStorage.getItem(SAVE); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function load(d) { cells.forEach(freshCell); S = { undo: d.undo || [], done: !!d.done, started: true }; restore(d); }

  // ---------- placing ----------
  function nameOf(t) {
    if (t.b) return TOOLS[t.b].name;
    switch (t.kind) {
      case 'mine': return 'Leaking mine';
      case 'river': return t.st === 'rot' ? 'Rotten river' : { clean: 'River', dirty: 'Dirty river', dry: 'Dry riverbed', dam: 'Old dam' }[t.river];
      case 'marsh': return { drained: 'Drained marsh', healed: 'Marsh' }[t.marsh];
      case 'land': break;
      default: return B[t.b0].name;
    }
    if (t.st === 'rot') return 'Rot';
    if (t.st === 'dust') return 'Dust';
    if (t.debris === 'dead') return 'Deadwood';
    if (t.debris === 'stumps') return 'Stump field';
    if (t.st === 'bare') return 'Bare ground';
    if (t.st === 'forest') return { pines: 'Pine stand', grove: 'Oak grove', forest: 'Old forest' }[t.wild] || 'Young forest';
    return t.wild === 'meadow' ? 'Meadow' : 'Grassland';
  }
  const WHERE = { pump: 'A wind pump stands on land that is not rot or forest.', sprinkler: 'A sprinkler stands on clear bare ground or grass.', planter: 'A tree planter stands on grass.',
    scrubber: 'A scrubber stands on land that is not rot or forest.', filter: 'A reed filter is built on a dirty river.', gate: 'A water gate is built on a drained marsh.', dam: 'Only the old dam can be opened.' };
  // water reaching bare ground beside it turns it to grass
  const wetted = (water, out) => cells.forEach((n) => { if (isLand(n) && n.st === 'bare' && !n.debris && water.some((w) => nbs(w).includes(n)) && !out.some((o) => o[0] === n)) out.push([n, 'grass']); });
  // What one tool would do here: [hex, change] for every hex it touches and the leaves they pay, or why it can't go here.
  function effects(id, t) {
    const k = TOOLS[id], out = [];
    if (!t || t.b) return { why: t && t.b ? 'Something is already built here.' : '' };
    if (!k.on(t)) return { why: WHERE[id] };
    const why = k.need ? k.need(t) : '';
    if (why) return { why };
    const land = area(t, k.range);
    if (id === 'pump') land.forEach((n) => { if (isLand(n) && n.st === 'dust') out.push([n, 'loosen']); else if (isLand(n) && n.debris) out.push([n, 'clear']); });
    if (id === 'sprinkler') land.forEach((n) => { if (isLand(n) && n.st === 'bare' && !n.debris) out.push([n, 'grass']); });
    if (id === 'planter') land.forEach((n) => { if (isLand(n) && n.st === 'grass') out.push([n, 'forest']); });
    if (id === 'scrubber') land.forEach((n) => { if (n.st === 'rot') out.push([n, 'scrub']); });
    if (id === 'filter') { const w = land.filter((n) => n.kind === 'river' && n.river === 'dirty' && n.st !== 'rot'); w.forEach((n) => out.push([n, 'river'])); wetted(w, out); }
    if (id === 'gate') { const w = land.filter((n) => n.kind === 'marsh' && n.marsh === 'drained'); w.forEach((n) => out.push([n, 'marsh'])); wetted(w, out); }
    if (id === 'dam') { const w = cells.filter((n) => n.kind === 'river' && (n.river === 'dry' || n.river === 'dam')); w.forEach((n) => out.push([n, 'river'])); wetted(w, out); }
    return { out, gain: out.reduce((a, [, ch]) => a + PAY[ch], 0) };
  }
  function apply(n, ch) {
    if (ch === 'loosen') n.st = 'bare';
    if (ch === 'clear') n.debris = null;
    if (ch === 'grass') n.st = 'grass';
    if (ch === 'forest') n.st = 'forest';
    if (ch === 'scrub') n.st = isLand(n) ? 'dust' : null;
    if (ch === 'river') n.river = 'clean';
    if (ch === 'marsh') n.marsh = 'healed';
  }
  function place(id, t) {
    const k = TOOLS[id], e = effects(id, t);
    if (!e.out || S.leaves < k.cost) return false;
    S.undo.push(snap()); if (S.undo.length > 60) S.undo.shift();
    S.leaves += e.gain - k.cost; S.placed++;
    if (!k.once) { t.b = id; S.built++; }
    const g = now(), c0 = center(t);
    e.out.forEach(([n]) => wave.push({ n, at: g + 0.15 * dist(n, t) }));
    e.out.forEach(([n, ch]) => apply(n, ch));
    pops.push({ x: c0.x, y: c0.y - 16, text: `${e.gain - k.cost >= 0 ? '+' : ''}${e.gain - k.cost} 🍃`, color: e.gain >= k.cost ? '#c9e05a' : '#e8587d', t: 0 });
    track(`place ${id} ${t.c},${t.r} +${e.gain}`);
    afterChange();
    return true;
  }
  function recycle(t) {
    if (!t || !t.b) return false;
    S.undo.push(snap());
    const back = Math.floor(TOOLS[t.b].cost / 2); S.leaves += back; t.b = null; S.built--;
    const c0 = center(t); pops.push({ x: c0.x, y: c0.y - 16, text: `+${back} 🍃`, color: '#c9e05a', t: 0 });
    track(`recycle ${t.c},${t.r}`);
    afterChange();
    return true;
  }
  function undo() { const d = S.undo.pop(); if (!d) return; restore(d); S.done = false; afterChange(); }
  function afterChange() { dirty = true; lastKey = ''; checkGoals(); save(); }

  // ---------- goals ----------
  const landCells = cells.filter(isLand);
  const greenShare = () => landCells.filter((t) => t.st === 'grass' || t.st === 'forest').length / landCells.length;
  const forests = () => landCells.filter((t) => t.st === 'forest').length;
  const FOREST_GOAL = cells.filter((t) => isLand(t) && t.d0 === '.' && TREES.has(t.b0)).length + 24; // two dozen new forests
  const GREEN_GOAL = 0.7;
  const GOALS = [
    { id: 'green', text: () => `Green ${Math.round(greenShare() * 100)}% of the land (goal ${GREEN_GOAL * 100}%)`, ok: () => greenShare() >= GREEN_GOAL },
    { id: 'forest', text: () => `${forests()} forest hexes (goal ${FOREST_GOAL})`, ok: () => forests() >= FOREST_GOAL },
    { id: 'river', text: () => { const r = cells.filter((t) => t.kind === 'river'); return `Clean river: ${r.filter((t) => t.river === 'clean' && t.st !== 'rot').length} of ${r.length} hexes`; }, ok: () => cells.every((t) => t.kind !== 'river' || (t.river === 'clean' && t.st !== 'rot')) },
    { id: 'marsh', text: () => { const m = cells.filter((t) => t.kind === 'marsh'); return `Healed marsh: ${m.filter((t) => t.marsh === 'healed').length} of ${m.length} hexes`; }, ok: () => cells.every((t) => t.kind !== 'marsh' || t.marsh === 'healed') },
  ];
  const goalsMet = () => GOALS.every((g) => g.ok());
  function checkGoals() { if (!S.done && goalsMet() && S.built === 0) { S.done = true; showEnd(); } }
  // every placement you can afford that changes something, best first: for the hint and to spot a dead end
  function moves() {
    const out = [];
    for (const id of ORDER) { if (S.leaves < TOOLS[id].cost) continue; for (const t of cells) { const e = effects(id, t); if (e.out && e.out.length) out.push({ id, t, gain: e.gain, net: e.gain - TOOLS[id].cost }); } }
    return out.sort((a, b) => b.net - a.net || b.gain - a.gain);
  }

  // ---------- art: the land as its state ----------
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
  const fade = (h, k) => once(`f${h}${k}`, () => { const [r, g, b] = rgb(h), l = r * 0.3 + g * 0.59 + b * 0.11; return hex([r + (l * 1.04 + 10 - r) * k, g + (l * 0.98 + 2 - g) * k, b + (l * 0.86 - 8 - b) * k]); });
  const mix = (h, h2, k) => once(`m${h}${h2}${k}`, () => { const a = rgb(h), b = rgb(h2); return hex(a.map((v, i) => v + (b[i] - v) * k)); });
  const WATER2 = '#4b86c9', ROT = '#4a3b55', ROT_HI = '#6b5a7a';
  const GREENS = (grass, lime, leaf, pine, flower) => ({ [C.grass]: grass, [C.lime]: lime, [C.leaf]: leaf, [C.pine]: pine, [C.glow]: flower, [C.rose]: flower, [C.sage]: lime });
  const GROUND = { dust: GREENS(C.sand1, C.clay, C.clay, C.soil, C.sand0), poor: GREENS(C.clay, C.sand1, C.soil, C.bark, C.sand1) };
  const RIVER_LOOK = {
    dirty: { ...GREENS(C.olive, C.olive, C.olive2, C.pine, C.clay), [C.sky]: C.murk, [WATER2]: C.murk2, [C.mist]: C.sage },
    dry: { ...GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay), [C.sky]: C.sand1, [WATER2]: C.clay, [C.mist]: C.stone },
    dam: GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay),
  };
  const MARSH_LOOK = { ...GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay), [C.murk]: C.bark, [C.murk2]: '#2a1e22', [C.olive]: C.soil, [C.olive2]: C.bark };
  const STUMPS = [[8, 7], [16, 6], [23, 8], [6, 14], [14, 13], [22, 15], [10, 20], [19, 21]];
  const LOGS = [[6, 9, 7], [16, 13, 6], [8, 19, 6], [18, 21, 7]];
  const CRACKS = [[[6, 10], [7, 10], [8, 11], [9, 12], [9, 13], [11, 14]], [[18, 6], [19, 7], [20, 8], [22, 8]], [[15, 18], [16, 19], [17, 20], [16, 21], [17, 22], [19, 23]], [[23, 14], [24, 15], [25, 16], [27, 17]]];
  const lookOf = (t) => (t.kind === 'land' ? (t.st === 'forest' ? (TREES.has(t.wild) ? t.wild : 'pines') : t.st === 'grass' && t.wild === 'meadow' ? 'meadow' : 'grass')
    : t.kind === 'river' ? 'river' : t.kind === 'marsh' ? 'swamp' : t.kind === 'mine' ? 'mountains' : t.b0);
  function paintTile(t, v, ctx) {
    const look = lookOf(t), cv = X.cloverTile(look, v, ctx).cv, orig = cv.px.slice();
    const at = (x, y, c) => cv.set(x, y + X.FY, c);
    const recolor = (map) => { cv.px = cv.px.map((c) => c && (map[c] || c)); };
    let k = 0;
    if (t.kind === 'land' && (t.st === 'dust' || t.st === 'bare' || t.st === 'rot')) {
      recolor(t.st === 'bare' ? GROUND.poor : GROUND.dust);
      if (t.st !== 'bare') CRACKS.forEach((line) => line.forEach(([x, y]) => at(x, y, C.soil)));
      if (t.d0 === 'U' && key(t.c, t.r) === HOUSE) { // the settlers' farmhouse, roof fallen in
        for (let x = 11; x < 20; x++) for (let y = 11; y < 17; y++) at(x, y, y === 16 ? C.ink : x === 11 || x === 19 ? C.ink : C.pale);
        for (let x = 12; x < 17; x++) at(x, 10 - Math.min(x - 12, 16 - x), C.bark);
      }
      if (t.debris === 'stumps') STUMPS.forEach(([x, y]) => { at(x, y, C.clay); at(x + 1, y, C.sand0); at(x + 2, y, C.clay); at(x, y + 1, C.soil); at(x + 1, y + 1, C.soil); at(x + 2, y + 1, C.bark); at(x, y + 2, C.bark); at(x + 1, y + 2, C.bark); at(x + 2, y + 2, C.ink); });
      if (t.debris === 'dead') {
        LOGS.forEach(([x, y, n]) => { for (let i = 0; i < n; i++) { at(x + i, y, C.pale); at(x + i, y + 1, C.stone); at(x + i, y + 2, C.ink); } at(x + n, y, C.ink); at(x + n, y + 1, C.ink); });
        for (let y = -4; y < 12; y++) { at(23, y, C.pale); at(24, y, C.stone); }
      }
      k = t.st === 'bare' ? (t.debris === 'dead' ? 0.6 : 0.4) : 0.62;
    } else if (t.kind === 'river' && t.river !== 'clean') {
      recolor(RIVER_LOOK[t.river]); k = 0.55;
      if (t.river === 'dry') for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) { if (orig[(y + X.FY) * cv.w + x] === C.sky && (x * 7 + y * 3) % 13 === 0) at(x, y, C.pale); }
      if (t.river === 'dam') {
        for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) { const o = orig[(y + X.FY) * cv.w + x]; if (o === C.sky || o === WATER2 || o === C.mist) at(x, y, y < 12 ? (o === WATER2 ? C.murk2 : C.murk) : o === WATER2 ? C.clay : C.sand1); }
        for (let x = 2; x < 30; x++) if (X.inFace(x, 13)) { at(x, 12, C.ink); at(x, 13, C.clay); at(x, 14, C.soil); at(x, 15, C.ink); }
        for (const p0 of [6, 15, 24]) for (let y = 10; y < 16; y++) { at(p0, y, C.pale); at(p0 + 1, y, C.stone); }
      }
    } else if (t.kind === 'marsh' && t.marsh !== 'healed') { recolor(MARSH_LOOK); k = 0.6; }
    else if (t.kind === 'mine') {
      k = 0.45;
      for (let y = 10; y < 17; y++) for (let x = 13; x < 20; x++) at(x, y, x === 13 || x === 19 || y === 10 ? C.clay : C.ink);
      for (let y = 17; y < 27; y++) { const w = Math.max(1, 4 - Math.floor((y - 17) / 3)); for (let x = 16 - (w >> 1); x < 16 - (w >> 1) + w; x++) if (X.inFace(x, y)) at(x, y, (x + y) % 2 ? ROT : ROT_HI); }
    } else if (t.kind === 'scenery') k = 0.5;
    if (k > 0) cv.px = cv.px.map((c) => c && fade(c, Math.round(k * 20) / 20));
    if (t.st === 'rot') cv.px = cv.px.map((c, i) => { if (!c) return c; const x = i % cv.w, y = Math.floor(i / cv.w); return (x * 3 + y * 5) % 7 === 0 ? ROT_HI : mix(c, ROT, 0.6); });
    return cv;
  }

  // ---------- render ----------
  const canvas = document.getElementById('map'), cx = canvas.getContext('2d'), tip = document.getElementById('tip');
  const scene = document.createElement('canvas'), sx = scene.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  const COLS = 16, ROWS = 11, MW = 24 * (COLS - 1) + 32, MH = X.FY + 28 * ROWS + 14 + 3;
  let R, scale = 2, offX = 0, offY = 0, dpr = 1, hover = null, tool = 'pump', anim = [], dirty = true, lastKey = '';
  const wave = [], pops = []; // hexes flashing as a placement ripples out; leaf numbers floating up
  const now = () => performance.now() / 1000;
  function redraw() {
    dirty = false;
    const ctxs = X.contexts({ cells: cells.map((t) => ({ c: t.c, r: t.r, b: lookOf(t) })), river: RIVER });
    const px = new Array(MW * MH).fill(null), owner = new Int16Array(MW * MH).fill(-1);
    const order = cells.map((t, i) => ({ t, i, ...X.at(t.c, t.r) })).sort((a, b) => a.y - b.y || a.t.c - b.t.c);
    order.forEach(({ t, i, x: ox, y: oy }) => {
      const img = paintTile(t, (t.c * 5 + t.r * 3) % 2, ctxs.get(key(t.c, t.r)));
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = img.px[y * img.w + x]; if (c && ox + x < MW && oy + y < MH) px[(oy + y) * MW + ox + x] = c; }
      for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) if (X.inFace(x, y)) owner[(oy + X.FY + y) * MW + ox + x] = i;
    });
    R = { w: MW, h: MH, owner };
    base.width = scene.width = MW; base.height = scene.height = MH;
    const im = bx.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) { const c = px[i]; if (!c) continue; const v = rgb(c), o = i * 4; im.data[o] = v[0]; im.data[o + 1] = v[1]; im.data[o + 2] = v[2]; im.data[o + 3] = 255; }
    bx.putImageData(im, 0, 0);
    anim = [];
    cells.forEach((t) => { // life is motion: water glints, birds over forest, bees over grass
      const p = center(t), ph = (t.c * 7 + t.r * 13) % 10;
      if (wetSource(t) && t.kind !== 'land') anim.push({ kind: 'glint', x: p.x - 6 + (ph % 5) * 2, y: p.y - 3 + (ph % 3) * 2, ph }, { kind: 'glint', x: p.x + 3 - (ph % 4), y: p.y + 4 - (ph % 2) * 3, ph: ph + 3 });
      if (isLand(t) && t.st === 'forest' && ph % 3 === 0) anim.push({ kind: 'bird', x: p.x, y: p.y - 14, ph });
      if (isLand(t) && t.st === 'grass' && ph % 3 === 1) anim.push({ kind: 'bee', x: p.x, y: p.y, ph });
    });
    fit();
  }
  function fit() {
    if (!R) return;
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const top = innerWidth < 720 ? document.querySelector('.score').getBoundingClientRect().bottom + 6 : 0; // on a phone the map sits under the goals
    const bar = $('bottom').offsetHeight + 16, vh = innerHeight - bar - top;
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    const s = Math.min(innerWidth / R.w, vh / R.h);
    scale = s >= 2 ? Math.floor(s) : s;
    offX = Math.round((innerWidth - R.w * scale) / 2); offY = top + Math.round(Math.max(0, (vh - R.h * scale) / 2));
  }
  const px = (x, y, w, h, c) => { sx.fillStyle = c; sx.fillRect(Math.round(x), Math.round(y), w, h); };
  // restorers, drawn standing at (x, y); `g` is the clock for the moving parts
  function drawTool(id, x, y, g, put = px) {
    if (id === 'pump') {
      put(x, y - 12, 1, 13, '#3f2b31'); put(x - 2, y, 5, 2, '#77513c'); put(x - 1, y - 13, 3, 3, '#f4f6ea');
      if (Math.floor(g * 6) % 2) { put(x - 5, y - 12, 4, 1, '#f4f6ea'); put(x + 2, y - 12, 4, 1, '#f4f6ea'); put(x, y - 18, 1, 4, '#f4f6ea'); put(x, y - 9, 1, 3, '#dce7ee'); }
      else { put(x - 4, y - 16, 2, 2, '#f4f6ea'); put(x + 3, y - 16, 2, 2, '#f4f6ea'); put(x - 4, y - 10, 2, 2, '#dce7ee'); put(x + 3, y - 10, 2, 2, '#dce7ee'); }
    } else if (id === 'sprinkler') {
      put(x - 2, y - 1, 5, 3, '#5f6e8a'); put(x, y - 6, 1, 5, '#a3b5c4'); put(x - 1, y - 7, 3, 1, '#a3b5c4');
      for (let i = 0; i < 5; i++) { const a = g * 3 + i * 1.26, r = 3 + ((g * 6 + i) % 4); put(x + Math.round(Math.cos(a) * r), y - 7 + Math.round(Math.sin(a) * r * 0.5), 1, 1, '#a9d5f0'); }
    } else if (id === 'planter') {
      put(x - 5, y - 2, 11, 4, '#77513c'); put(x - 5, y + 1, 11, 1, '#3f2b31');
      for (const d of [-3, 0, 3]) { put(x + d, y - 5, 1, 3, '#2f7d46'); put(x + d - 1, y - 6, 3, 1, '#9bcb3e'); }
    } else if (id === 'scrubber') {
      put(x - 3, y - 4, 7, 6, '#5f6e8a'); put(x - 3, y + 1, 7, 1, '#141d26'); put(x + 1, y - 9, 2, 5, '#a3b5c4');
      for (let i = 0; i < 3; i++) { const f = (g * 0.7 + i / 3) % 1; put(x + 1 + Math.round(Math.sin((f + i) * 6)), y - 10 - f * 10, 2, 2, f < 0.5 ? '#f39a52' : '#a3b5c4'); }
    } else if (id === 'filter') {
      for (let i = 0; i < 6; i++) { const h = 4 + (i * 3) % 4; put(x - 5 + i * 2, y - h, 1, h, i % 2 ? '#9bcb3e' : '#2f7d46'); put(x - 5 + i * 2, y - h - 1, 1, 1, '#b57f52'); }
      put(x - 7, y, 14, 1, '#77513c');
    } else if (id === 'gate') {
      put(x - 7, y - 3, 15, 4, '#b57f52'); put(x - 7, y, 15, 1, '#3f2b31'); for (const d of [-6, 0, 6]) put(x + d, y - 6, 2, 8, '#77513c');
    } else if (id === 'dam') {
      put(x - 6, y - 3, 13, 4, '#a3b5c4'); put(x - 4, y - 6, 3, 3, '#5f6e8a'); put(x + 2, y - 5, 3, 2, '#5f6e8a'); put(x - 1, y - 1, 2, 2, '#4b86c9');
    } else if (id === 'recycle') {
      put(x - 4, y - 8, 9, 2, '#9bcb3e'); put(x + 3, y - 10, 2, 6, '#9bcb3e'); put(x - 4, y - 2, 9, 2, '#9bcb3e'); put(x - 4, y - 4, 2, 6, '#9bcb3e');
    }
  }
  function hexShape(color, edgeOnly) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 28;
    const rc = c.getContext('2d'); rc.fillStyle = color;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) if (X.inFace(x, y) && (!edgeOnly || !X.inFace(x - 1, y) || !X.inFace(x + 1, y) || !X.inFace(x, y - 1) || !X.inFace(x, y + 1))) rc.fillRect(x, y, 1, 1);
    return c;
  }
  const ring = hexShape('#f4f6ea', true), goldEdge = hexShape('#e6c35a', true), badEdge = hexShape('#e8587d', true);
  const fillOf = { loosen: hexShape('#e2bd78', false), clear: hexShape('#e2bd78', false), scrub: hexShape('#f39a52', false), grass: hexShape('#9bcb3e', false), forest: hexShape('#2f7d46', false), river: hexShape('#5f9edd', false), marsh: hexShape('#5f9edd', false) };
  const rangeHex = hexShape('rgba(244,246,234,0.16)', false), glowHex = hexShape('#f4e98a', false);
  function label(text, x, y, color) { cx.lineWidth = 3 * dpr; cx.strokeStyle = '#141d26'; cx.strokeText(text, x, y); cx.fillStyle = color; cx.fillText(text, x, y); }
  let preview = null;
  function render(g) {
    if (dirty) redraw();
    sx.clearRect(0, 0, R.w, R.h);
    sx.drawImage(base, 0, 0);
    for (let i = wave.length - 1; i >= 0; i--) { // a placement ripples out from where it lands
      const w = wave[i], k = (g - w.at) / 0.7;
      if (k > 1) { wave.splice(i, 1); continue; }
      if (k >= 0) { const p = X.at(w.n.c, w.n.r); sx.globalAlpha = 0.7 * (1 - k); sx.drawImage(glowHex, p.x, p.y + X.FY); sx.globalAlpha = 1; }
    }
    for (const a of anim) {
      if (a.kind === 'glint' && Math.sin(g * 1.7 + a.ph) > 0.55) px(a.x, a.y, 2, 1, '#f4f6ea');
      if (a.kind === 'bird') { const ang = g * 0.7 + a.ph, bx2 = a.x + Math.cos(ang) * 8, by = a.y + Math.sin(ang) * 3, f = Math.floor(g * 5 + a.ph) % 2; px(bx2, by + f, 1, 1, '#141d26'); px(bx2 + 1, by + 1 - f, 1, 1, '#141d26'); px(bx2 + 2, by + f, 1, 1, '#141d26'); }
      if (a.kind === 'bee') { const ang = g * 2.3 + a.ph; px(a.x + Math.cos(ang) * 6, a.y - 4 + Math.sin(ang * 1.7) * 3, 1, 1, '#e6e773'); }
    }
    // the preview: the tool's reach, every hex it would change, and a red edge where it can't go
    preview = null;
    if (tool === 'sprinkler' && view === 'game') cells.forEach((t) => { if (t.b === 'pump') area(t, 2).forEach((n) => { if (n !== t) { const p = X.at(n.c, n.r); sx.globalAlpha = 0.35; sx.drawImage(goldEdge, p.x, p.y + X.FY); sx.globalAlpha = 1; } }); });
    if (hover && view === 'game') {
      const p0 = X.at(hover.c, hover.r);
      if (tool === 'recycle') sx.drawImage(hover.b ? goldEdge : badEdge, p0.x, p0.y + X.FY);
      else {
        const k = TOOLS[tool], e = effects(tool, hover);
        if (e.out) {
          area(hover, k.range).forEach((n) => { const p = X.at(n.c, n.r); sx.drawImage(rangeHex, p.x, p.y + X.FY); });
          e.out.forEach(([n, ch]) => { const p = X.at(n.c, n.r); sx.globalAlpha = 0.45 + 0.15 * Math.sin(g * 5); sx.drawImage(fillOf[ch], p.x, p.y + X.FY); sx.globalAlpha = 1; });
          sx.drawImage(S.leaves >= k.cost ? goldEdge : badEdge, p0.x, p0.y + X.FY);
          sx.globalAlpha = 0.7; drawTool(tool, center(hover).x, center(hover).y + 4, g); sx.globalAlpha = 1;
          preview = { gain: e.gain, cost: k.cost, n: e.out.length };
        } else { sx.drawImage(badEdge, p0.x, p0.y + X.FY); preview = { why: e.why }; }
      }
    }
    cells.filter((t) => t.b).sort((a, b) => a.r - b.r || a.c - b.c).forEach((t) => { const c = center(t); drawTool(t.b, c.x, c.y + 4, g + t.c); });
    const k2 = scale * dpr, ox = offX * dpr, oy = offY * dpr;
    cx.fillStyle = '#a9d5f0'; cx.fillRect(0, 0, canvas.width, canvas.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(scene, ox, oy, R.w * k2, R.h * k2);
    cx.textAlign = 'center'; cx.font = `700 ${Math.round(Math.max(14, 7 * scale) * dpr)}px "Pixelify Sans", monospace`;
    if (preview && preview.gain !== undefined) { const c = center(hover); label(`+${preview.gain} 🍃`, ox + c.x * k2, oy + (c.y - 26) * k2, preview.gain >= preview.cost ? '#c9e05a' : '#f4e98a'); }
    for (let i = pops.length - 1; i >= 0; i--) {
      const f = pops[i]; f.t += 1 / 60; if (f.t > 1.4) { pops.splice(i, 1); continue; }
      cx.globalAlpha = Math.max(0, 1 - f.t / 1.4); label(f.text, ox + f.x * k2, oy + (f.y - f.t * 14) * k2, f.color); cx.globalAlpha = 1;
    }
  }

  // ---------- input ----------
  function cellAt(e) {
    const x = Math.floor((e.clientX - offX) / scale), y = Math.floor((e.clientY - offY) / scale);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? cells[o] : null;
  }
  // A mouse previews on hover and places on click; a finger previews on the first tap and places on the second.
  canvas.addEventListener('pointerdown', (e) => {
    if (view !== 'game' || S.done) return;
    const t = cellAt(e);
    if (e.pointerType !== 'mouse' && t !== hover) { hover = t; lastKey = ''; return; }
    hover = t;
    if (!t) return;
    if (tool === 'recycle') { if (!recycle(t)) flash('Tap a restorer to recycle it.'); return; }
    if (!place(tool, t)) { const w = effects(tool, t).why; flash(w || `Not enough leaves: the ${lower(TOOLS[tool].name)} costs ${TOOLS[tool].cost}.`); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = view === 'game' ? cellAt(e) : null;
    if (t !== hover) { hover = t; lastKey = ''; }
    if (!t) { tip.style.display = 'none'; return; }
    tip.innerHTML = `<b>${nameOf(t)} <small class="coord">hex ${t.c},${t.r}</small></b><span>${hint(t)}</span>`;
    tip.style.display = 'block';
    let lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + tip.offsetWidth > innerWidth - 8) lx = e.clientX - tip.offsetWidth - 12;
    if (ly + tip.offsetHeight > innerHeight - 8) ly = e.clientY - tip.offsetHeight - 12;
    tip.style.left = `${lx}px`; tip.style.top = `${ly}px`;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; tip.style.display = 'none'; lastKey = ''; });
  // what helps a hex, in one line
  function hint(t) {
    if (t.b) return `${TOOLS[t.b].text} Recycle it for ${Math.floor(TOOLS[t.b].cost / 2)} leaves back.`;
    if (t.st === 'rot') return 'Rot from the mine. A scrubber next to it burns it back.';
    if (t.kind === 'mine') return 'The settlers\' mine, leaking rot. A scrubber on it burns back the rot around it.';
    if (isLand(t)) return { dust: 'Dead, hard ground. A wind pump next to it loosens it.', bare: t.debris ? 'Dead trees or stumps. A wind pump next to it clears them.' : 'Bare ground. A sprinkler next to it grows grass.', grass: 'Living grass. A tree planter next to it grows forest.', forest: 'Living forest.' }[t.st];
    if (t.kind === 'river') return { clean: 'Clean water. Tree planters near it have water.', dirty: 'Murky water. A reed filter on it cleans it.', dry: 'The river ran here before the dam held it back.', dam: 'The settlers\' mill dam. Open it and the dry riverbed fills.' }[t.river];
    if (t.kind === 'marsh') return t.marsh === 'drained' ? 'The settlers ditched it dry. A water gate on it fills it again.' : 'A living marsh. Tree planters near it have water.';
    if (t.kind === 'scenery') return 'Hills and rock. Nothing is built here.';
    return 'Water. Tree planters near it have water.';
  }
  addEventListener('resize', () => fit());
  addEventListener('pagehide', save);

  // ---------- HUD ----------
  function $(id) { return document.getElementById(id); }
  const iconOf = (id) => once(`ic${id}`, () => { const c = document.createElement('canvas'); c.width = 24; c.height = 26; const g = c.getContext('2d'); drawTool(id, 12, 23, 0.3, (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }); return c.toDataURL(); });
  $('tools').innerHTML = [...ORDER, 'recycle'].map((id, i) => {
    const k = TOOLS[id], tipText = k ? k.text : 'Take a restorer away and get half its leaves back. What it healed stays healed.';
    return `<button class="tool" data-tool="${id}" title="${tipText.replace(/"/g, '&quot;')}"><img alt="" src="${iconOf(id)}"><span>${k ? k.name : 'Recycle'}</span><em>${k ? `${k.cost} 🍃` : '+½'}</em>${i < ORDER.length ? `<kbd>${i + 1}</kbd>` : ''}</button>`;
  }).join('');
  $('tools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) { tool = b.dataset.tool; lastKey = ''; track(`tool ${tool}`); } });
  $('undoBtn').addEventListener('click', () => { undo(); track('undo'); });
  $('hintBtn').addEventListener('click', () => {
    const m = moves()[0];
    if (!m) { flash('Nothing you can afford changes any hex. Undo a few steps, or recycle a restorer you no longer need.'); return; }
    tool = m.id; hover = m.t; lastKey = ''; flash(`Try a ${lower(TOOLS[m.id].name)} on hex ${m.t.c},${m.t.r}: +${m.gain} for ${TOOLS[m.id].cost}.`);
  });
  let flashT = 0;
  function flash(m) { if (!m) return; $('msg').textContent = m; $('msg').hidden = false; flashT = now() + 5; }
  function updateHud() {
    if (now() > flashT) $('msg').hidden = true;
    const key2 = [S.leaves, S.placed, tool, hover && hover.c, hover && hover.r, S.built, S.done, view].join('|');
    if (key2 === lastKey) return;
    lastKey = key2;
    $('leaves').textContent = S.leaves;
    $('goals').innerHTML = GOALS.map((g) => `<li class="${g.ok() ? 'ok' : ''}">${g.ok() ? '✓' : '○'} ${g.text()}</li>`).join('')
      + `<li class="${goalsMet() && !S.built ? 'ok' : goalsMet() ? '' : 'later'}">${goalsMet() && !S.built ? '✓' : '○'} Then recycle every restorer${S.built ? ` (${S.built} standing)` : ''}</li>`;
    document.querySelectorAll('[data-tool]').forEach((b) => { const id = b.dataset.tool; b.setAttribute('aria-pressed', String(id === tool)); b.classList.toggle('poor', id !== 'recycle' && S.leaves < TOOLS[id].cost); });
    const t = TOOLS[tool];
    $('toolInfo').innerHTML = (tool === 'recycle' ? '<b>Recycle</b> Tap a restorer to take it away for half its leaves back. What it healed stays healed.' : `<b>${t.name}</b> ${t.text}`)
      + (preview && preview.why ? ` <span class="bad">${preview.why}</span>` : preview && preview.gain !== undefined ? ` <span class="${preview.gain >= preview.cost ? 'good' : 'meh'}">Here: changes ${preview.n} ${preview.n === 1 ? 'hex' : 'hexes'}, +${preview.gain} for ${preview.cost}.</span>` : '');
    $('undoBtn').disabled = !S.undo.length;
    if (innerWidth < 720) fit(); // the goals panel can change height
    $('stuck').hidden = S.done || goalsMet() || moves().some((m) => m.gain > 0);
  }

  // ---------- menu, help and the end ----------
  let view = 'menu';
  function show(v) { view = v; if (v === 'game') S.started = true; $('menu').hidden = v !== 'menu'; $('endView').hidden = v !== 'end'; $('helpView').hidden = v !== 'help'; if (v !== 'game') tip.style.display = 'none'; lastKey = ''; fit(); }
  function openMenu() {
    save();
    const sv = loadSave(), live = sv && !sv.done;
    $('resume').hidden = !live;
    $('newGame').textContent = live ? 'New valley' : 'Start';
    $('newGame').dataset.armed = live ? '' : '1';
    $('saveNote').textContent = live ? `Saved: ${sv.placed} restorers placed, ${sv.leaves} leaves.` : 'Your valley saves in this browser as you play.';
    show('menu');
  }
  function showEnd() { $('endStats').textContent = `You healed the valley in ${S.placed} moves with ${S.leaves} leaves to spare.`; show('end'); }
  $('menuBtn').addEventListener('click', openMenu);
  $('helpBtn').addEventListener('click', () => show('help'));
  $('helpClose').addEventListener('click', () => show('game'));
  $('resume').addEventListener('click', () => { const sv = loadSave(); if (sv) load(sv); show('game'); });
  $('newGame').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again: replace your saved valley'; return; }
    fresh(); show('help'); S.started = true; save();
  });
  $('again').addEventListener('click', () => { fresh(); show('game'); save(); });
  $('restartBtn').addEventListener('click', () => { if (confirm('Start this valley again from the beginning?')) { fresh(); S.started = true; save(); track('restart'); } });
  addEventListener('keydown', (e) => {
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    if (e.key === 'Escape') { if (view === 'help') show('game'); else if (view === 'game') openMenu(); }
    const n = Number(e.key); if (view === 'game' && n >= 1 && n <= ORDER.length) { tool = ORDER[n - 1]; lastKey = ''; }
  });

  // ---------- send to Claude ----------
  const trail = [];
  function track(what) { trail.push(`${S ? `#${S.placed}` : 'menu'} ${what}`); if (trail.length > 80) trail.shift(); }
  function report() {
    return { at: new Date().toISOString(), view, leaves: S.leaves, placed: S.placed, tool, hover: hover && `${hover.c},${hover.r}`, goals: GOALS.map((g) => `${g.ok() ? '✓' : '·'} ${g.text()}`),
      best: moves().slice(0, 3).map((m) => `${m.id} ${m.t.c},${m.t.r} +${m.gain}`), trail: trail.slice(), save: JSON.stringify(snap()) };
  }
  let sendDb = null;
  (async () => { try { sendDb = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { sendDb = null; } $('sendBtn').hidden = !sendDb; })();
  $('sendBtn').addEventListener('click', async () => {
    if (!sendDb || !S) return;
    const lbl = $('sendBtn').querySelector('.lbl');
    try { await sendDb.doc('reports/latest').set(report()); lbl.textContent = 'Sent ✓'; flash('Sent to Claude. Tell Claude what you were trying to do.'); } catch (e) { lbl.textContent = 'Could not send'; }
    setTimeout(() => { lbl.textContent = 'Send to Claude'; }, 3000);
  });

  // ---------- loop ----------
  function frame() {
    requestAnimationFrame(frame);
    if (!S) return;
    try { render(now()); updateHud(); } catch (e) { console.error(e); }
  }
  const saved = loadSave();
  if (saved && !saved.done) { try { load(saved); } catch (e) { fresh(); } } else fresh();
  redraw();
  openMenu();
  requestAnimationFrame(frame);
  window.HexCivGame = { get state() { return S; }, cells, get, effects, place, recycle, undo, moves, goals: () => GOALS.map((g) => [g.id, g.ok(), g.text()]), goalsMet, nameOf, fresh, show, report, trail, TOOLS,
    screenOf(c, r) { const p = center(get(c, r)); return { x: offX + p.x * scale, y: offY + (p.y + 4) * scale }; },
    loadReport(r) { restore(JSON.parse(r.save)); S.started = true; show('game'); } };
})();
