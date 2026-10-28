// HexCiv v3, Restore the Valley: healing in stages. Every land tile has soil (hard to loose), food (dead to rich), water
// (dry to wet) and a cover (bare, seedlings, young wood, forest, clover, grass). The player sets a plan per tile
// (Forest, Field, Rest) and puts workers into crews (land, water, wood, food); crews pick their own tasks by plan
// priority, the season and distance. The dock keeps stock above "keep" lines and sells surplus when the trader's
// boat is in. Nothing on screen states a goal, and the run ends when the last worker dies.
// See the "Healing the Land" design doc and docs/game-design.md. v1 and v2 are frozen in archive/.
(() => {
  const X = buildHexTiles(), icon = buildHudIcons(), B = X.BIOMES, C = X.C;

  // ---------- tuning ----------
  const SEASON_LEN = 150;             // seconds per season: a 10-minute year
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const SPRING = 0, SUMMER = 1, AUTUMN = 2, WINTER = 3;
  const GROWTH = [1.5, 1, 0.5, 0];    // how fast things grow in each season
  const CHOP_TIME = 4, FISH_TIME = 8, FARM_TIME = 10, SEED_TIME = 6;
  const STEP = 0.45, SNOW = 1.6;      // seconds per point of move cost; winter walking slowdown
  const LOG_PRICE = 3, FOOD_PRICE = 2;
  const BUY_PRICE = { logs: 5, food: 4 }; // the trader also sells, dearer than he buys
  const MEAL = 75, WARM = 30;         // a worker eats one food this often (twice as often in winter) and burns a log in winter
  const STARVE = 120, FREEZE = 75, SICKEN = 60;
  const WOOD = { forest: 120, pines: 60, grove: 50 }, DEADWOOD = 30, NEW_STAND = 20;
  const REGROW = 30;                  // a rested stand grows one log this often in summer (faster in spring)
  const SEEDLING_GROW = 450, YOUNG_GROW = 900, OLD_GROW = 1800, CLOVER_GROW = 450, GRASS_CREEP = 180, STUMP_ROT = 1200;
  const DRY = 45, WILT = 40;          // summer: a tile loses a water level every DRY seconds; dry plants wilt after WILT
  const NURSERY = 30;                 // seconds for the nursery to raise one seed into a sapling
  const BOAT_STAY = 60;               // the trader's boat stays this long at the start of spring, summer and autumn
  const FLOOD = 20, SEEP = 25;
  const hireCost = () => 15 + 5 * Math.max(0, S.workers.length - 1);
  const NAMES = ['Ana', 'Tomas', 'Bea', 'Ivo', 'Mara', 'Jon', 'Lena', 'Oskar', 'Rui', 'Edda', 'Finn', 'Sela', 'Pim', 'Hana', 'Tove', 'Ugo', 'Nils', 'Kaja'];
  const SOIL = ['Hard', 'Firm', 'Loose'], FOOD = ['Dead', 'Poor', 'Fed', 'Rich'], WATER = ['Dry', 'Damp', 'Wet'];

  // Land jobs: seasons they can be done in, work-seconds, tech, and what they use from the stores.
  const JOB = {
    loosen: { name: 'Loosen soil', seasons: [0, 1, 2], work: 25 },
    mulch: { name: 'Mulch', seasons: [0, 1, 2, 3], work: 15 },
    compost: { name: 'Compost', seasons: [0, 1, 2], work: 20, tech: 'compost', uses: { food: 4 } },
    plant: { name: 'Plant saplings', seasons: [0, 2], work: 15, tech: 'nursery', uses: { saplings: 1 } },
    sow: { name: 'Sow clover', seasons: [0, 2], work: 15, tech: 'clover', uses: { seed: 2 } },
    pull: { name: 'Pull stumps', seasons: [0, 1, 2], work: 30, tech: 'stumps' },
    burn: { name: 'Burn rot', seasons: [0, 1, 2], work: 30 },
    block: { name: 'Block ditches', seasons: [0, 1, 2], work: 40, tech: 'ditchblock', uses: { logs: 10 } },
    reedbed: { name: 'Build a reed bed', seasons: [0, 1, 2], work: 60, tech: 'reeds', uses: { logs: 15 } },
  };
  const ROLES = {
    land: { name: 'Land crew', icon: 'hoe', hue: '#9bcb3e' },
    water: { name: 'Water carriers', icon: 'drop', hue: '#5f9edd' },
    wood: { name: 'Woodcutters', icon: 'axe', hue: '#e2bd78' },
    food: { name: 'Fishers and farmers', icon: 'fishing', hue: '#e8587d' },
  };
  const PLANS = {
    forest: { name: 'Forest', color: '#3fae5a' },
    field: { name: 'Field', color: '#e6c35a' },
    rest: { name: 'Rest', color: '#a3b5c4' },
    marsh: { name: 'Heal marsh', color: '#5f9edd' },
    river: { name: 'Clean river', color: '#7fe0c4' },
  };
  // x, y place the node on the tree (percent of the board); one column per branch
  const COLX = [9, 25, 41, 58, 75, 91], ROWY = [11, 35, 59, 83];
  const TECH = [
    { id: 'hoes', name: 'Hoes', icon: 'hoe', cost: 30, logs: 5, col: 0, row: 0, text: 'Loosening soil takes half the time. Until then the crew digs with sticks.' },
    { id: 'compost', name: 'Compost heap', icon: 'compost', cost: 50, food: 20, col: 0, row: 1, needs: 'hoes', text: 'The land crew can compost: 4 food in scraps makes a tile two steps richer at once.' },
    { id: 'farms', name: 'Farms', icon: 'farms', cost: 80, col: 0, row: 2, needs: 'compost', text: 'The food crew farms grassland on Field plans, except in winter. Every harvest tires the soil.' },
    { id: 'yokes', name: 'Yokes', icon: 'drop', cost: 30, logs: 5, col: 1, row: 0, text: 'Water carriers bring two buckets a trip.' },
    { id: 'swales', name: 'Swales', icon: 'hoe', cost: 60, col: 1, row: 1, needs: 'yokes', text: 'Shallow ditches catch spring rain: your land dries half as fast in summer.' },
    { id: 'ditches', name: 'Ditches', icon: 'dam', cost: 100, logs: 20, col: 1, row: 2, needs: 'swales', text: 'Land next to a clean river or pond never dries below damp.' },
    { id: 'dam', name: 'Dam breaking', icon: 'dam', col: 1, row: 3, needs: 'ditches', soon: true, text: 'Break the old dam so the dry riverbed fills. Coming in a later prototype.' },
    { id: 'seeds', name: 'Seed gathering', icon: 'seed', cost: 20, col: 2, row: 0, text: 'In autumn the land crew gathers seed from living forests. Seed is kept at the dock.' },
    { id: 'nursery', name: 'Nursery', icon: 'sapling', cost: 60, logs: 15, col: 2, row: 1, needs: 'seeds', text: 'Raises seed into saplings at the dock, outside winter. Forest plans need saplings to plant.' },
    { id: 'clover', name: 'Clover', icon: 'farms', cost: 40, col: 2, row: 2, needs: 'seeds', text: 'Field plans sow clover with seed. Clover feeds the soil as it grows and turns into grassland.' },
    { id: 'frames', name: 'Cold frames', icon: 'sapling', cost: 80, logs: 10, col: 2, row: 3, needs: 'nursery', text: 'The nursery keeps raising saplings through winter.' },
    { id: 'axes', name: 'Axes', icon: 'axe', cost: 40, col: 3, row: 0, text: 'Chopping takes half the time.' },
    { id: 'selective', name: 'Selective felling', icon: 'forestry', cost: 60, col: 3, row: 1, needs: 'axes', text: 'Woodcutters can be told to leave a third of every stand, so it keeps growing while it is worked.' },
    { id: 'stumps', name: 'Stump pulling', icon: 'axe', cost: 50, col: 3, row: 2, needs: 'axes', text: 'The land crew pulls stumps out for firewood, so stump fields can become fields.' },
    { id: 'ditchblock', name: 'Ditch blocking', icon: 'drop', cost: 60, logs: 30, col: 4, row: 0, text: 'Block the settlers\' ditches on a drained marsh (10 logs). At the next spring flood the water stays and the marsh heals.' },
    { id: 'reeds', name: 'Reed beds', icon: 'reeds', cost: 100, logs: 30, col: 4, row: 1, needs: 'ditchblock', text: 'Build a reed bed on a dirty river tile (15 logs) to clean it. Needs a healed marsh of yours for the reeds.' },
    { id: 'quarry', name: 'Quarrying', icon: 'stone', col: 4, row: 2, needs: 'reeds', soon: true, text: 'Stone and lime from the hills. Coming in a later prototype.' },
    { id: 'seal', name: 'Mine sealing', icon: 'seal', col: 4, row: 3, needs: 'quarry', soon: true, text: 'Seal the leaking mine and the rot stops for good. Coming in a later prototype.' },
    { id: 'fishing', name: 'Fishing nets', icon: 'fishing', cost: 30, col: 5, row: 0, text: 'Fishers catch twice as many fish.' },
    { id: 'smoke', name: 'Smokehouse', icon: 'food', cost: 60, logs: 10, col: 5, row: 1, needs: 'fishing', text: 'Smoked fish keeps: the crew no longer eats twice as much in winter.' },
    { id: 'trade', name: 'Trade post', icon: 'boat', cost: 90, logs: 20, col: 5, row: 2, text: 'When the boat comes in, everything above your keep lines is sold, and anything below them is bought back, while the gold lasts.' },
  ];
  TECH.forEach((t) => { t.x = COLX[t.col]; t.y = ROWY[t.row]; });

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
  const RIVER = [[3, 1], [3, 2], [3, 3], [4, 4], [4, 5], [5, 5], [5, 6], [6, 7], [6, 8], [7, 8], [8, 9]]; // source to mouth
  const ROT_START = [[3, 0], [3, 1], [3, 2], [3, 3], [4, 4], [4, 5], [5, 5], [5, 6]];
  const START_OWN = [[9, 9], [9, 8], [8, 9], [10, 9], [8, 8], [10, 8], [9, 7]];
  const HOUSE = '8,3';
  const SCENERY = new Set(['mountains', 'hills', 'rocks']);
  const VALUE = { grass: 10, meadow: 15, pond: 20, pines: 25, forest: 30, grove: 25, beach: 15, river: 18, hills: 8, rocks: 8, mountains: 8, swamp: 20 };

  const key = (c, r) => `${c},${r}`;
  const cells = LAND.flatMap((row, r) => [...row].map((ch, c) => ({ c, r, b0: KEY[ch], d0: DAMAGE[r][c] })));
  const byKey = new Map(cells.map((t) => [key(t.c, t.r), t]));
  const get = (c, r) => byKey.get(key(c, r));
  const center = (t) => { const p = X.at(t.c, t.r); return { x: p.x + 16, y: p.y + X.FY + 14 }; };
  const cube = (t) => { const x = t.c, z = t.r - (t.c - (t.c & 1)) / 2; return [x, -x - z, z]; };
  const dist = (a, b) => { const p = cube(a), q = cube(b); return Math.max(...p.map((v, i) => Math.abs(v - q[i]))); };
  const NBS = new Map(cells.map((t) => [t, X.NB(t.c, t.r).map(([c, r]) => get(c, r)).filter(Boolean)]));
  const nbs = (t) => NBS.get(t);
  const DOCK = get(9, 9);
  const HUES = ['#e8587d', '#5f9edd', '#e6e773', '#cfa0ff', '#f39a52', '#7fe0c4'];
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  // what kind of place a tile is: land you can heal, water, scenery, or one of the settlers' works
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
  const PLANTS = new Set(['seedlings', 'young', 'clover']);
  const TREES = new Set(['pines', 'forest', 'grove']);
  const isForest = (t) => isLand(t) && !t.rot && TREES.has(t.cover) && t.wood > 0;
  function alive(t) {
    if (t.rot) return false;
    if (isLand(t)) return t.soil >= 1 && t.food >= 2 && t.water >= 1 && t.cover !== 'bare' && !t.dead;
    if (t.kind === 'river') return t.river === 'clean';
    if (t.kind === 'marsh') return t.marsh === 'healed';
    return t.kind !== 'mine';
  }
  const living = (t) => !t.rot && ((isLand(t) && t.cover !== 'bare' && !t.dead) || ['pond', 'beach'].includes(t.kind) || (t.kind === 'river' && t.river === 'clean') || (t.kind === 'marsh' && t.marsh === 'healed'));
  function nameOf(t) {
    if (t === DOCK) return 'Dock';
    if (t.rot && t.kind !== 'mine') return 'Rot';
    switch (t.kind) {
      case 'mine': return 'Leaking mine';
      case 'river': return { clean: 'River', dirty: 'Dirty river', dry: 'Dry riverbed', dam: 'Old dam' }[t.river];
      case 'marsh': return { drained: 'Drained marsh', blocked: 'Blocked marsh', healed: 'Marsh' }[t.marsh];
      case 'land': break;
      default: return B[t.b0].name;
    }
    if (t.dead) return 'Deadwood';
    const cv = { pines: 'Pine stand', forest: 'Old forest', grove: 'Oak grove', young: 'Young wood', seedlings: 'Seedlings', clover: 'Clover', meadow: 'Meadow', grass: 'Grassland' }[t.cover];
    if (cv) return cv;
    if (t.stumps) return 'Stump field';
    if (t.soil === 0 && t.food === 0) return 'Dust field';
    return t.food >= 2 ? 'Fed ground' : 'Bare ground';
  }
  const placeOf = (t) => (t === DOCK ? 'at the dock' : `on the ${lower(nameOf(t))}`);
  function moveCost(t) {
    if (t.kind === 'land') return t.dead ? 3 : t.stumps ? 2 : TREES.has(t.cover) ? 2 : 1;
    if (t.kind === 'river') return t.river === 'dry' ? 2 : 3;
    if (t.kind === 'marsh') return 3;
    if (t.kind === 'mine') return 4;
    return B[t.b0].move;
  }

  // ---------- state ----------
  let S;
  const toasts = [];
  function freshCell(t) {
    Object.assign(t, { rot: false, own: false, plan: null, prio: 1, work: 0, grow: 0, age: 0, dry: 0, wilt: 0, regrow: 0, held: false, stumpAge: 0, tire: 0,
      soil: 0, food: 0, water: 1, cover: 'bare', dead: 0, stumps: false, wood: 0, river: null, marsh: null });
    if (t.kind === 'river') t.river = { R: 'dirty', Y: 'dry', A: 'dam' }[t.d0] || 'clean';
    if (t.kind === 'marsh') t.marsh = t.d0 === 'M' ? 'drained' : 'healed';
    if (!isLand(t)) return;
    const d = t.d0;
    if (d === 'D') Object.assign(t, { soil: 1, food: 1, water: 0, dead: DEADWOOD });
    else if (d === 'S') Object.assign(t, { soil: 1, food: 1, water: 1, stumps: true });
    else if (d === 'U') Object.assign(t, { soil: 0, food: 0, water: 0 });
    else if (d === 'B') Object.assign(t, { soil: 1, food: 1, water: 1 });
    else Object.assign(t, { soil: 2, food: 2, water: 1, cover: t.b0 === 'pond' ? 'grass' : t.b0, wood: WOOD[t.b0] || 0 });
  }
  function fresh() {
    cells.forEach(freshCell);
    ROT_START.forEach(([c, r]) => { get(c, r).rot = true; });
    START_OWN.forEach(([c, r]) => { get(c, r).own = true; });
    S = { time: 0, gold: 20, food: 12, logs: 0, seed: 0, saplings: 0, workers: [], fx: [], tech: {}, seasonCount: 0, log: [], nextId: 1, bought: 0,
      mealT: 0, warmT: 0, nurseT: 0, flood: 0, boat: BOAT_STAY, graves: [], dead: 0, over: null, keep: { logs: 30, food: 10 }, cut: 'last', started: false };
    toasts.length = 0;
    addWorker();
    redraw();
  }
  const seasonOf = (n) => n % 4;
  const season = () => seasonOf(S.seasonCount);
  const winter = () => season() === WINTER;
  const into = () => S.time - S.seasonCount * SEASON_LEN;
  function say(m) { S.log.unshift(m); S.log.length = Math.min(S.log.length, 3); }
  function notice(m, bad) { say(m); toasts.unshift({ text: m, bad, until: performance.now() + (bad ? 15000 : 8000) }); toasts.length = Math.min(toasts.length, 3); }
  function fx(t, text, color) { const p = center(t); S.fx.push({ x: p.x, y: p.y - 10, text, color, t: 0 }); }
  function refreshSeen() { const own = cells.filter((t) => t.own); cells.forEach((t) => { t.seen = own.some((o) => dist(o, t) <= 2); }); }
  function colour() {
    const land = cells.filter((t) => !['lake', 'scenery'].includes(t.kind));
    return Math.round((land.filter(alive).length / land.length) * 100);
  }

  // ---------- save ----------
  const SAVE = 'hexciv-v3-archive-save';
  const CELL_KEYS = ['rot', 'own', 'plan', 'prio', 'work', 'grow', 'age', 'dry', 'wilt', 'regrow', 'held', 'stumpAge', 'tire', 'soil', 'food', 'water', 'cover', 'dead', 'stumps', 'wood', 'river', 'marsh'];
  const idx = (t) => (t ? cells.indexOf(t) : -1);
  function save() {
    if (!S || !S.started) return; // a valley shown behind the menu is not a saved game until you play it
    const data = { ...S, fx: [], cells: cells.map((t) => CELL_KEYS.map((k) => (typeof t[k] === 'number' ? Math.round(t[k] * 10) / 10 : t[k]))),
      workers: S.workers.map((w) => ({ id: w.id, name: w.name, hue: w.hue, role: w.role, xp: w.xp, at: idx(w.at), hungry: w.hungry, hunger: w.hunger, cold: w.cold, chill: w.chill, sick: w.sick })) };
    try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) { /* no storage: the game still plays, it just won't resume */ }
  }
  function loadSave() { try { const v = localStorage.getItem(SAVE); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function load(d) {
    cells.forEach((t, i) => CELL_KEYS.forEach((k, j) => { t[k] = d.cells[i][j]; }));
    S = { ...d, fx: [], workers: [] };
    delete S.cells;
    d.workers.forEach((w) => { const at = cells[w.at], p = center(at); S.workers.push({ ...w, at, x: p.x, y: p.y, path: [], seg: 0, job: null, task: null, carry: null, timer: 0 }); });
    toasts.length = 0;
    redraw();
  }

  // ---------- paths ----------
  const floods = () => (S.flood > 0 ? S.floodSet || [] : []);
  const passable = (t) => t.seen && moveCost(t) > 0 && !floods().includes(idx(t));
  function dijkstra(from) {
    const cost = new Map([[from, 0]]), prev = new Map(), open = [from];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (cost.get(open[i]) < cost.get(open[bi])) bi = i;
      const t = open.splice(bi, 1)[0];
      for (const n of nbs(t)) {
        if (!passable(n)) continue;
        const v = cost.get(t) + moveCost(n) + (n.rot ? 8 : 0); // walk around the rot where there is a way
        if (!cost.has(n) || v < cost.get(n)) { cost.set(n, v); prev.set(n, t); open.push(n); }
      }
    }
    return { cost, prev };
  }

  // ---------- what each tile needs next ----------
  const has = (id) => !!S.tech[id];
  const inSeason = (j) => JOB[j].seasons.includes(season());
  const stocked = (j) => Object.entries(JOB[j].uses || {}).every(([k, n]) => S[k] >= n);
  // The next land step on a tile, from its plan and its values. Rot always comes first.
  function landStep(t) {
    if (!t.own || t === DOCK) return null;
    if (t.rot) return t.kind === 'mine' ? null : 'burn';
    if (t.kind === 'marsh') return t.plan === 'marsh' && t.marsh === 'drained' ? 'block' : null;
    if (t.kind === 'river') return t.plan === 'river' && t.river === 'dirty' ? 'reedbed' : null;
    if (!isLand(t) || !t.plan || t.plan === 'rest') return null;
    if (t.dead) return null; // the woodcutters clear deadwood first
    if (t.plan === 'forest') {
      if (t.soil < 1) return 'loosen';
      if (t.food < 2) return has('compost') && S.food >= 4 + S.keep.food ? 'compost' : 'mulch';
      if (t.cover === 'bare' || t.cover === 'grass' || t.cover === 'clover') return 'plant';
      return null;
    }
    if (t.stumps) return 'pull';
    if (t.soil < 2) return 'loosen';
    if (t.food < 2) return has('compost') && S.food >= 4 + S.keep.food ? 'compost' : 'mulch';
    if (t.cover === 'bare') return 'sow';
    return null;
  }
  // The steps of a plan as chips: [name, done, step id]
  function chips(t) {
    if (t.kind === 'marsh') return [['Block ditches', t.marsh !== 'drained', 'block'], ['Spring flood', t.marsh === 'healed', null]];
    if (t.kind === 'river') return [['Reed bed', t.river === 'clean', 'reedbed']];
    const planted = !['bare', 'grass', 'clover'].includes(t.cover) || false;
    if (t.plan === 'forest') return [['Clear', !t.dead, null], ['Loosen', t.soil >= 1, 'loosen'], ['Feed', t.food >= 2, 'mulch'], ['Plant', planted, 'plant'], ['Grow', TREES.has(t.cover), null]];
    if (t.plan === 'field') return [['Clear', !t.dead, null], ['Pull stumps', !t.stumps, 'pull'], ['Loosen', t.soil >= 2, 'loosen'], ['Feed', t.food >= 2, 'mulch'], ['Sow clover', t.cover !== 'bare', 'sow'], ['Grow', ['grass', 'meadow'].includes(t.cover), null]];
    return [];
  }
  // Why a planned tile is stuck, if it is: 'season', 'tech', 'stock', 'hands', or null
  function stall(t) {
    if (!t.own || !t.plan || t.plan === 'rest') return null;
    const j = landStep(t);
    if (!j) return null;
    if (JOB[j].tech && !has(JOB[j].tech)) return 'tech';
    if (j === 'reedbed' && !cells.some((o) => o.own && o.kind === 'marsh' && o.marsh === 'healed')) return 'tech';
    if (!inSeason(j)) return 'season';
    if (!stocked(j)) return 'stock';
    if (!S.workers.some((w) => effRole(w) === 'land')) return 'hands';
    return null;
  }

  // ---------- workers and crews ----------
  function addWorker() {
    const p = center(DOCK), used = new Set(S.workers.map((w) => w.name));
    const name = NAMES.find((n) => !used.has(n)) || `Worker ${S.nextId}`;
    S.workers.push({ id: S.nextId++, name, role: null, xp: {}, at: DOCK, x: p.x, y: p.y, path: [], seg: 0, job: null, task: null, carry: null, timer: 0,
      hungry: false, hunger: 0, cold: false, chill: 0, sick: 0, hue: HUES[(S.nextId - 2) % HUES.length] });
  }
  function hire() {
    const c = hireCost(); if (S.gold < c || S.over) return;
    S.gold -= c; addWorker();
    say(`${S.workers[S.workers.length - 1].name} joins the crew for ${c} gold.`);
  }
  const crew = (role) => S.workers.filter((w) => w.role === role);
  const idle = () => S.workers.filter((w) => !w.role);
  function setRole(w, role) { w.role = role; w.task = null; if (!w.carry || w.carry.kind === 'water') { w.carry = null; w.job = null; w.path = w.path.slice(0, 1); } }
  function addTo(role) { // the idle worker most practised in this work joins
    const free = idle(); if (!free.length) return;
    free.sort((a, b) => (b.xp[role] || 0) - (a.xp[role] || 0));
    setRole(free[0], role);
  }
  function takeFrom(role) { const c = crew(role); if (c.length) setRole(c.sort((a, b) => (a.xp[role] || 0) - (b.xp[role] || 0))[0], null); }
  // A crew without work in its own season helps elsewhere: carriers dig outside summer, the land crew fells in winter.
  function effRole(w) {
    if (w.role === 'water' && season() !== SUMMER) return 'land';
    if (w.role === 'land' && winter()) return 'wood';
    return w.role;
  }
  const skill = (w, role) => Math.min(3, Math.floor((w.xp[role] || 0) / 150));
  const speedOf = (w) => (w.hungry || w.cold ? 0.5 : w.sick > SICKEN / 4 ? 0.7 : 1) * (1 + 0.15 * skill(w, effRole(w) || 'land'));
  const busy = (t, w) => S.workers.filter((o) => o !== w && o.task === t).length;
  const cutLimit = (t) => (S.cut === 'third' ? Math.ceil(WOOD[t.cover] / 3) : S.cut === 'dead' ? Infinity : 0);
  // What this worker should do next: the highest-priority task their crew can do now, nearest first.
  function pickTask(w, D) {
    const role = effRole(w), seen = cells.filter((t) => t.own && t.seen && D.cost.has(t));
    const best = (list) => list.sort((a, b) => b.score - a.score)[0] || null;
    const d = (t) => D.cost.get(t);
    if (role === 'land') {
      const out = [];
      for (const t of seen) {
        const j = landStep(t);
        if (!j || (JOB[j].tech && !has(JOB[j].tech)) || !inSeason(j) || !stocked(j) || busy(t, w) >= 3) continue;
        if (j === 'burn' && w.sick > SICKEN * 0.3) continue; // rest away from the rot before the next burn
        if (j === 'reedbed' && !cells.some((o) => o.own && o.kind === 'marsh' && o.marsh === 'healed')) continue;
        out.push({ t, job: j, score: (j === 'burn' ? 5 : t.prio) * 1000 - d(t) });
      }
      if (season() === AUTUMN && has('seeds') && S.seed < 12) for (const t of seen) if (isForest(t) && busy(t, w) < 2) out.push({ t, job: 'seed', score: 500 - d(t) });
      return best(out);
    }
    if (role === 'wood') {
      const out = [];
      for (const t of seen) {
        if (busy(t, w) >= 3 || t.rot) continue;
        if (t.dead) out.push({ t, job: 'clear', score: 2000 - d(t) });
        else if (isForest(t) && t.plan !== 'rest' && t.wood > cutLimit(t)) out.push({ t, job: 'fell', score: 1000 - d(t) });
      }
      return best(out);
    }
    if (role === 'water') {
      const out = [];
      for (const t of seen) if (isLand(t) && !t.rot && t.water < 2 && (PLANTS.has(t.cover) || (t.plan && t.plan !== 'rest')) && busy(t, w) < 2) out.push({ t, job: 'water', score: (2 - t.water) * 1000 + (PLANTS.has(t.cover) ? 500 : 0) - d(t) });
      return best(out);
    }
    if (role === 'food') {
      const out = [];
      for (const t of seen) {
        if (busy(t, w) >= 2 || t.rot) continue;
        const fish = t.kind === 'beach' && t !== DOCK || (t.kind === 'pond' && !winter()) || (t.kind === 'river' && t.river === 'clean');
        if (fish) out.push({ t, job: 'fish', score: 1000 - d(t) });
        else if (has('farms') && !winter() && isLand(t) && t.plan === 'field' && ['grass', 'meadow'].includes(t.cover) && t.food >= 2) out.push({ t, job: 'farm', score: 1200 - d(t) });
      }
      return best(out);
    }
    return null;
  }
  function go(w, D, t, job) {
    if (!D.cost.has(t)) { w.job = 'wait'; w.timer = 1; return; }
    const path = []; let k = t; while (k !== w.at) { path.unshift(k); k = D.prev.get(k); }
    w.path = path; w.seg = 0; w.job = job; w.target = t;
    if (!path.length) arrive(w);
  }
  const SOURCES = (t) => t.kind === 'pond' || t.kind === 'beach' || (t.kind === 'river' && t.river === 'clean');
  function plan(w) {
    const D = dijkstra(w.at);
    if (w.carry && w.carry.kind !== 'water') return go(w, D, DOCK, 'deliver');
    if (w.carry && w.carry.kind === 'water' && w.task) return go(w, D, w.task, 'pour');
    const pick = w.role ? pickTask(w, D) : null;
    if (pick) {
      w.task = pick.t; w.taskJob = pick.job;
      if (pick.job === 'water') { // fetch water from the nearest clean source first
        let src = null; for (const t of cells) if (SOURCES(t) && D.cost.has(t) && (!src || D.cost.get(t) < D.cost.get(src))) src = t;
        if (!src) { w.task = null; w.job = 'wait'; w.timer = 2; return; }
        return go(w, D, src, 'fill');
      }
      return go(w, D, pick.t, 'work');
    }
    w.task = null;
    if (w.at !== DOCK) return go(w, D, DOCK, 'home');
    w.job = 'wait'; w.timer = 1.5;
  }
  const chopTime = () => CHOP_TIME / (has('axes') ? 2 : 1);
  function arrive(w) {
    const j = w.taskJob;
    if (w.job === 'work') { w.job = 'working'; w.timer = j === 'fish' ? FISH_TIME / (has('fishing') ? 2 : 1) : j === 'farm' ? FARM_TIME : j === 'seed' ? SEED_TIME : chopTime(); }
    else if (w.job === 'fill') { w.job = 'filling'; w.timer = 1; }
    else if (w.job === 'pour') { const t = w.target; t.water = Math.min(2, t.water + w.carry.n); t.wilt = 0; t.dry = 0; fx(t, 'watered', '#a9d5f0'); w.carry = null; w.task = null; w.job = null; }
    else if (w.job === 'deliver') {
      const { kind, n } = w.carry; S[kind] += n; fx(DOCK, `+${n} ${kind === 'logs' ? 'log' : kind}`, '#e2bd78'); w.carry = null; w.job = null;
    } else w.job = null;
  }
  function stepWorker(w, dt) {
    dt *= speedOf(w);
    if (w.path.length) {
      const n = w.path[0], a = center(w.at), b = center(n);
      if (!passable(n)) { w.path = []; w.job = null; return; }
      w.seg += dt / (STEP * moveCost(n) * (winter() ? SNOW : 1));
      if (w.seg >= 1) { w.at = n; w.path.shift(); w.seg = 0; w.x = b.x; w.y = b.y; if (!w.path.length) arrive(w); }
      else { w.x = a.x + (b.x - a.x) * w.seg; w.y = a.y + (b.y - a.y) * w.seg; }
      return;
    }
    if (w.job === 'filling') { w.timer -= dt; if (w.timer <= 0) { w.carry = { kind: 'water', n: has('yokes') ? 2 : 1 }; w.job = null; } return; }
    if (w.job === 'working') {
      const t = w.target, j = w.taskJob, role = effRole(w);
      w.xp[role] = (w.xp[role] || 0) + dt;
      if (j === 'clear' || j === 'fell') {
        if (role !== 'wood' || (j === 'clear' ? !t.dead : t.wood <= cutLimit(t) || !isForest(t))) { w.job = null; w.task = null; return; }
        w.timer -= dt;
        if (w.timer <= 0) { w.carry = { kind: 'logs', n: 1 }; fx(t, '+1 log', '#e2bd78'); w.job = null; w.task = null; cut(t, j); }
      } else if (j === 'seed') {
        if (season() !== AUTUMN || !isForest(t)) { w.job = null; w.task = null; return; }
        w.timer -= dt;
        if (w.timer <= 0) { w.carry = { kind: 'seed', n: 2 }; fx(t, '+2 seed', '#9bcb3e'); w.job = null; w.task = null; }
      } else if (j === 'fish' || j === 'farm') {
        if (role !== 'food' || (j === 'farm' && (winter() || t.food < 2)) || (j === 'fish' && t.kind === 'pond' && winter())) { w.job = null; w.task = null; return; }
        w.timer -= dt;
        if (w.timer <= 0) {
          w.timer = j === 'fish' ? FISH_TIME / (has('fishing') ? 2 : 1) : FARM_TIME; S.food++; fx(t, '+1 food', '#a9d5f0');
          if (j === 'farm' && ++t.tire >= 12) { t.tire = 0; t.food--; } // every harvest tires the soil a little
        }
      } else if (JOB[j]) {
        if (role !== 'land' || landStep(t) !== j || !inSeason(j)) { w.job = null; w.task = null; return; }
        t.work += dt * (j === 'loosen' && !has('hoes') ? 0.5 : 1) * (j === 'loosen' && season() === SUMMER ? 0.5 : 1);
        if (t.work >= JOB[j].work) { if (stocked(j)) finish(t, j); else t.work = JOB[j].work; }
      }
      return;
    }
    if (w.job === 'wait') { w.timer -= dt; if (w.timer <= 0) w.job = null; return; }
    if (!w.job) plan(w);
  }
  function die(w, cause) {
    const where = placeOf(w.at);
    const text = {
      hunger: `${w.name} starved ${where}.`,
      cold: `${w.name} died of cold ${where}.`,
      rot: w.at.rot && w.at !== DOCK ? `${w.name} fell sick working in the rot and did not recover.` : `${w.name} fell sick from the rot ${where} and did not recover.`,
      flood: `${w.name} drowned in the spring flood ${where}.`,
    }[cause];
    S.workers.splice(S.workers.indexOf(w), 1);
    S.graves.push({ x: Math.round(w.x), y: Math.round(w.y), name: w.name, role: w.role, season: S.seasonCount });
    S.dead++;
    notice(text, true);
    if (!S.workers.length) end(text);
  }

  // ---------- needs ----------
  function stepNeeds(dt) {
    const win = winter();
    S.mealT += dt * (win && !has('smoke') ? 2 : 1);
    const meal = S.mealT >= MEAL; if (meal) S.mealT -= MEAL;
    let burn = false;
    if (win) { S.warmT += dt; if (S.warmT >= WARM) { S.warmT -= WARM; burn = true; } } else S.warmT = 0;
    for (const w of [...S.workers]) {
      if ((meal || w.hungry) && S.food >= 1) { S.food--; w.hungry = false; w.hunger = 0; } else if (meal) w.hungry = true;
      if (w.hungry) { w.hunger += dt; if (w.hunger >= STARVE) { die(w, 'hunger'); continue; } }
      if (win) {
        if ((burn || w.cold) && S.logs >= 1) { S.logs--; w.cold = false; w.chill = 0; } else if (burn) w.cold = true;
        if (w.cold) { w.chill += dt; if (w.chill >= FREEZE) { die(w, 'cold'); continue; } }
      } else { w.cold = false; w.chill = 0; }
      const exposure = w.at === DOCK ? 0 : w.at.rot ? (w.taskJob === 'burn' ? 0.6 : 1) : nbs(w.at).some((n) => n.rot) ? 0.4 : 0; // a fire keeps the worst off
      if (exposure) { w.sick += dt * exposure; if (w.sick >= SICKEN) { die(w, 'rot'); continue; } }
      else w.sick = Math.max(0, w.sick - dt * 0.5);
    }
  }

  // ---------- land ----------
  function cut(t, j) {
    if (j === 'clear') { t.dead--; if (!t.dead) { changed(); } return; }
    t.wood--; t.regrow = 0;
    if (t.cover === 'forest' && t.wood < WOOD.forest / 3) { t.cover = 'pines'; t.age = 0; changed(); } // old forest cut below a third thins to a pine stand
    if (t.wood > 0) return;
    const was = nameOf(t);
    t.cover = 'bare'; t.stumps = true; t.stumpAge = 0; t.food = Math.max(0, t.food - 1);
    if (t.own) notice(`The ${lower(was)} was cut to the last log. Only stumps are left.`);
    changed();
  }
  function finish(t, j) {
    t.work = 0;
    Object.entries(JOB[j].uses || {}).forEach(([k, n]) => { S[k] -= n; });
    if (j === 'loosen') t.soil = Math.min(2, t.soil + 1);
    else if (j === 'mulch') t.food = Math.min(2, t.food + 1);
    else if (j === 'compost') t.food = Math.min(3, t.food + 2);
    else if (j === 'plant') { t.cover = 'seedlings'; t.grow = 0; }
    else if (j === 'sow') { t.cover = 'clover'; t.grow = 0; }
    else if (j === 'pull') { t.stumps = false; S.logs += 6; fx(DOCK, '+6 logs', '#e2bd78'); }
    else if (j === 'burn') { t.rot = false; t.held = false; t.food = 0; t.cover = isLand(t) ? 'bare' : t.cover; t.wood = 0; if (t.kind === 'river' && t.river === 'clean') t.river = 'dirty'; }
    else if (j === 'block') t.marsh = 'blocked';
    else if (j === 'reedbed') { t.river = 'clean'; t.plan = null; }
    fx(t, JOB[j].name.toLowerCase(), '#9bcb3e');
    if (j === 'block' || j === 'reedbed' || (isLand(t) && !landStep(t) && j !== 'burn')) { /* plan reached its waiting stage */ }
    changed();
  }
  let dirty = true;
  const changed = () => { dirty = true; };
  function stepLand(dt) {
    const s = season(), g = GROWTH[s];
    for (const t of cells) {
      if (!isLand(t) || t.rot) continue;
      // summer drying and wilting
      if (s === SUMMER) {
        const shelter = nbs(t).some((n) => (n.kind === 'river' && n.river === 'clean') || n.kind === 'pond' || isForest(n));
        const floor = has('ditches') && shelter ? 1 : 0;
        if (t.water > floor) {
          t.dry += dt * (has('swales') && t.own ? 0.5 : 1) * (shelter ? 0.5 : 1);
          if (t.dry >= DRY) { t.dry = 0; t.water--; changed(); }
        }
        if (PLANTS.has(t.cover) && t.water === 0) {
          t.wilt += dt;
          if (t.wilt >= WILT) {
            t.wilt = 0; const was = nameOf(t);
            t.cover = t.cover === 'young' ? 'seedlings' : 'bare'; t.grow = 0;
            if (t.own) notice(`The ${lower(was)} dried out.`);
            changed();
          }
        } else t.wilt = 0;
      }
      if (!g) continue; // nothing grows in winter
      const wet = t.water >= 1 || s !== SUMMER, gd = dt * g;
      if (t.cover === 'seedlings' && wet && t.food >= 1) { t.grow += gd; if (t.grow >= SEEDLING_GROW) { t.cover = 'young'; t.grow = 0; changed(); } }
      else if (t.cover === 'young' && wet) { t.grow += gd; if (t.grow >= YOUNG_GROW) { t.cover = 'pines'; t.wood = NEW_STAND; t.grow = 0; t.age = 0; t.stumps = false; t.soil = 2; changed(); if (t.seen) fx(t, 'a pine stand', '#9bcb3e'); } }
      else if (t.cover === 'clover' && wet) { t.grow += gd; if (t.grow >= CLOVER_GROW) { t.cover = 'grass'; t.food = Math.min(3, t.food + 1); t.grow = 0; changed(); } }
      else if (TREES.has(t.cover) && !S.workers.some((w) => w.task === t && w.taskJob === 'fell')) {
        if (t.wood < WOOD[t.cover]) { t.regrow += gd; if (t.regrow >= REGROW) { t.regrow = 0; t.wood++; } }
        if (t.cover === 'pines' && t.wood >= 45) { t.age += gd; if (t.age >= OLD_GROW) { t.cover = 'forest'; t.age = 0; changed(); } }
      } else if (t.cover === 'bare' && !t.dead && t.own && t.soil >= 1 && t.food >= 1 && t.plan !== 'forest' && nbs(t).some((n) => living(n) && n !== DOCK && n.kind !== 'scenery')) {
        t.grow += gd; if (t.grow >= GRASS_CREEP) { t.cover = 'grass'; t.grow = 0; changed(); }
      }
      if (t.stumps && t.cover !== 'bare') { t.stumpAge += gd; if (t.stumpAge >= STUMP_ROT) { t.stumps = false; changed(); } }
      else if (t.stumps) { t.stumpAge += gd; if (t.stumpAge >= STUMP_ROT) { t.stumps = false; changed(); } }
    }
    // the nursery raises seed into saplings
    if (has('nursery') && S.seed > 0 && (g || has('frames'))) {
      S.nurseT += dt * (g || 0.5);
      if (S.nurseT >= NURSERY) { S.nurseT = 0; S.seed--; S.saplings++; fx(DOCK, '+1 sapling', '#9bcb3e'); }
    }
  }
  // Rot spreads from the mine through every rot tile still joined to it, one tile a season outside winter, toward the dock.
  function spreadRot() {
    const mine = cells.find((t) => t.kind === 'mine'), live = new Set([mine]), q = [mine];
    while (q.length) for (const n of nbs(q.shift())) if (n.rot && !live.has(n)) { live.add(n); q.push(n); }
    const cand = new Set();
    live.forEach((t) => nbs(t).forEach((n) => { if (!n.rot && n.kind !== 'lake') cand.add(n); }));
    const n = [...cand].sort((a, b) => dist(a, DOCK) - dist(b, DOCK) || b.r - a.r || a.c - b.c)[0];
    if (!n) return;
    const holds = isForest(n) || (n.kind === 'river' && n.river === 'clean') || (n.kind === 'marsh' && n.marsh === 'healed');
    if (holds && !n.held) { n.held = true; if (n.seen) fx(n, 'holding', '#9bcb3e'); return; }
    const was = nameOf(n);
    n.rot = true; n.held = false;
    if (isLand(n)) { n.cover = 'bare'; n.wood = 0; }
    if (n.kind === 'river' && n.river === 'clean') n.river = 'dirty';
    if (n.own) notice(`Rot reached the ${lower(was)}.`);
    changed();
  }
  function spreadDust() {
    const dust = (t) => isLand(t) && !t.rot && t.soil === 0 && t.food === 0 && t.cover === 'bare';
    const cand = new Set();
    cells.forEach((t) => { if (dust(t)) nbs(t).forEach((n) => { if (isLand(n) && !n.rot && !dust(n) && (n.cover === 'bare' || n.cover === 'grass') && n.food <= 1 && !n.dead) cand.add(n); }); });
    const n = [...cand].sort((a, b) => dist(a, DOCK) - dist(b, DOCK) || a.c - b.c)[0];
    if (!n) return;
    const was = nameOf(n);
    Object.assign(n, { soil: 0, food: 0, water: 0, cover: 'bare', grow: 0 });
    if (n.own) notice(`Dust blew onto the ${lower(was)}.`);
    changed();
  }
  function startFlood() {
    cells.forEach((t) => { if (t.kind === 'marsh' && t.marsh === 'blocked') { t.marsh = 'healed'; t.plan = null; if (t.own) notice('The spring water stayed in the marsh. It is coming back to life.'); } });
    const set = cells.filter((t) => (t.kind === 'marsh' && t.marsh === 'drained') || (t.kind !== 'lake' && nbs(t).some((n) => n.kind === 'marsh' && n.marsh === 'drained')));
    S.floodSet = set.map(idx);
    S.flood = set.length ? FLOOD : 0;
    for (const w of [...S.workers]) if (set.includes(w.at) || (w.path[0] && set.includes(w.path[0]) && w.seg > 0.5)) die(w, 'flood');
    cells.forEach((t) => { if (isLand(t) && !t.rot) t.water = Math.max(t.water, 1); }); // spring rain
    changed();
  }

  // ---------- land and trade ----------
  const touches = (t) => nbs(t).some((n) => n.own);
  function price(t) {
    let v = VALUE[t.b0] || 10;
    if (t.rot) v = 0;
    else if (isLand(t) && !alive(t)) v = t.dead ? 6 : 3;
    else if (t.kind === 'river' && t.river !== 'clean') v = 6;
    else if (t.kind === 'marsh' && t.marsh !== 'healed') v = 6;
    else if (t.kind === 'mine') v = 30;
    return 10 + 5 * S.bought + v;
  }
  const canOwn = (t) => t && !t.own && t.seen && t.kind !== 'lake' && touches(t);
  function buy(t) {
    if (!canOwn(t) || S.gold < price(t)) return;
    S.gold -= price(t); S.bought++; t.own = true;
    say(`You bought the ${lower(nameOf(t))}.`);
    refreshSeen(); changed();
  }
  const surplus = (k) => Math.max(0, S[k] - S.keep[k]);
  function sellSurplus() {
    if (S.boat <= 0) return;
    const l = surplus('logs'), f = surplus('food'), g = l * LOG_PRICE + f * FOOD_PRICE;
    if (!g) return;
    S.logs -= l; S.food -= f; S.gold += g; fx(DOCK, `+${g}g`, '#e6c35a');
  }
  function buyStock(k, n) { // from the trader's boat
    if (S.boat <= 0) return;
    n = Math.min(n, Math.floor(S.gold / BUY_PRICE[k])); if (n <= 0) return;
    S.gold -= n * BUY_PRICE[k]; S[k] += n; fx(DOCK, `+${n} ${k}`, '#f4f6ea'); changed();
  }
  function topUp() { ['logs', 'food'].forEach((k) => { if (S[k] < S.keep[k]) buyStock(k, S.keep[k] - S[k]); }); }
  function sell(k, n) { if (S.boat <= 0) return; n = Math.min(n, S[k]); if (n <= 0) return; S[k] -= n; const g = n * (k === 'logs' ? LOG_PRICE : FOOD_PRICE); S.gold += g; fx(DOCK, `+${g}g`, '#e6c35a'); }
  function newSeason() {
    const s = season();
    if (s !== WINTER) { S.boat = BOAT_STAY; spreadRot(); if (has('trade')) { sellSurplus(); topUp(); } }
    if (s === SUMMER) spreadDust();
    if (s === SPRING) startFlood();
    if (s === AUTUMN && S.logs < S.workers.length * (SEASON_LEN / WARM)) notice(`The woodpile is low. Winter takes about ${S.workers.length * (SEASON_LEN / WARM)} logs for ${S.workers.length === 1 ? 'one' : S.workers.length}.`, true);
    save();
  }
  function end(text) {
    S.over = { text, season: SEASONS[season()].toLowerCase(), year: Math.floor(S.seasonCount / 4) + 1, colour: colour(), dead: S.dead };
    save();
    showEnd();
  }

  // ---------- art: the land as its values ----------
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
  const fade = (h, k) => once(`f${h}${k}`, () => { const [r, g, b] = rgb(h), l = r * 0.3 + g * 0.59 + b * 0.11; return hex([r + (l * 1.04 + 10 - r) * k, g + (l * 0.98 + 2 - g) * k, b + (l * 0.86 - 8 - b) * k]); });
  const mix = (h, h2, k) => once(`m${h}${h2}${k}`, () => { const a = rgb(h), b = rgb(h2); return hex(a.map((v, i) => v + (b[i] - v) * k)); });
  const WATER2 = '#4b86c9', ROT = '#4a3b55', ROT_HI = '#6b5a7a';
  const GREENS = (grass, lime, leaf, pine, flower) => ({ [C.grass]: grass, [C.lime]: lime, [C.leaf]: leaf, [C.pine]: pine, [C.glow]: flower, [C.rose]: flower, [C.sage]: lime });
  const GROUND = { // bare ground by how much food it holds
    dust: GREENS(C.sand1, C.clay, C.clay, C.soil, C.sand0),
    poor: GREENS(C.clay, C.sand1, C.soil, C.bark, C.sand1),
    fed: GREENS(C.soil, C.clay, C.bark, C.bark, C.clay),
  };
  const RIVER_LOOK = {
    dirty: { ...GREENS(C.olive, C.olive, C.olive2, C.pine, C.clay), [C.sky]: C.murk, [WATER2]: C.murk2, [C.mist]: C.sage },
    dry: { ...GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay), [C.sky]: C.sand1, [WATER2]: C.clay, [C.mist]: C.stone },
    dam: GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay),
  };
  const MARSH_LOOK = { ...GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay), [C.murk]: C.bark, [C.murk2]: '#2a1e22', [C.olive]: C.soil, [C.olive2]: C.bark };
  const STUMPS = [[8, 7], [16, 6], [23, 8], [6, 14], [14, 13], [22, 15], [10, 20], [19, 21]];
  const LOGS = [[6, 9, 7], [16, 13, 6], [8, 19, 6], [18, 21, 7]];
  const CRACKS = [[[6, 10], [7, 10], [8, 11], [9, 12], [9, 13], [11, 14]], [[18, 6], [19, 7], [20, 8], [22, 8]], [[15, 18], [16, 19], [17, 20], [16, 21], [17, 22], [19, 23]], [[23, 14], [24, 15], [25, 16], [27, 17]]];
  const SPOTS = [[9, 10], [19, 9], [14, 16], [23, 17], [8, 20], [17, 22], [13, 6], [25, 11]];
  const lookOf = (t) => (t.kind === 'land' ? (['pines', 'forest', 'grove', 'meadow', 'grass'].includes(t.cover) ? t.cover : 'grass')
    : t.kind === 'river' ? 'river' : t.kind === 'marsh' ? 'swamp' : t.kind === 'mine' ? 'mountains' : t.b0);
  function paintTile(t, v, ctx) {
    const look = lookOf(t), cv = X.cloverTile(look, v, ctx).cv, orig = cv.px.slice();
    const at = (x, y, c) => cv.set(x, y + X.FY, c);
    const recolor = (map) => { cv.px = cv.px.map((c) => c && (map[c] || c)); };
    let k = 0;
    if (t.kind === 'land') {
      const bare = !['pines', 'forest', 'grove', 'meadow', 'grass'].includes(t.cover);
      if (bare) recolor(t.soil === 0 && t.food === 0 ? GROUND.dust : t.food >= 2 ? GROUND.fed : GROUND.poor);
      if (bare) {
        if (t.soil === 0) CRACKS.forEach((line) => line.forEach(([x, y]) => at(x, y, C.soil)));
        if (t.soil === 2) for (const y of [7, 11, 15, 19, 23]) for (let x = 5; x < 27; x++) if (X.inFace(x, y) && (x + y) % 5) at(x, y, t.food >= 2 ? C.bark : C.soil); // furrows
        if (t.food >= 2) SPOTS.forEach(([x, y]) => { at(x, y, C.olive2); at(x + 1, y, C.olive); }); // mulch
        if (t.d0 === 'U' && key(t.c, t.r) === HOUSE) { // the settlers' farmhouse, roof fallen in
          for (let x = 11; x < 20; x++) for (let y = 11; y < 17; y++) at(x, y, y === 16 ? C.ink : x === 11 || x === 19 ? C.ink : C.pale);
          for (let x = 12; x < 17; x++) at(x, 10 - Math.min(x - 12, 16 - x), C.bark);
          at(14, 14, C.ink); at(15, 14, C.ink); at(14, 15, C.ink); at(15, 15, C.ink); at(17, 12, C.ink);
        }
      }
      const dryLeaf = season() === SUMMER && t.water === 0;
      const leafA = dryLeaf ? C.glow : C.lime, leafB = dryLeaf ? C.clay : C.grass;
      if (t.cover === 'seedlings') SPOTS.slice(0, 6).forEach(([x, y]) => { at(x, y, C.soil); at(x, y - 1, leafB); at(x - 1, y - 2, leafA); at(x + 1, y - 2, leafA); at(x, y - 2, leafB); });
      if (t.cover === 'young') SPOTS.slice(0, 6).forEach(([x, y]) => { for (let i = 0; i < 4; i++) { at(x - 1, y - 2 - i, i % 2 ? leafB : C.pine); at(x, y - 2 - i, leafB); at(x + 1, y - 2 - i, i % 2 ? C.pine : leafA); } at(x, y - 6, leafA); at(x, y - 1, C.bark); at(x, y, C.bark); });
      if (t.cover === 'clover') for (let y = 2; y < 26; y++) for (let x = 3; x < 29; x++) if (X.inFace(x, y) && (x * 5 + y * 3) % 7 === 0) at(x, y, (x + y) % 3 ? leafB : C.cloud);
      if (t.stumps) STUMPS.forEach(([x, y]) => { at(x, y, C.clay); at(x + 1, y, C.sand0); at(x + 2, y, C.clay); at(x, y + 1, C.soil); at(x + 1, y + 1, C.soil); at(x + 2, y + 1, C.bark); at(x, y + 2, C.bark); at(x + 1, y + 2, C.bark); at(x + 2, y + 2, C.ink); });
      if (t.dead) {
        LOGS.forEach(([x, y, n]) => { for (let i = 0; i < n; i++) { at(x + i, y, C.pale); at(x + i, y + 1, C.stone); at(x + i, y + 2, C.ink); } at(x + n, y, C.ink); at(x + n, y + 1, C.ink); });
        for (let y = -4; y < 12; y++) { at(23, y, C.pale); at(24, y, C.stone); }
        at(21, 0, C.pale); at(22, 1, C.pale); at(25, 3, C.stone); at(26, 2, C.stone);
      }
      // how faded a tile is: dead ground grey, fed ground warm, living tiles in full colour
      k = alive(t) ? (t.water === 0 ? 0.25 : 0) : t.dead ? 0.7 : [0.62, 0.5, 0.25, 0.15][t.food] + (t.cover === 'bare' ? 0 : -0.1);
      if (t.water === 0 && !alive(t)) k = Math.min(0.8, k + 0.08);
    } else if (t.kind === 'river' && t.river !== 'clean') {
      recolor(RIVER_LOOK[t.river]); k = 0.6;
      if (t.river === 'dry') for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) { if (orig[(y + X.FY) * cv.w + x] === C.sky && (x * 7 + y * 3) % 13 === 0) at(x, y, C.pale); }
      if (t.river === 'dam') {
        for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) {
          const o = orig[(y + X.FY) * cv.w + x];
          if (o === C.sky || o === WATER2 || o === C.mist) at(x, y, y < 12 ? (o === WATER2 ? C.murk2 : C.murk) : o === WATER2 ? C.clay : C.sand1);
        }
        for (let x = 2; x < 30; x++) if (X.inFace(x, 13)) { at(x, 12, C.ink); at(x, 13, C.clay); at(x, 14, C.soil); at(x, 15, C.ink); }
        for (const px0 of [6, 15, 24]) for (let y = 10; y < 16; y++) { at(px0, y, C.pale); at(px0 + 1, y, C.stone); }
      }
    } else if (t.kind === 'marsh' && t.marsh !== 'healed') {
      recolor(MARSH_LOOK); k = 0.62;
      if (t.marsh === 'blocked') for (let x = 4; x < 28; x++) if (X.inFace(x, 14)) { at(x, 13, C.clay); at(x, 14, C.soil); at(x, 15, C.ink); }
    } else if (t.kind === 'mine') {
      k = 0.45;
      for (let y = 10; y < 17; y++) for (let x = 13; x < 20; x++) at(x, y, x === 13 || x === 19 || y === 10 ? C.clay : C.ink);
      for (let y = 17; y < 27; y++) { const w = Math.max(1, 4 - Math.floor((y - 17) / 3)); for (let x = 16 - (w >> 1); x < 16 - (w >> 1) + w; x++) if (X.inFace(x, y)) at(x, y, (x + y) % 2 ? ROT : ROT_HI); }
      for (let x = 21; x < 25; x++) { at(x, 17, C.stone); at(x, 18, C.stone); } at(21, 19, C.ink); at(24, 19, C.ink);
    } else if (t.kind === 'scenery') k = 0.65;
    if (k > 0) cv.px = cv.px.map((c) => c && fade(c, Math.round(k * 20) / 20));
    if (t.rot) cv.px = cv.px.map((c, i) => { if (!c) return c; const x = i % cv.w, y = Math.floor(i / cv.w); return (x * 3 + y * 5) % 7 === 0 ? ROT_HI : mix(c, ROT, 0.6); });
    return cv;
  }

  // ---------- render ----------
  const canvas = document.getElementById('map'), cx = canvas.getContext('2d'), tip = document.getElementById('tip');
  const scene = document.createElement('canvas'), sx = scene.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  let R, scale = 2, offX = 0, offY = 0, dpr = 1, hover = null, sel = null, anim = [], lens = null;
  const COLS = 16, ROWS = 11, MW = 24 * (COLS - 1) + 32, MH = X.FY + 28 * ROWS + 14 + 3;
  const sig = (t) => [lookOf(t), t.soil, t.food, t.water, t.cover, t.stumps, !!t.dead, t.rot, t.own, t.seen, t.river, t.marsh, alive(t), season() === SUMMER && t.water === 0].join();
  let sigs = [];
  function redraw() {
    refreshSeen();
    dirty = false;
    sigs = cells.map(sig);
    const ctxs = X.contexts({ cells: cells.map((t) => ({ c: t.c, r: t.r, b: lookOf(t) })), river: RIVER });
    const px = new Array(MW * MH).fill(null), drawn = new Int16Array(MW * MH).fill(-1), owner = new Int16Array(MW * MH).fill(-1);
    const order = cells.map((t, i) => ({ t, i, ...X.at(t.c, t.r) })).sort((a, b) => a.y - b.y || a.t.c - b.t.c);
    order.forEach(({ t, i, x: ox, y: oy }) => {
      const img = paintTile(t, (t.c * 5 + t.r * 3) % 2, ctxs.get(key(t.c, t.r)));
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = img.px[y * img.w + x]; if (c && ox + x < MW && oy + y < MH) { px[(oy + y) * MW + ox + x] = c; drawn[(oy + y) * MW + ox + x] = i; } }
      for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) if (X.inFace(x, y)) owner[(oy + X.FY + y) * MW + ox + x] = i;
    });
    R = { w: MW, h: MH, owner };
    base.width = scene.width = MW; base.height = scene.height = MH;
    const im = bx.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) {
      const c = px[i], o = i * 4; if (!c) continue;
      const v = rgb(c), t = cells[drawn[i]];
      let k = 1, add = [0, 0, 0];
      if (!t.seen) { k = 0.28; add = [20, 26, 38]; } // fog
      else if (!t.own && t.kind !== 'lake') k = 0.84;   // land you don't own is drawn a little dimmer
      im.data[o] = v[0] * k + add[0]; im.data[o + 1] = v[1] * k + add[1]; im.data[o + 2] = v[2] * k + add[2]; im.data[o + 3] = 255;
    }
    const lit = (i, c) => { const o = i * 4; [im.data[o], im.data[o + 1], im.data[o + 2]] = rgb(c); };
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) { // your border: cream on your side, ink on the other
      const i = y * MW + x, a = owner[i]; if (a < 0) continue;
      const ta = cells[a];
      for (const j of [i - 1, i + 1, i - MW, i + MW]) {
        const b = owner[j]; if (b < 0 || b === a) continue;
        const tb = cells[b];
        if (ta.own && !tb.own && tb.kind !== 'lake') lit(i, '#f4f6ea');
        else if (!ta.own && tb.own && ta.kind !== 'lake' && ta.seen) lit(i, '#141d26');
      }
    }
    bx.putImageData(im, 0, 0);
    anim = [];
    cells.forEach((t) => { // life is motion: only living, visible tiles get glints and birds
      if (!t.seen || !living(t) || t === DOCK) return;
      const p = center(t), ph = (t.c * 7 + t.r * 13) % 10;
      if (['pond', 'river', 'lake', 'beach', 'marsh'].includes(t.kind)) anim.push({ kind: 'glint', x: p.x - 6 + (ph % 5) * 2, y: p.y - 3 + (ph % 3) * 2, ph }, { kind: 'glint', x: p.x + 3 - (ph % 4), y: p.y + 4 - (ph % 2) * 3, ph: ph + 3 });
      if (isForest(t)) anim.push({ kind: 'bird', x: p.x, y: p.y - 14, ph });
    });
    cells.forEach((t) => { if (t.kind === 'lake' && t.seen) { const p = center(t), ph = (t.c * 7 + t.r * 13) % 10; anim.push({ kind: 'glint', x: p.x - 4 + (ph % 5) * 2, y: p.y - 2 + (ph % 3) * 2, ph }); } });
    fit();
  }
  function fit() {
    if (!R) return;
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const vw = innerWidth, vh = innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    const s = Math.min(vw / R.w, vh / R.h);
    scale = s >= 2 ? Math.floor(s) : s;
    offX = Math.round((vw - R.w * scale) / 2); offY = Math.round((vh - R.h * scale) / 2);
  }
  const px = (x, y, w, h, c) => { sx.fillStyle = c; sx.fillRect(Math.round(x), Math.round(y), w, h); };
  function drawLog(x, y) { px(x, y, 5, 2, '#77513c'); px(x, y + 1, 5, 1, '#3f2b31'); px(x + 4, y, 1, 2, '#e2bd78'); }
  function drawDock(now) {
    const p = center(DOCK);
    px(p.x - 3, p.y + 2, 12, 3, '#b57f52'); px(p.x - 3, p.y + 4, 12, 1, '#77513c');
    for (let i = 0; i < 4; i++) px(p.x - 2 + i * 3, p.y + 5, 1, 3, '#3f2b31');
    const hx = p.x - 13, hy = p.y - 7;
    px(hx, hy + 3, 9, 6, '#b57f52'); px(hx, hy + 8, 9, 1, '#3f2b31'); px(hx - 1, hy + 1, 11, 2, '#c0473f'); px(hx + 1, hy, 7, 1, '#c0473f');
    px(hx + 3, hy + 5, 3, 4, '#141d26'); px(hx + 7, hy - 2, 2, 3, '#5f6e8a');
    if (S.workers.length) for (let i = 0; i < 3; i++) { const f = (now * 0.6 + i / 3) % 1; px(hx + 7 + Math.round(Math.sin((f + i) * 6) * 1.5), hy - 4 - f * 12, f < 0.5 ? 2 : 1, f < 0.5 ? 2 : 1, '#f4f6ea'); }
    for (let i = 0; i < Math.min(6, Math.ceil(S.logs / 5)); i++) drawLog(p.x + 2 + (i % 2) * 3, p.y - 3 - Math.floor(i / 2) * 2); // the woodpile shrinks through winter
    if (has('nursery')) { for (let i = 0; i < Math.min(5, S.saplings); i++) { px(p.x - 22 + i * 2, p.y + 3, 1, 2, '#2f7d46'); px(p.x - 22 + i * 2, p.y + 1, 1, 2, '#9bcb3e'); } px(p.x - 23, p.y + 5, 11, 1, '#77513c'); }
    // the trader's boat, sailing in and out across the lake
    const b = S.boat > 0 ? Math.min(1, (BOAT_STAY - S.boat) / 4, S.boat / 4) : 0;
    if (b > 0) {
      const bx2 = p.x + 6 + (1 - b) * 40, by = p.y + 22 + (1 - b) * 10;
      px(bx2, by, 14, 3, '#77513c'); px(bx2 + 1, by + 3, 12, 1, '#3f2b31'); px(bx2 + 6, by - 12, 1, 12, '#3f2b31'); px(bx2 + 7, by - 11, 5, 9, '#f4f6ea'); px(bx2 + 7, by - 11, 1, 9, '#dce7ee');
    }
  }
  const TOOL = { land: ['#77513c', '#a3b5c4'], wood: ['#77513c', '#a3b5c4'], food: ['#77513c', '#f4f6ea'], water: ['#5f9edd', '#a9d5f0'] };
  function drawWorker(w, now) {
    const walking = w.path.length > 0, bob = walking ? Math.floor(now * 8) % 2 : 0, shiver = w.cold ? (Math.floor(now * 12) % 2) : 0;
    const x = Math.round(w.x) - 1 + ((w.id * 5) % 7) - 3 + shiver, y = Math.round(w.y) - 7 - bob + ((w.id * 3) % 5) - 2;
    const sick = w.sick > SICKEN / 4, shirt = w.role ? ROLES[w.role].hue : '#a3b5c4', body = sick ? mix(shirt, '#a3b5c4', 0.6) : shirt;
    px(x, y + 6, 1, 1, '#141d26'); px(x + 2, y + 6, 1, 1, '#141d26');
    px(x, y + 3, 3, 3, body); px(x, y + 5, 3, 1, '#1a3445');
    px(x, y, 3, 3, sick ? '#c3d3e0' : '#f0c08a'); px(x, y, 3, 1, '#3f2b31');
    const r = effRole(w);
    if (r) { const [h, head] = TOOL[r]; px(x + 3, y + 2, 1, 3, h); px(x + 3, y + 1, 2, 2, head); }
    if (w.carry) { if (w.carry.kind === 'logs') drawLog(x - 1, y - 3); else if (w.carry.kind === 'water') { px(x - 2, y + 2, 2, 3, '#5f9edd'); px(x - 2, y + 2, 2, 1, '#a9d5f0'); } else px(x - 1, y - 2, 3, 2, '#9bcb3e'); }
    if (w.job === 'working' && Math.floor(now * 4) % 2) px(x + 4, y + 1, 2, 1, '#f4f6ea');
    if (w.cold) px(x + 3 + (Math.floor(now * 3) % 2), y + 1, 1, 1, '#dce7ee');
    if (w.hungry) { const bx2 = x - 1, by = y - 9; px(bx2, by, 6, 5, '#f4f6ea'); px(bx2 + 1, by + 2, 4, 2, '#b57f52'); px(bx2 + 2, by + 3, 2, 1, '#77513c'); px(bx2 + 1, by + 5, 1, 1, '#f4f6ea'); }
    if (!w.role && w.at === DOCK && !w.path.length && Math.floor(now * 2) % 2) px(x + 1, y - 4, 1, 2, '#e6e773');
  }
  function drawGrave(g) { px(g.x - 1, g.y - 4, 3, 4, '#a3b5c4'); px(g.x - 1, g.y - 4, 1, 4, '#dce7ee'); px(g.x, g.y - 3, 1, 2, '#5f6e8a'); px(g.x - 2, g.y, 5, 1, '#3f2b31'); }
  // stall markers: tiny icons over a planned tile that can't move on
  const MARK = {
    season: (x, y) => { px(x + 2, y, 1, 5, '#f4f6ea'); px(x, y + 2, 5, 1, '#f4f6ea'); px(x + 1, y + 1, 1, 1, '#f4f6ea'); px(x + 3, y + 3, 1, 1, '#f4f6ea'); px(x + 3, y + 1, 1, 1, '#f4f6ea'); px(x + 1, y + 3, 1, 1, '#f4f6ea'); },
    tech: (x, y) => { px(x + 1, y, 3, 1, '#e6c35a'); px(x + 1, y, 1, 2, '#e6c35a'); px(x + 3, y, 1, 2, '#e6c35a'); px(x, y + 2, 5, 3, '#e6c35a'); px(x + 2, y + 3, 1, 1, '#141d26'); },
    stock: (x, y) => { px(x + 2, y + 2, 1, 3, '#77513c'); px(x + 1, y, 3, 2, '#9bcb3e'); px(x + 2, y - 1, 1, 1, '#9bcb3e'); },
    hands: (x, y) => { px(x, y + 1, 1, 3, '#f0c08a'); px(x + 1, y, 3, 4, '#f0c08a'); px(x + 4, y + 2, 1, 1, '#f0c08a'); px(x + 1, y + 4, 3, 1, '#c0473f'); },
  };
  const LENS = {
    soil: (t) => ['#c0473f', '#e6c35a', '#3fae5a'][t.soil],
    food: (t) => ['#6b5a7a', '#b57f52', '#77513c', '#2f7d46'][t.food],
    water: (t) => ['#f39a52', '#a9d5f0', '#4b86c9'][t.water],
  };
  function label(text, x, y, color) { cx.lineWidth = 3 * dpr; cx.strokeStyle = '#141d26'; cx.strokeText(text, x, y); cx.fillStyle = color; cx.fillText(text, x, y); }
  function render(now) {
    sx.clearRect(0, 0, R.w, R.h);
    sx.drawImage(base, 0, 0);
    const s = season();
    if (lens) { // a lens tints every tile you can see by one value
      cells.forEach((t) => { if (!t.seen || !isLand(t)) return; const p = X.at(t.c, t.r); sx.globalAlpha = 0.55; sx.drawImage(lensHex(LENS[lens](t)), p.x, p.y + X.FY); sx.globalAlpha = 1; });
    }
    for (const a of anim) {
      if (a.kind === 'glint' && Math.sin(now * 1.7 + a.ph) > 0.55) px(a.x, a.y, 2, 1, '#f4f6ea');
      if (a.kind === 'bird' && s !== WINTER) { const ang = now * 0.7 + a.ph, bx2 = a.x + Math.cos(ang) * 8, by = a.y + Math.sin(ang) * 3, f = Math.floor(now * 5 + a.ph) % 2; px(bx2, by + f, 1, 1, '#141d26'); px(bx2 + 1, by + 1 - f, 1, 1, '#141d26'); px(bx2 + 2, by + f, 1, 1, '#141d26'); }
    }
    cells.forEach((t) => { // plan flags and stall markers
      if (!t.own || !t.plan) return;
      const p = X.at(t.c, t.r), fx0 = p.x + 7, fy = p.y + X.FY + 3;
      px(fx0, fy, 1, 7, '#3f2b31'); px(fx0 + 1, fy, 4, 3, PLANS[t.plan].color);
      const why = stall(t); if (why) { const bx2 = p.x + 19, by = p.y + X.FY + 3; px(bx2 - 1, by - 2, 7, 8, 'rgba(20,29,38,0.75)'); MARK[why](bx2, by); }
    });
    S.graves.forEach(drawGrave);
    drawDock(now);
    [...S.workers].sort((a, b) => a.y - b.y).forEach((w) => drawWorker(w, now));
    sx.globalCompositeOperation = 'source-atop'; // season tints stay on the land
    if (s === WINTER) { sx.fillStyle = 'rgba(220,231,238,0.22)'; sx.fillRect(0, 0, R.w, R.h); }
    else if (s === AUTUMN) { sx.fillStyle = 'rgba(243,154,82,0.08)'; sx.fillRect(0, 0, R.w, R.h); }
    sx.globalCompositeOperation = 'source-over';
    const seep = s === WINTER && into() > SEASON_LEN - SEEP, fl = S.flood > 0 ? S.floodSet || [] : [];
    if (fl.length) fl.forEach((i) => { const t = cells[i]; if (!t.seen) return; const p = X.at(t.c, t.r); sx.drawImage(waterHex, p.x, p.y + X.FY); });
    else if (seep) cells.forEach((t) => {
      if (!t.seen || !(t.kind === 'marsh' && t.marsh === 'drained')) return;
      const p = X.at(t.c, t.r);
      for (let i = 0; i < 4; i++) if (Math.sin(now * 3 + i * 1.7 + t.c) > 0.2) px(p.x + 7 + ((i * 7 + t.r * 3) % 18), p.y + X.FY + 6 + ((i * 5 + t.c) % 15), 2, 1, '#5f9edd');
    });
    if (hover && hover !== sel) { const p = X.at(hover.c, hover.r); sx.drawImage(ring, p.x, p.y + X.FY); }
    if (sel) { const p = X.at(sel.c, sel.r); sx.drawImage(ringSel, p.x, p.y + X.FY); }
    const k = scale * dpr, ox = offX * dpr, oy = offY * dpr;
    cx.fillStyle = '#a9d5f0'; cx.fillRect(0, 0, canvas.width, canvas.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(scene, ox, oy, R.w * k, R.h * k);
    cx.textAlign = 'center'; cx.font = `600 ${Math.round(Math.max(11, 5.5 * scale) * dpr)}px "Pixelify Sans", monospace`;
    for (const f of S.fx) { cx.globalAlpha = Math.max(0, 1 - f.t / 1.2); label(f.text, ox + f.x * k, oy + (f.y - f.t * 10) * k, f.color); cx.globalAlpha = 1; }
  }
  function hexShape(color, edgeOnly) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 28;
    const rc = c.getContext('2d'); rc.fillStyle = color;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) if (X.inFace(x, y) && (!edgeOnly || !X.inFace(x - 1, y) || !X.inFace(x + 1, y) || !X.inFace(x, y - 1) || !X.inFace(x, y + 1))) rc.fillRect(x, y, 1, 1);
    return c;
  }
  const ring = hexShape('#f4f6ea', true), ringSel = hexShape('#e6c35a', true), waterHex = hexShape('rgba(95,158,221,0.6)', false);
  const lensCache = {};
  const lensHex = (c) => lensCache[c] || (lensCache[c] = hexShape(c, false));

  // ---------- input ----------
  function cellAt(e) {
    const x = Math.floor((e.clientX - offX) / scale), y = Math.floor((e.clientY - offY) / scale);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? cells[o] : null;
  }
  // Press and drag across your tiles with a plan chosen to paint that plan onto all of them.
  let painting = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!running()) return;
    const t = cellAt(e);
    if (sel && t && t !== sel && sel.plan && t.own && planFits(t, sel.plan) && e.shiftKey) { setPlan(t, sel.plan); return; }
    select(t);
    if (t && t.own && t.plan) painting = t.plan;
  });
  canvas.addEventListener('pointerup', () => { painting = null; });
  canvas.addEventListener('pointermove', (e) => {
    hover = running() ? cellAt(e) : null;
    if (painting && hover && hover.own && !hover.plan && planFits(hover, painting) && e.buttons) setPlan(hover, painting);
    if (!hover || e.pointerType === 'touch' || hover === sel) { tip.style.display = 'none'; return; }
    const t = hover;
    tip.innerHTML = `<b>${t.seen ? nameOf(t) : 'Unexplored'}</b><span>${t.seen ? tileLine(t) : 'Under fog'}</span>`;
    tip.style.display = 'block';
    let lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + tip.offsetWidth > innerWidth - 8) lx = e.clientX - tip.offsetWidth - 12;
    if (ly + tip.offsetHeight > innerHeight - 8) ly = e.clientY - tip.offsetHeight - 12;
    tip.style.left = `${lx}px`; tip.style.top = `${ly}px`;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; painting = null; tip.style.display = 'none'; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 80); });
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  // ---------- tile panel ----------
  const $ = (id) => document.getElementById(id);
  const valuesLine = (t) => (isLand(t) ? `Soil ${SOIL[t.soil].toLowerCase()} · ${FOOD[t.food].toLowerCase()} · ${WATER[t.water].toLowerCase()}` : '');
  function tileLine(t) {
    if (t === DOCK) return `Your dock. ${S.logs} logs, ${S.food} food in store.`;
    const own = t.own ? '' : canOwn(t) ? ` · ${price(t)}g to buy` : ' · not yours';
    if (isLand(t)) return `${valuesLine(t)}${TREES.has(t.cover) ? ` · ${t.wood} logs` : t.dead ? ` · ${t.dead} logs` : ''}${own}`;
    return `${nameOf(t)}${own}`;
  }
  const planFits = (t, p) => (isLand(t) ? ['forest', 'field', 'rest'].includes(p) : t.kind === 'marsh' ? p === 'marsh' && t.marsh === 'drained' : t.kind === 'river' ? p === 'river' && t.river === 'dirty' : false);
  function plansFor(t) {
    if (!t.own || t === DOCK) return [];
    if (isLand(t)) return ['forest', 'field', 'rest'];
    if (t.kind === 'marsh' && t.marsh === 'drained') return ['marsh'];
    if (t.kind === 'river' && t.river === 'dirty') return ['river'];
    return [];
  }
  function setPlan(t, p) { t.plan = t.plan === p ? null : p; t.work = 0; lastKey = ''; }
  const DESC = {
    'Leaking mine': 'The settlers\' mine. Rot seeps out of it and creeps down the valley. Sealing it is a later project.',
    'Rot': 'Rot from the mine. Nothing grows, and workers on it or next to it fall sick. The land crew burns it off, except in winter.',
    'Deadwood': 'Dead pines, dry and fallen. Woodcutters clear them for firewood, leaving bare ground.',
    'Stump field': 'The forest that was. Saplings can go in between the stumps; a field needs them pulled out. Stumps rot away over two years.',
    'Dust field': 'Hard, dead, dry ground. In summer its dust blows onto weak land next to it.',
    'Bare ground': 'Thin, poor ground. Next to living land, grass creeps back on its own.',
    'Fed ground': 'Fed, dark soil. Ready for something to grow.',
    'Seedlings': 'Planted saplings. They grow outside winter, and dry out if summer leaves them without water.',
    'Young wood': 'A young forest, too small to fell. In about two years it becomes a pine stand.',
    'Clover': 'Clover feeds the soil as it grows and becomes grassland.',
    'Pine stand': 'Living forest. Woodcutters fell it; rested, it grows 5 logs a season. Kept above 45 logs, it slowly becomes old forest.',
    'Old forest': 'Old forest, full of wood. Cut below a third, it thins to a pine stand.',
    'Oak grove': 'An oak grove. Woodcutters fell it; rested, it grows back.',
    'Grassland': 'Living grassland. With Farms, the food crew farms it on a Field plan.',
    'Meadow': 'A meadow in flower.',
    'Dirty river': 'Murky water from the mine. No fish live in it. A reed bed can clean it.',
    'Dry riverbed': 'The river ran here before the dam held it back.',
    'Old dam': 'The settlers\' mill dam. Breaking it is a later project.',
    'Drained marsh': 'The settlers dug ditches and drained it. Every spring the water comes back all at once and floods the land around it.',
    'Blocked marsh': 'The ditches are blocked. At the next spring flood the water will stay.',
    'Marsh': 'A living marsh. It holds water and rot can\'t cross it easily.',
    'River': 'Clean water. Fishers catch fish here, and water carriers fill buckets here.',
    'Beach': 'Fishers catch fish here, all year round. Water carriers fill buckets here.',
    'Pond': 'Fishers catch fish here, except in winter. Water carriers fill buckets here.',
  };
  const STALL_TEXT = { season: 'Waiting for the right season.', tech: 'Needs a tech from the tech tree.', stock: 'Waiting for stock at the dock.', hands: 'No one in the land crew.' };
  function select(t) { sel = t && t.seen ? t : null; tip.style.display = 'none'; lastKey = ''; }
  function updateTilePanel() {
    const t = sel, panel = $('tilePanel');
    panel.hidden = !t;
    if (!t) return;
    const dock = t === DOCK, name = nameOf(t);
    $('tName').textContent = name;
    let info = dock ? 'Your crew lives here. Stock is kept here, and the trader\'s boat calls at the start of spring, summer and autumn.' : DESC[name] || `${B[t.b0].name}.`;
    if (isLand(t) && TREES.has(t.cover)) info += ` ${t.wood} logs standing.`;
    if (t.dead) info += ` ${t.dead} logs left.`;
    $('tInfo').textContent = info;
    $('tVals').innerHTML = isLand(t) ? [['Soil', SOIL[t.soil], t.soil, 2], ['Food', FOOD[t.food], t.food, 3], ['Water', WATER[t.water], t.water, 2]].map(([k, v, n, m]) => `<span class="val"><small>${k}</small><b>${v}</b><i>${'▮'.repeat(n)}${'▯'.repeat(m - n)}</i></span>`).join('') : '';
    $('tVals').hidden = !isLand(t);
    const opts = plansFor(t);
    $('tPlans').hidden = !opts.length;
    $('tPlans').innerHTML = opts.map((p) => `<button class="btn plan${t.plan === p ? ' on' : ''}" data-plan="${p}" style="--pc:${PLANS[p].color}">${PLANS[p].name}</button>`).join('')
      + (t.plan && t.plan !== 'rest' ? `<button class="btn prio" id="tPrio" title="Priority">${'●'.repeat(t.prio)}${'○'.repeat(3 - t.prio)}</button>` : '');
    const ch = t.plan ? chips(t) : [];
    const cur = ch.findIndex((c) => !c[1]), why = stall(t);
    $('tSteps').hidden = !ch.length;
    $('tSteps').innerHTML = ch.map(([n, done], i) => `<span class="chip-step${done ? ' done' : i === cur ? ' now' : ''}">${n}</span>`).join('<span class="arr">›</span>');
    const buyable = canOwn(t);
    $('tBuy').hidden = !buyable;
    if (buyable) { $('tBuy').innerHTML = `Buy this land <span class="cost">${price(t)}g</span>`; $('tBuy').disabled = S.gold < price(t); }
    $('tDock').hidden = !dock;
    if (dock) {
      const boat = S.boat > 0;
      $('dockBoat').textContent = boat ? `The trader's boat is in for ${Math.ceil(S.boat)}s.` : 'The trader\'s boat comes back next season.';
      $('keepLogs').textContent = S.keep.logs; $('keepFood').textContent = S.keep.food;
      const g = surplus('logs') * LOG_PRICE + surplus('food') * FOOD_PRICE;
      $('sellSurplus').innerHTML = `Sell surplus <span class="cost">+${g}g</span>`; $('sellSurplus').disabled = !boat || !g;
      $('buyLogs').innerHTML = `Buy 10 logs <span class="cost">${10 * BUY_PRICE.logs}g</span>`; $('buyLogs').disabled = !boat || S.gold < 10 * BUY_PRICE.logs;
      $('buyFood').innerHTML = `Buy 10 food <span class="cost">${10 * BUY_PRICE.food}g</span>`; $('buyFood').disabled = !boat || S.gold < 10 * BUY_PRICE.food;
      $('dockStock').textContent = `${S.seed} seed · ${S.saplings} saplings${has('nursery') ? (S.seed ? ' · the nursery is raising seed' : ' · the nursery needs seed') : ''}`;
    }
    let note = '';
    if (!t.own && !dock) note = buyable ? (S.gold < price(t) ? `You have ${S.gold} gold.` : '') : t.kind === 'lake' ? '' : 'Only land next to your border can be bought.';
    else if (why) {
      const j = landStep(t);
      note = why === 'tech' ? `${JOB[j].name} needs ${TECH.find((q) => q.id === JOB[j].tech).name}${j === 'reedbed' ? ' and a healed marsh' : ''}.`
        : why === 'season' ? `${JOB[j].name}: ${JOB[j].seasons.map((s) => SEASONS[s].toLowerCase()).join(', ')} only.`
          : why === 'stock' ? `${JOB[j].name} needs ${Object.entries(JOB[j].uses).map(([k, n]) => `${n} ${k}`).join(', ')} at the dock.` : STALL_TEXT[why];
    } else if (t.plan === 'forest' && !landStep(t) && t.dead) note = 'Waiting for the woodcutters to clear it.';
    else if (t.own && opts.length && !t.plan) note = 'Choose what this land should become. Drag from a planned tile to paint the same plan.';
    $('tNote').textContent = note;
  }
  $('tClose').addEventListener('click', () => select(null));
  $('tPlans').addEventListener('click', (e) => {
    if (!sel) return;
    if (e.target.closest('#tPrio')) { sel.prio = sel.prio % 3 + 1; lastKey = ''; return; }
    const b = e.target.closest('[data-plan]'); if (b) setPlan(sel, b.dataset.plan);
  });
  $('tBuy').addEventListener('click', () => { if (sel) buy(sel); lastKey = ''; });
  $('sellSurplus').addEventListener('click', () => { sellSurplus(); lastKey = ''; });
  $('buyLogs').addEventListener('click', () => { buyStock('logs', 10); lastKey = ''; });
  $('buyFood').addEventListener('click', () => { buyStock('food', 10); lastKey = ''; });
  document.querySelectorAll('[data-keep]').forEach((b) => b.addEventListener('click', () => {
    const [k, d] = b.dataset.keep.split(':'); S.keep[k] = Math.max(0, S.keep[k] + Number(d)); lastKey = '';
  }));

  // ---------- HUD ----------
  document.querySelectorAll('img[data-ic]').forEach((im) => { im.src = icon(im.dataset.ic); });
  const RES = [
    { id: 'gold', icon: 'coin', name: 'Gold', val: () => S.gold },
    { id: 'pop', icon: 'pop', name: 'Crew', val: () => { const n = idle().length; return n ? `${S.workers.length} · ${n} idle` : S.workers.length; } },
    { id: 'food', icon: 'food', name: 'Food', val: () => S.food, warn: () => S.workers.some((w) => w.hungry) },
    { id: 'logs', icon: 'log', name: 'Logs', val: () => S.logs, warn: () => S.workers.some((w) => w.cold) },
    { id: 'seed', icon: 'seed', name: 'Seed', val: () => S.seed, show: () => has('seeds') },
    { id: 'saplings', icon: 'sapling', name: 'Saplings', val: () => S.saplings, show: () => has('nursery') },
  ];
  $('res').innerHTML = RES.map((r) => `<div class="panel chip" id="r-${r.id}" title="${r.name}"><img class="ic" alt="${r.name}" src="${icon(r.icon)}"><div><b>0</b><small>${r.name}</small></div></div>`).join('');
  $('crews').innerHTML = Object.entries(ROLES).map(([id, r]) => `<div class="panel crew" id="c-${id}" style="--hue:${r.hue}"><div class="ch"><img class="ic" alt="" src="${icon(r.icon)}"><b>${r.name}</b><span class="n"></span>
    <button class="btn mini" data-crew="${id}:-1" aria-label="Take one from ${r.name}">−</button><button class="btn mini go" data-crew="${id}:1" aria-label="Add one to ${r.name}">+</button></div><p class="who"></p><p class="doing"></p>${id === 'wood' ? '<button class="btn mini cut" id="cutBtn"></button>' : ''}</div>`).join('');
  document.querySelectorAll('[data-crew]').forEach((b) => b.addEventListener('click', () => { const [r, d] = b.dataset.crew.split(':'); if (d === '1') addTo(r); else takeFrom(r); lastKey = ''; }));
  $('cutBtn').addEventListener('click', () => {
    const order = has('selective') ? ['last', 'third', 'dead'] : ['last', 'dead'];
    S.cut = order[(order.indexOf(S.cut) + 1) % order.length]; lastKey = '';
  });
  const CUT_TEXT = { last: 'Cut: to the last log', third: 'Cut: leave a third', dead: 'Cut: deadwood only' };
  function doing(role) {
    const c = crew(role); if (!c.length) return '';
    const working = c.filter((w) => w.task);
    if (!working.length) {
      if (role === 'water' && season() !== SUMMER) return 'Helping the land crew until summer';
      if (role === 'land' && winter()) return 'Felling for firewood until spring';
      return 'Nothing to do';
    }
    const t = working[0].task, j = working[0].taskJob;
    const verb = { clear: 'Clearing', fell: 'Felling', water: 'Watering', fish: 'Fishing', farm: 'Farming', seed: 'Gathering seed on', loosen: 'Loosening', mulch: 'Mulching', compost: 'Composting', plant: 'Planting', sow: 'Sowing', pull: 'Pulling stumps on', burn: 'Burning', block: 'Blocking ditches on', reedbed: 'Building a reed bed on' }[j] || 'Working';
    return `${verb} the ${lower(nameOf(t))}${working.length > 1 && working.some((w) => w.task !== t) ? ' and more' : ''}`;
  }
  let speed = 1, view = 'menu';
  const running = () => view === 'game';
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
  addEventListener('keydown', (e) => { if (e.key === ' ' && running()) { e.preventDefault(); const p = document.querySelector('[data-speed="0"]'); (speed === 0 ? document.querySelector('[data-speed="1"]') : p).click(); } });
  document.querySelectorAll('[data-lens]').forEach((b) => b.addEventListener('click', () => {
    lens = lens === b.dataset.lens ? null : b.dataset.lens;
    document.querySelectorAll('[data-lens]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.lens === lens)));
  }));
  $('hire').addEventListener('click', () => { hire(); lastKey = ''; });
  // the season ribbon: what each season allows, and where "now" is
  const RIBBON = [['sapling', 'drop'], ['drop'], ['sapling', 'seed'], ['snow']];
  $('ribbon').innerHTML = SEASONS.map((s, i) => `<span class="seg" id="seg-${i}" title="${s}">${RIBBON[i].map((ic) => `<img alt="" src="${icon(ic)}">`).join('')}</span>`).join('');
  let lastKey = '', lastNotes = '';
  function updateHud() {
    const s = season();
    $('season').textContent = SEASONS[s];
    $('year').textContent = `Year ${Math.floor(S.seasonCount / 4) + 1}`;
    $('nowMark').style.left = `${((s + into() / SEASON_LEN) / 4) * 100}%`;
    for (let i = 0; i < 4; i++) $(`seg-${i}`).classList.toggle('on', i === s);
    RES.forEach((r) => { const el = $(`r-${r.id}`); el.hidden = r.show && !r.show(); el.querySelector('b').textContent = r.val(); el.classList.toggle('warn', !!(r.warn && r.warn())); });
    const nowMs = performance.now();
    for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].until < nowMs) toasts.splice(i, 1);
    const nk = toasts.map((n) => n.text).join('|');
    if (nk !== lastNotes) { lastNotes = nk; $('notes').innerHTML = toasts.map((n) => `<div class="panel notice${n.bad ? ' bad' : ''}">${n.text}</div>`).join(''); }
    const k = [S.gold, S.food, S.logs, S.seed, S.saplings, Math.ceil(S.boat), S.workers.map((w) => `${w.role}${idx(w.task)}${w.taskJob}${w.hungry}${w.cold}${skill(w, w.role)}`).join(), S.log.join(), Object.keys(S.tech).join(), s, S.cut, S.keep.logs, S.keep.food,
      sel && sigs[idx(sel)], sel && sel.plan, sel && sel.prio, sel && sel.wood, sel && sel.dead, sel && stall(sel)].join('|');
    if (k === lastKey) return;
    lastKey = k;
    $('hireCost').textContent = `${hireCost()}g`;
    $('hire').disabled = S.gold < hireCost();
    $('treeBtn').querySelector('.lbl').textContent = TECH.some((t) => canBuy(t)) ? 'Tech •' : 'Tech';
    $('log').innerHTML = S.log.map((m) => `<li>${m}</li>`).join('');
    const mourn = S.graves.filter((g) => g.season === S.seasonCount);
    Object.keys(ROLES).forEach((id) => {
      const el = $(`c-${id}`), c = crew(id);
      el.querySelector('.n').textContent = c.length;
      el.querySelector('.who').innerHTML = c.map((w) => `<span class="${w.hungry || w.cold || w.sick > SICKEN / 4 ? 'hurt' : ''}">${w.name}${'★'.repeat(skill(w, id))}</span>`).join(' ')
        + mourn.filter((g) => g.role === id).map((g) => ` <span class="gone">${g.name}</span>`).join('') || '<span class="empty">No one</span>';
      el.querySelector('.doing').textContent = doing(id);
      el.querySelector('[data-crew$=":1"]').disabled = !idle().length;
      el.querySelector('[data-crew$=":-1"]').disabled = !c.length;
    });
    $('cutBtn').textContent = CUT_TEXT[S.cut];
    updateTilePanel();
    if (view === 'tree') drawTree();
  }

  // ---------- menu and the end ----------
  function show(v) {
    view = v;
    if (v === 'game') S.started = true;
    $('menu').hidden = v !== 'menu'; $('treeView').hidden = v !== 'tree' && v !== 'pop'; $('popView').hidden = v !== 'pop'; $('endView').hidden = v !== 'end';
    if (v !== 'game') { tip.style.display = 'none'; hover = null; }
  }
  function openMenu() {
    save();
    const sv = loadSave(), live = sv && !sv.over;
    $('resume').hidden = !live;
    $('newGame').textContent = live ? 'New game' : 'Start';
    $('newGame').classList.toggle('go', !live);
    $('newGame').dataset.armed = live ? '' : '1';
    $('saveNote').textContent = live ? `Saved: ${SEASONS[seasonOf(sv.seasonCount)]}, year ${Math.floor(sv.seasonCount / 4) + 1}, ${sv.workers.length} in the crew.` : 'Your game saves in this browser as you play.';
    show('menu');
  }
  function showEnd() {
    const o = S.over;
    $('endText').textContent = o.text;
    $('endStats').textContent = `It was ${o.season} of year ${o.year}. ${o.dead} ${o.dead === 1 ? 'grave' : 'graves'} by the dock, and ${o.colour}% of the valley alive again.`;
    show('end');
  }
  $('menuBtn').addEventListener('click', openMenu);
  $('resume').addEventListener('click', () => { if (!S) load(loadSave()); show('game'); });
  $('newGame').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again: replace your saved game'; return; }
    fresh(); sel = null; show('game'); save();
  });
  $('again').addEventListener('click', () => { fresh(); sel = null; show('game'); save(); });

  // ---------- tech tree ----------
  const owned = (t) => !!S.tech[t.id];
  const unlocked = (t) => !t.needs || !!S.tech[t.needs];
  const afford = (t) => S.gold >= t.cost && S.logs >= (t.logs || 0) && S.food >= (t.food || 0);
  const canBuy = (t) => !t.soon && !owned(t) && unlocked(t) && afford(t);
  $('treeBtn').addEventListener('click', () => { drawTree(); show('tree'); });
  $('treeBack').addEventListener('click', () => show('game'));
  const graph = $('graph');
  graph.insertAdjacentHTML('beforeend', ['Soil', 'Water', 'Plants', 'Forest', 'Clean-up', 'Food and trade'].map((n, i) => `<span class="branch" style="left:${COLX[i]}%">${n}</span>`).join('')
    + TECH.map((t) => `<button class="node" id="n-${t.id}" style="left:${t.x}%;top:${t.y}%" aria-label="${t.name}"><img alt="" src="${icon(t.icon)}"><span>${t.name}</span></button>`).join(''));
  $('links').innerHTML = TECH.filter((t) => t.needs).map((t) => { const p = TECH.find((q) => q.id === t.needs); return `<line id="l-${t.id}" x1="${p.x}" y1="${p.y}" x2="${t.x}" y2="${t.y}" vector-effect="non-scaling-stroke" style="stroke-width:4px"/>`; }).join('');
  function drawTree() {
    $('treeGold').textContent = S.gold;
    TECH.forEach((t) => {
      const n = $(`n-${t.id}`);
      n.className = `node${owned(t) ? ' owned' : ''}${canBuy(t) ? ' ready' : ''}${!unlocked(t) ? ' locked' : ''}${t.soon ? ' soon' : ''}`;
      const l = $(`l-${t.id}`); if (l) l.setAttribute('stroke', unlocked(t) ? (owned(t) ? '#9bcb3e' : '#e6c35a') : '#3a4656');
    });
  }
  let picked = null;
  const costHtml = (t) => [`<img class="ic" alt="gold" src="${icon('coin')}">${t.cost}`, t.logs && `<img class="ic" alt="logs" src="${icon('log')}">${t.logs}`, t.food && `<img class="ic" alt="food" src="${icon('food')}">${t.food}`].filter(Boolean).join(' ');
  function missing(t) {
    const m = [];
    if (S.gold < t.cost) m.push(`${t.cost - S.gold} more gold`);
    if (S.logs < (t.logs || 0)) m.push(`${t.logs - S.logs} more logs`);
    if (S.food < (t.food || 0)) m.push(`${t.food - S.food} more food`);
    return m.length ? `You need ${m.join(' and ')}.` : '';
  }
  graph.addEventListener('click', (e) => {
    const n = e.target.closest('.node'); if (!n) return;
    picked = TECH.find((t) => `n-${t.id}` === n.id);
    const t = picked;
    $('popIcon').src = icon(t.icon); $('popName').textContent = t.name; $('popText').textContent = t.text;
    $('popPrice').innerHTML = t.soon ? '' : owned(t) ? 'Owned' : costHtml(t);
    $('popNeed').textContent = t.soon || owned(t) ? '' : !unlocked(t) ? `Buy ${TECH.find((q) => q.id === t.needs).name} first.` : missing(t);
    $('popYes').hidden = t.soon || owned(t);
    $('popYes').disabled = !canBuy(t);
    $('popNo').textContent = t.soon || owned(t) ? 'Close' : 'Cancel';
    show('pop');
    ($('popYes').hidden || $('popYes').disabled ? $('popNo') : $('popYes')).focus();
  });
  $('popNo').addEventListener('click', () => show('tree'));
  $('popYes').addEventListener('click', () => {
    const t = picked; if (!t || !canBuy(t)) return;
    S.gold -= t.cost; S.logs -= t.logs || 0; S.food -= t.food || 0; S.tech[t.id] = true; say(`${t.name} learned.`); save();
    drawTree(); show('tree');
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (view === 'pop') show('tree'); else if (view === 'tree') show('game'); else if (view === 'game') { if (sel) select(null); else openMenu(); }
  });

  // ---------- loop ----------
  let last = performance.now(), saveT = 0, sigT = 0;
  function advance(dt) {
    S.time += dt;
    const sc = Math.floor(S.time / SEASON_LEN);
    if (sc !== S.seasonCount) { S.seasonCount = sc; newSeason(); changed(); }
    if (S.flood > 0) S.flood = Math.max(0, S.flood - dt);
    if (S.boat > 0) S.boat = Math.max(0, S.boat - dt);
    [...S.workers].forEach((w) => stepWorker(w, dt));
    stepNeeds(dt); stepLand(dt);
  }
  function frame(now) {
    const dt = running() && !S.over ? Math.min(0.1, (now - last) / 1000) * speed : 0; last = now;
    if (S) {
      if (dt > 0) { advance(dt); saveT += dt / speed; if (saveT > 5) { saveT = 0; save(); } }
      sigT += 1; if (dirty || sigT > 30) { sigT = 0; if (dirty || cells.some((t, i) => sig(t) !== sigs[i])) redraw(); }
      const rdt = Math.min(0.1, dt);
      S.fx.forEach((f) => { f.t += rdt; });
      S.fx = S.fx.filter((f) => f.t < 1.2);
      render(now / 1000);
      updateHud();
    }
    requestAnimationFrame(frame);
  }
  const saved = loadSave();
  if (saved && !saved.over) { try { load(saved); } catch (e) { fresh(); } } else fresh();
  openMenu();
  requestAnimationFrame(frame);
  window.HexCivGame = { get state() { return S; }, hire, addTo, takeFrom, setPlan, select, buy, sell, sellSurplus, buyStock, cells, get, show, landStep, stall, price, die, spreadRot, redraw, nameOf, alive,
    screenOf(c, r) { const p = center(get(c, r)); return { x: offX + p.x * scale, y: offY + (p.y + 4) * scale }; },
    run(sec) { for (let i = 0; i < sec * 10 && !S.over; i++) advance(0.1); if (dirty) redraw(); },
    reveal() { cells.forEach((t) => { t.own = true; }); redraw(); } };
})();
