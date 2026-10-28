// HexCiv v2, Restore the Valley. You inherit a ruined Verdant Reach: stump fields, dust, a dammed river, a drained
// marsh and rot creeping down from the old mine. Buy land with gold, put workers on tiles to fish, cut and heal it, and
// keep the crew fed and warm. Nothing on screen states a goal: the map shows what is wrong and what has healed.
// Workers die of hunger, cold, rot or flood, and the run ends when the last one dies.
// See docs/game-design.md. Version 1 (the clean valley) is frozen in archive/5-prototype-v1.
(() => {
  const X = buildHexTiles(), icon = buildHudIcons(), B = X.BIOMES, C = X.C;

  // ---------- tuning ----------
  const SEASON_LEN = 150;             // seconds per season: a 10-minute year
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const SPRING = 0, SUMMER = 1, WINTER = 3;
  const CHOP_TIME = 4;                // seconds per log; Axes halve it
  const FISH_TIME = 8;                // seconds per fish; Fishing nets halve it
  const FARM_TIME = 10;               // seconds per sack of food from a field
  const STEP = 0.45;                  // seconds per point of move cost
  const SNOW = 1.6;                   // winter walking slowdown
  const LOG_PRICE = 3, FISH_PRICE = 2;
  const MEAL = 75;                    // each worker eats one food this often, twice as often in winter
  const WARM = 30;                    // in winter each worker burns one log this often
  const STARVE = 120, FREEZE = 75, SICKEN = 60; // seconds a worker lasts hungry, cold, or standing on rot
  const REGEN = 20;                   // a rested forest grows back one log this often; Forestry halves it
  const SAPLING_GROW = 150, BARE_HEAL = 180;
  const FLOOD = 20, SEEP = 25;        // the spring flood lasts FLOOD seconds; water seeps SEEP seconds before it
  const WOOD = { forest: 18, pines: 12, grove: 10 }, DEADWOOD = 8;
  const FISH = new Set(['beach', 'pond', 'river']);
  const FIELD = new Set(['grass', 'meadow']);
  const LIVING = new Set(['grass', 'meadow', 'grove', 'pines', 'forest', 'pond', 'swamp', 'river', 'beach']);
  const hireCost = () => 15 + 5 * Math.max(0, S.workers.length - 1);
  const NAMES = ['Ana', 'Tomas', 'Bea', 'Ivo', 'Mara', 'Jon', 'Lena', 'Oskar', 'Rui', 'Edda', 'Finn', 'Sela', 'Pim', 'Hana', 'Tove', 'Ugo'];
  const JOBS = {
    chop: { who: 'lumberjack', slots: 3 },
    clear: { who: 'clearer', slots: 3 },
    fish: { who: 'fisher', slots: 2 },
    farm: { who: 'farmer', slots: 2, tech: 'farms' },
    plant: { who: 'planter', slots: 3, tech: 'saplings', work: 30 },
    compost: { who: 'composter', slots: 3, tech: 'compost', work: 40 },
    burn: { who: 'burner', slots: 3, tech: 'compost', work: 30 },
    filter: { who: 'filter builder', slots: 3, tech: 'reeds', work: 60 },
  };
  // x, y place the node on the tree (percent of the board)
  const TECH = [
    { id: 'fishing', name: 'Fishing nets', icon: 'fishing', cost: 30, x: 20, y: 12, text: 'Fishers catch twice as many fish.' },
    { id: 'axes', name: 'Axes', icon: 'axe', cost: 40, x: 50, y: 12, text: 'Lumberjacks and clearers chop twice as fast. A forest wears down twice as fast too.' },
    { id: 'saplings', name: 'Saplings', icon: 'sapling', cost: 40, logs: 10, x: 80, y: 12, text: 'Planters set saplings in stump fields and bare ground. They grow into a pine stand in about a season.' },
    { id: 'compost', name: 'Compost', icon: 'compost', cost: 60, food: 20, x: 20, y: 38, needs: 'fishing', text: 'Composters turn dust fields back into the land they were. Burners burn and compost rot away.' },
    { id: 'reeds', name: 'Reed filters', icon: 'reeds', cost: 100, logs: 30, x: 50, y: 38, needs: 'axes', text: 'Filter builders clean a dirty river tile so fish come back to it.' },
    { id: 'forestry', name: 'Forestry', icon: 'forestry', cost: 70, x: 80, y: 38, needs: 'saplings', text: 'Rested forests grow their wood back twice as fast.' },
    { id: 'farms', name: 'Farms', icon: 'farms', cost: 80, x: 20, y: 64, needs: 'compost', text: 'Farmers grow food on living grassland and meadow, except in winter.' },
    { id: 'dam', name: 'Dam breaking', icon: 'dam', x: 50, y: 64, needs: 'reeds', soon: true, text: 'Break the old dam so the dry riverbed fills again. Coming in a later prototype.' },
    { id: 'quarry', name: 'Quarrying', icon: 'stone', x: 80, y: 64, needs: 'forestry', soon: true, text: 'Stone from the hills, needed to seal the mine. Coming in a later prototype.' },
    { id: 'rewet', name: 'Re-wetting', icon: 'drop', x: 20, y: 88, needs: 'farms', soon: true, text: 'Block the settlers\' ditches so the marsh holds water and stops flooding. Coming in a later prototype.' },
    { id: 'rafting', name: 'Log rafting', icon: 'raft', x: 50, y: 88, needs: 'dam', soon: true, text: 'Once the river runs again, it carries logs to the dock. Coming in a later prototype.' },
    { id: 'seal', name: 'Mine sealing', icon: 'seal', x: 80, y: 88, needs: 'quarry', soon: true, text: 'Seal the leaking mine and the rot stops for good. Coming in a later prototype.' },
  ];

  // ---------- the ruined Verdant Reach ----------
  // LAND is what each tile was before the settlers; DAMAGE is what they left. '.' means the tile is still alive.
  const KEY = { g: 'grass', m: 'meadow', o: 'grove', p: 'pines', f: 'forest', w: 'pond', l: 'lake', r: 'rocks', h: 'hills',
    s: 'swamp', v: 'river', n: 'mountains', b: 'beach' };
  const DAMAGE_KEY = { K: 'mine', D: 'deadwood', S: 'stumps', U: 'dust', B: 'bare', R: 'dirty', Y: 'dry', A: 'dam', M: 'marsh' };
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
  const DAMAGE = [
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
  const RUINS = {
    mine: { name: 'Leaking mine', look: 'mountains', move: 4, fade: 0.45, value: 30, text: 'The settlers\' mine. Rot seeps out of it and creeps down the valley. Sealing it is a later project.' },
    deadwood: { name: 'Deadwood', look: 'grass', move: 3, fade: 0.7, value: 6, text: 'Dead pines, dry and fallen. Clearers cut it into logs and leave bare ground.' },
    stumps: { name: 'Stump field', look: 'grass', move: 2, fade: 0.62, value: 3, text: 'The forest that was. Planters can set saplings here.' },
    dust: { name: 'Dust field', look: 'grass', move: 1, fade: 0.62, value: 3, text: 'Worn-out ground, dry and cracked. In summer the dust blows onto the land next to it.' },
    bare: { name: 'Bare ground', look: 'grass', move: 1, fade: 0.55, value: 3, text: 'Cleared ground. On your land, grass creeps back on its own next to living land.' },
    dirty: { name: 'Dirty river', look: 'river', move: 3, fade: 0.6, value: 8, text: 'Murky water from the mine. No fish live in it.' },
    dry: { name: 'Dry riverbed', look: 'river', move: 2, fade: 0.62, value: 4, text: 'The river ran here before the dam held it back.' },
    dam: { name: 'Old dam', look: 'river', move: 3, fade: 0.6, value: 15, text: 'The settlers\' mill dam. It holds the river back. Breaking it is a later project.' },
    marsh: { name: 'Drained marsh', look: 'swamp', move: 3, fade: 0.62, value: 6, text: 'The settlers dug ditches and drained it. Every spring the water comes back all at once.' },
    sapling: { name: 'Saplings', look: 'grass', move: 1, fade: 0.12, value: 10, text: 'Young pines. They grow into a pine stand when left alone outside winter.' },
  };
  const VALUE = { grass: 10, meadow: 15, pond: 20, pines: 25, forest: 30, grove: 25, beach: 15, river: 18, hills: 8, rocks: 8, mountains: 8, swamp: 20 };
  const LIVE_TEXT = {
    pines: 'Living forest. Lumberjacks cut logs here. Cut it to the last log and only stumps are left; rested, it grows back.',
    forest: 'Old forest. Lumberjacks cut logs here. Cut it to the last log and only stumps are left; rested, it grows back.',
    grove: 'Oak grove. Lumberjacks cut logs here. Cut it to the last log and only stumps are left; rested, it grows back.',
    beach: 'Fishers catch fish here, all year round.',
    pond: 'Fishers catch fish here, except in winter when it freezes.',
    river: 'Clean water. Fishers catch fish here.',
    grass: 'Living grassland. With Farms, farmers grow food here.',
    meadow: 'A meadow in flower. With Farms, farmers grow food here.',
  };

  const key = (c, r) => `${c},${r}`;
  const cells = LAND.flatMap((row, r) => [...row].map((ch, c) => ({ c, r, b0: KEY[ch], ruin0: DAMAGE_KEY[DAMAGE[r][c]] || null })));
  const byKey = new Map(cells.map((t) => [key(t.c, t.r), t]));
  const get = (c, r) => byKey.get(key(c, r));
  const center = (t) => { const p = X.at(t.c, t.r); return { x: p.x + 16, y: p.y + X.FY + 14 }; };
  const cube = (t) => { const x = t.c, z = t.r - (t.c - (t.c & 1)) / 2; return [x, -x - z, z]; };
  const dist = (a, b) => { const p = cube(a), q = cube(b); return Math.max(...p.map((v, i) => Math.abs(v - q[i]))); };
  const NBS = new Map(cells.map((t) => [t, X.NB(t.c, t.r).map(([c, r]) => get(c, r)).filter(Boolean)]));
  const nbs = (t) => NBS.get(t);
  const DOCK = get(9, 9);
  const riverCells = RIVER.map(([c, r]) => get(c, r));
  const FLOODS = cells.filter((t) => t.ruin0 === 'marsh' || (t.b0 !== 'lake' && nbs(t).some((n) => n.ruin0 === 'marsh')));
  const HUES = ['#e8587d', '#5f9edd', '#e6e773', '#cfa0ff', '#f39a52', '#7fe0c4'];
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const nameOf = (t) => (t === DOCK ? 'Dock' : t.ruin ? RUINS[t.ruin].name : B[t.b].name);
  const placeOf = (t) => (t === DOCK ? 'at the dock' : `on the ${lower(nameOf(t))}`);
  const moveCost = (t) => (t.ruin ? RUINS[t.ruin].move : B[t.b].move);
  const healthy = (t) => !t.ruin && !t.rot;
  const isForest = (t) => healthy(t) && WOOD[t.b] && t.wood > 0;
  function jobOf(t) {
    if (!t || t === DOCK) return null;
    if (t.rot) return t.ruin === 'mine' ? null : 'burn';
    if (t.ruin === 'deadwood') return 'clear';
    if (t.ruin === 'stumps' || t.ruin === 'bare') return 'plant';
    if (t.ruin === 'dust') return 'compost';
    if (t.ruin === 'dirty') return 'filter';
    if (t.ruin) return null;
    if (WOOD[t.b]) return t.wood > 0 ? 'chop' : null;
    if (FISH.has(t.b)) return 'fish';
    if (FIELD.has(t.b)) return 'farm';
    return null;
  }

  // ---------- state ----------
  let S;
  const toasts = [];
  function fresh() {
    cells.forEach((t) => {
      t.b = t.b0; t.ruin = t.ruin0; t.rot = false; t.own = false; t.work = 0; t.grow = 0; t.heal = 0; t.held = false; t.regen = 0;
      t.wood = t.ruin === 'deadwood' ? DEADWOOD : !t.ruin && WOOD[t.b] ? WOOD[t.b] : 0;
    });
    ROT_START.forEach(([c, r]) => { get(c, r).rot = true; });
    START_OWN.forEach(([c, r]) => { get(c, r).own = true; });
    S = { time: 0, gold: 20, food: 12, logs: 0, workers: [], fx: [], tech: {}, seasonCount: 0, log: [], nextId: 1, bought: 0,
      mealT: 0, warmT: 0, flood: 0, graves: [], dead: 0, over: null };
    toasts.length = 0;
    addWorker();
    redraw();
  }
  const seasonOf = (n) => n % 4;
  const winter = () => seasonOf(S.seasonCount) === WINTER;
  const into = () => S.time - S.seasonCount * SEASON_LEN;
  const crewOn = (t) => S.workers.filter((w) => w.post === t);
  const idle = () => S.workers.filter((w) => !w.post);
  function say(m) { S.log.unshift(m); S.log.length = Math.min(S.log.length, 3); }
  // A notice only reports what has already happened. Deaths stay on screen longer.
  function notice(m, bad) { say(m); toasts.unshift({ text: m, bad, until: performance.now() + (bad ? 15000 : 8000) }); toasts.length = Math.min(toasts.length, 3); }
  function fx(t, text, color) { const p = center(t); S.fx.push({ x: p.x, y: p.y - 10, text, color, t: 0 }); }
  function refreshSeen() { const own = cells.filter((t) => t.own); cells.forEach((t) => { t.seen = own.some((o) => dist(o, t) <= 2); }); }
  function colour() { // share of the valley's land that is alive again
    const land = cells.filter((t) => t.b0 !== 'lake' && !['mountains', 'hills', 'rocks'].includes(t.b0));
    return Math.round((land.filter(healthy).length / land.length) * 100);
  }

  // ---------- save ----------
  const SAVE = 'hexciv-v2-save';
  const idx = (t) => (t ? cells.indexOf(t) : -1);
  function save() {
    if (!S || !S.started) return; // a valley shown behind the menu is not a saved game until you play it
    const data = { ...S, fx: [], cells: cells.map((t) => [t.b, t.ruin, t.rot ? 1 : 0, t.own ? 1 : 0, t.wood, Math.round(t.work), Math.round(t.grow), Math.round(t.heal), t.held ? 1 : 0, Math.round(t.regen)]),
      workers: S.workers.map((w) => ({ id: w.id, name: w.name, hue: w.hue, at: idx(w.at), post: idx(w.post), postJob: w.postJob, carry: w.carry, hungry: w.hungry, hunger: w.hunger, cold: w.cold, chill: w.chill, sick: w.sick })) };
    try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) { /* no storage: the game still plays, it just won't resume */ }
  }
  function loadSave() { try { const v = localStorage.getItem(SAVE); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function load(d) {
    cells.forEach((t, i) => { const c = d.cells[i]; [t.b, t.ruin] = c; t.rot = !!c[2]; t.own = !!c[3]; [, , , , t.wood, t.work, t.grow, t.heal] = c; t.held = !!c[8]; t.regen = c[9]; });
    S = { ...d, fx: [], workers: [] };
    delete S.cells;
    d.workers.forEach((w) => {
      const at = cells[w.at], p = center(at);
      S.workers.push({ ...w, at, post: w.post >= 0 ? cells[w.post] : null, x: p.x, y: p.y, path: [], seg: 0, job: null, timer: 0 });
    });
    toasts.length = 0;
    redraw();
  }

  // ---------- paths ----------
  const flooded = (t) => S.flood > 0 && FLOODS.includes(t);
  const passable = (t) => t.seen && moveCost(t) > 0 && !flooded(t);
  function dijkstra(from) {
    const cost = new Map([[from, 0]]), prev = new Map(), open = [from];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (cost.get(open[i]) < cost.get(open[bi])) bi = i;
      const t = open.splice(bi, 1)[0];
      for (const n of nbs(t)) {
        if (!passable(n)) continue;
        const v = cost.get(t) + moveCost(n);
        if (!cost.has(n) || v < cost.get(n)) { cost.set(n, v); prev.set(n, t); open.push(n); }
      }
    }
    return { cost, prev };
  }

  // ---------- workers ----------
  function addWorker() {
    const p = center(DOCK), used = new Set(S.workers.map((w) => w.name));
    const name = NAMES.find((n) => !used.has(n)) || `Worker ${S.nextId}`;
    S.workers.push({ id: S.nextId++, name, at: DOCK, post: null, postJob: null, x: p.x, y: p.y, path: [], seg: 0, job: null, carry: 0, timer: 0,
      hungry: false, hunger: 0, cold: false, chill: 0, sick: 0, hue: HUES[(S.nextId - 2) % HUES.length] });
  }
  function hire() {
    const c = hireCost(); if (S.gold < c || S.over) return;
    S.gold -= c; addWorker();
    say(`${S.workers[S.workers.length - 1].name} joins the crew for ${c} gold.`);
  }
  const techOk = (j) => !JOBS[j].tech || !!S.tech[JOBS[j].tech];
  function assign(t) {
    const j = jobOf(t); if (!t.own || !j || !techOk(j) || crewOn(t).length >= JOBS[j].slots) return;
    const free = idle(); if (!free.length) return;
    free.sort((a, b) => dist(a.at, t) - dist(b.at, t)); // the idle worker closest to the tile takes the job
    const w = free[0]; w.post = t; w.postJob = j; if (!w.carry) { w.job = null; w.path = w.path.slice(0, 1); }
  }
  function unassign(t) {
    const crew = crewOn(t); if (!crew.length) return;
    const w = crew[crew.length - 1]; w.post = null; if (!w.carry) { w.job = null; w.path = w.path.slice(0, 1); }
  }
  // When a tile's work is done, its crew moves to the closest owned tile nearby with the same job and room, or goes idle.
  function moveOn(t, j) {
    crewOn(t).forEach((w) => {
      const spots = cells.filter((o) => o !== t && o.own && jobOf(o) === j && crewOn(o).length < JOBS[j].slots && dist(o, t) <= 3).sort((a, b) => dist(a, t) - dist(b, t));
      w.post = spots[0] || null; w.postJob = w.post ? j : null;
    });
  }
  function go(w, D, t, job) {
    if (!D.cost.has(t)) { w.job = 'wait'; w.timer = 1; return; } // unreachable for now: try again shortly
    const path = []; let k = t; while (k !== w.at) { path.unshift(k); k = D.prev.get(k); }
    w.path = path; w.seg = 0; w.job = job; w.target = t;
    if (!path.length) arrive(w);
  }
  function plan(w) {
    const D = dijkstra(w.at);
    if (w.carry > 0) return go(w, D, DOCK, 'deliver');
    if (w.post && jobOf(w.post) !== w.postJob) { w.post = null; w.postJob = null; } // the tile changed under them
    if (w.post) return go(w, D, w.post, 'work');
    if (w.at !== DOCK) return go(w, D, DOCK, 'home');
    w.job = 'wait'; w.timer = 1;
  }
  const workTime = (j) => (j === 'fish' ? FISH_TIME / (S.tech.fishing ? 2 : 1) : j === 'farm' ? FARM_TIME : CHOP_TIME / (S.tech.axes ? 2 : 1));
  function arrive(w) {
    if (w.job === 'work') { w.job = 'working'; w.timer = workTime(w.postJob); }
    else if (w.job === 'deliver') { S.logs += w.carry; fx(DOCK, `+${w.carry} log`, '#e2bd78'); w.carry = 0; w.job = null; }
    else w.job = null;
  }
  function stepWorker(w, dt) {
    dt *= w.hungry || w.cold ? 0.5 : w.sick > SICKEN / 4 ? 0.7 : 1;
    if (w.path.length) {
      const n = w.path[0], a = center(w.at), b = center(n);
      if (!passable(n)) { w.path = []; w.job = null; return; }
      w.seg += dt / (STEP * moveCost(n) * (winter() ? SNOW : 1));
      if (w.seg >= 1) { w.at = n; w.path.shift(); w.seg = 0; w.x = b.x; w.y = b.y; if (!w.path.length) arrive(w); }
      else { w.x = a.x + (b.x - a.x) * w.seg; w.y = a.y + (b.y - a.y) * w.seg; }
      return;
    }
    if (w.job === 'working') {
      const t = w.target, j = jobOf(t);
      if (w.post !== t || j !== w.postJob) { w.job = null; return; }
      if (j === 'chop' || j === 'clear') {
        w.timer -= dt;
        if (w.timer <= 0) { w.carry++; fx(t, '+1 log', '#e2bd78'); w.job = null; cut(t, j); }
      } else if (j === 'fish' || j === 'farm') {
        if (winter() && (t.b === 'pond' || j === 'farm')) return; // the pond freezes and fields rest
        w.timer -= dt;
        if (w.timer <= 0) { w.timer = workTime(j); S.food++; fx(t, '+1 food', '#a9d5f0'); }
      } else {
        t.work += dt;
        if (t.work >= JOBS[j].work) finish(t, j);
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
      rot: `${w.name} fell sick from the rot ${where} and did not recover.`,
      flood: `${w.name} drowned in the spring flood ${where}.`,
    }[cause];
    S.workers.splice(S.workers.indexOf(w), 1);
    S.graves.push({ x: Math.round(w.x), y: Math.round(w.y) });
    S.dead++;
    notice(text, true);
    if (!S.workers.length) end(text);
  }

  // ---------- needs: food, firewood, and staying off the rot ----------
  function stepNeeds(dt) {
    const win = winter();
    S.mealT += dt * (win ? 2 : 1);
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
      const exposure = w.at.rot ? 1 : nbs(w.at).some((n) => n.rot) ? 0.4 : 0;
      if (exposure) { w.sick += dt * exposure; if (w.sick >= SICKEN) { die(w, 'rot'); continue; } }
      else w.sick = Math.max(0, w.sick - dt * 0.5);
    }
  }

  // ---------- land ----------
  function cut(t, j) {
    t.wood--; t.regen = 0;
    if (t.wood > 0) return;
    const was = nameOf(t);
    if (t.ruin === 'deadwood') { t.ruin = 'bare'; t.b = 'grass'; }
    else { t.ruin = 'stumps'; if (t.own) notice(`The ${lower(was)} was cut to the last log. Only stumps are left.`); }
    moveOn(t, j);
    redraw();
  }
  function finish(t, j) {
    t.work = 0;
    if (j === 'plant') { t.ruin = 'sapling'; t.grow = 0; }
    else if (j === 'burn') { t.rot = false; t.held = false; }
    else t.ruin = null; // compost and filter return the tile to what it was
    fx(t, 'healed', '#9bcb3e');
    moveOn(t, j);
    redraw();
  }
  function stepLand(dt) {
    if (winter()) return;
    let changed = false;
    for (const t of cells) {
      if (t.rot) continue;
      if (healthy(t) && WOOD[t.b] && t.wood < WOOD[t.b] && !crewOn(t).length) {
        t.regen += dt * (S.tech.forestry ? 2 : 1);
        if (t.regen >= REGEN) { t.regen = 0; t.wood++; }
      } else if (t.ruin === 'sapling') {
        t.grow += dt;
        if (t.grow >= SAPLING_GROW) { t.ruin = null; t.b = 'pines'; t.wood = WOOD.pines; t.regen = 0; changed = true; if (t.seen) fx(t, 'grown', '#9bcb3e'); }
      } else if (t.ruin === 'bare' && t.own && !crewOn(t).length && nbs(t).some((n) => healthy(n) && LIVING.has(n.b) && n !== DOCK)) {
        t.heal += dt;
        if (t.heal >= BARE_HEAL) { t.ruin = null; t.b = 'grass'; t.heal = 0; changed = true; }
      }
    }
    if (changed) redraw();
  }
  // Rot spreads from the mine through every rot tile still joined to it, one tile a season outside winter, toward the dock.
  // A living forest or a clean river holds it back for one season.
  function spreadRot() {
    const mine = cells.find((t) => t.ruin === 'mine'), live = new Set([mine]), q = [mine];
    while (q.length) for (const n of nbs(q.shift())) if (n.rot && !live.has(n)) { live.add(n); q.push(n); }
    const cand = new Set();
    live.forEach((t) => nbs(t).forEach((n) => { if (!n.rot && n.b !== 'lake') cand.add(n); }));
    const n = [...cand].sort((a, b) => dist(a, DOCK) - dist(b, DOCK) || b.r - a.r || a.c - b.c)[0];
    if (!n) return;
    const holds = healthy(n) && (isForest(n) || n.b === 'river');
    if (holds && !n.held) { n.held = true; if (n.seen) fx(n, 'holding', '#9bcb3e'); return; }
    n.rot = true; n.held = false;
    if (n.own) notice(`Rot reached the ${lower(nameOf(n))}.`);
    redraw();
  }
  function spreadDust() {
    const cand = new Set();
    cells.forEach((t) => { if (t.ruin === 'dust' && !t.rot && !crewOn(t).length) nbs(t).forEach((n) => { if (!n.rot && (n.ruin === 'bare' || (healthy(n) && FIELD.has(n.b)))) cand.add(n); }); });
    const n = [...cand].sort((a, b) => dist(a, DOCK) - dist(b, DOCK) || a.c - b.c)[0];
    if (!n) return;
    const was = nameOf(n);
    n.ruin = 'dust'; n.heal = 0;
    if (n.own) notice(`Dust blew onto the ${lower(was)}.`);
    redraw();
  }
  function startFlood() {
    S.flood = FLOOD;
    for (const w of [...S.workers]) if (FLOODS.includes(w.at) || (w.path[0] && FLOODS.includes(w.path[0]) && w.seg > 0.5)) die(w, 'flood');
  }

  // ---------- land and trade ----------
  const touches = (t) => nbs(t).some((n) => n.own);
  const price = (t) => 10 + 5 * S.bought + (t.rot ? 0 : t.ruin ? RUINS[t.ruin].value : VALUE[t.b] || 10);
  const canOwn = (t) => t && !t.own && t.seen && t.b !== 'lake' && touches(t);
  function buy(t) {
    if (!canOwn(t) || S.gold < price(t)) return;
    S.gold -= price(t); S.bought++; t.own = true;
    say(`You bought the ${lower(nameOf(t))}.`);
    refreshSeen(); redraw();
  }
  function sell(what, n) {
    const have = what === 'logs' ? S.logs : S.food; n = Math.min(n, have); if (n <= 0) return;
    const g = n * (what === 'logs' ? LOG_PRICE : FISH_PRICE);
    if (what === 'logs') S.logs -= n; else S.food -= n;
    S.gold += g; fx(DOCK, `+${g}g`, '#e6c35a');
  }
  function newSeason() {
    const s = seasonOf(S.seasonCount);
    if (s !== WINTER) spreadRot();
    if (s === SUMMER) spreadDust();
    if (s === SPRING) startFlood();
    save();
  }
  function end(text) {
    S.over = { text, season: SEASONS[seasonOf(S.seasonCount)].toLowerCase(), year: Math.floor(S.seasonCount / 4) + 1, colour: colour(), dead: S.dead };
    save();
    showEnd();
  }

  // ---------- art: the ruined valley ----------
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
  // fade toward a dusty grey-brown: what is dead loses its colour
  const fade = (h, k) => once(`f${h}${k}`, () => { const [r, g, b] = rgb(h), l = r * 0.3 + g * 0.59 + b * 0.11; return hex([r + (l * 1.04 + 10 - r) * k, g + (l * 0.98 + 2 - g) * k, b + (l * 0.86 - 8 - b) * k]); });
  const mix = (h, h2, k) => once(`m${h}${h2}${k}`, () => { const a = rgb(h), b = rgb(h2); return hex(a.map((v, i) => v + (b[i] - v) * k)); });
  const SCENERY = new Set(['mountains', 'hills', 'rocks']);
  const WATER2 = '#4b86c9', ROT = '#4a3b55', ROT_HI = '#6b5a7a';
  const GREENS = (grass, lime, leaf, pine, flower) => ({ [C.grass]: grass, [C.lime]: lime, [C.leaf]: leaf, [C.pine]: pine, [C.glow]: flower, [C.rose]: flower, [C.sage]: lime });
  const RECOLOR = {
    dust: GREENS(C.sand1, C.clay, C.clay, C.soil, C.sand0),
    bare: GREENS(C.clay, C.sand1, C.soil, C.bark, C.sand1),
    stumps: GREENS(C.soil, C.clay, C.bark, C.bark, C.clay),
    deadwood: GREENS(C.olive, C.clay, C.olive2, C.bark, C.clay),
    sapling: GREENS(C.clay, C.sand1, C.soil, C.bark, C.sand1),
    dirty: { ...GREENS(C.olive, C.olive, C.olive2, C.pine, C.clay), [C.sky]: C.murk, [WATER2]: C.murk2, [C.mist]: C.sage },
    dry: { ...GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay), [C.sky]: C.sand1, [WATER2]: C.clay, [C.mist]: C.stone },
    dam: GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay),
    marsh: { ...GREENS(C.clay, C.sand1, C.soil, C.bark, C.clay), [C.murk]: C.bark, [C.murk2]: '#2a1e22', [C.olive]: C.soil, [C.olive2]: C.bark },
  };
  // hand-placed details, in face coordinates (0..31, 0..27)
  const STUMPS = [[8, 7], [16, 6], [23, 8], [6, 14], [14, 13], [22, 15], [10, 20], [19, 21]];
  const LOGS = [[6, 9, 7], [16, 13, 6], [8, 19, 6], [18, 21, 7]];
  const CRACKS = [[[6, 10], [7, 10], [8, 11], [9, 12], [9, 13], [11, 14]], [[18, 6], [19, 7], [20, 8], [22, 8]], [[15, 18], [16, 19], [17, 20], [16, 21], [17, 22], [19, 23]], [[23, 14], [24, 15], [25, 16], [27, 17]]];
  const SAPLINGS = [[9, 10], [19, 9], [14, 16], [23, 17], [8, 20], [17, 22]];
  const PEBBLES = [[10, 8], [20, 11], [13, 19], [24, 18], [7, 15]];
  function decal(cv, t, orig) {
    const at = (x, y, c) => cv.set(x, y + X.FY, c), R = t.ruin;
    if (R === 'stumps') STUMPS.forEach(([x, y]) => { at(x, y, C.clay); at(x + 1, y, C.sand0); at(x + 2, y, C.clay); at(x, y + 1, C.soil); at(x + 1, y + 1, C.soil); at(x + 2, y + 1, C.bark); at(x, y + 2, C.bark); at(x + 1, y + 2, C.bark); at(x + 2, y + 2, C.ink); });
    if (R === 'deadwood') {
      LOGS.forEach(([x, y, n]) => { for (let i = 0; i < n; i++) { at(x + i, y, C.pale); at(x + i, y + 1, C.stone); at(x + i, y + 2, C.ink); } at(x + n, y, C.ink); at(x + n, y + 1, C.ink); at(x - 1, y + 1, C.cloud); });
      for (let y = -4; y < 12; y++) { at(23, y, C.pale); at(24, y, C.stone); } // a dead snag still standing
      at(21, 0, C.pale); at(22, 1, C.pale); at(25, 3, C.stone); at(26, 2, C.stone); at(22, 12, C.ink); at(23, 12, C.ink); at(24, 12, C.ink); at(25, 12, C.ink);
    }
    if (R === 'dust') {
      CRACKS.forEach((line) => line.forEach(([x, y]) => at(x, y, C.soil)));
      for (const y of [8, 12, 16, 20]) for (let x = 6; x < 26; x++) if (X.inFace(x, y) && x % 3 && (x + y) % 7) { const c = cv.get(x, y + X.FY); if (c === C.sand1) at(x, y, C.clay); } // old furrows
      if (key(t.c, t.r) === HOUSE) { // the settlers' farmhouse, roof fallen in
        for (let x = 11; x < 20; x++) for (let y = 11; y < 17; y++) at(x, y, y === 16 ? C.ink : x === 11 || x === 19 ? C.ink : C.pale);
        for (let x = 12; x < 17; x++) at(x, 10 - Math.min(x - 12, 16 - x), C.bark);
        at(14, 14, C.ink); at(15, 14, C.ink); at(14, 15, C.ink); at(15, 15, C.ink); at(17, 12, C.ink); at(13, 12, C.soil); at(18, 9, C.bark); at(19, 10, C.bark);
      }
    }
    if (R === 'bare') PEBBLES.forEach(([x, y]) => { at(x, y, C.pale); at(x + 1, y, C.stone); });
    if (R === 'sapling') SAPLINGS.forEach(([x, y]) => { at(x, y, C.soil); at(x, y - 1, C.grass); at(x - 1, y - 2, C.lime); at(x, y - 2, C.grass); at(x + 1, y - 2, C.lime); at(x, y - 3, C.lime); });
    if (R === 'dry') for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) { if (orig[(y + X.FY) * cv.w + x] === C.sky && (x * 7 + y * 3) % 13 === 0) at(x, y, C.pale); }
    if (R === 'dam') {
      for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) { // still, murky water behind the wall; a dry bed below it
        const o = orig[(y + X.FY) * cv.w + x];
        if (o === C.sky || o === WATER2 || o === C.mist) at(x, y, y < 12 ? (o === WATER2 ? C.murk2 : C.murk) : o === WATER2 ? C.clay : C.sand1);
      }
      for (let x = 2; x < 30; x++) if (X.inFace(x, 13)) { at(x, 12, C.ink); at(x, 13, C.clay); at(x, 14, C.soil); at(x, 15, C.ink); }
      for (const px0 of [6, 15, 24]) for (let y = 10; y < 16; y++) { at(px0, y, C.pale); at(px0 + 1, y, C.stone); }
    }
    if (R === 'mine') {
      for (let y = 10; y < 17; y++) for (let x = 13; x < 20; x++) at(x, y, x === 13 || x === 19 || y === 10 ? C.clay : C.ink);
      for (let y = 17; y < 27; y++) { const w = Math.max(1, 4 - Math.floor((y - 17) / 3)); for (let x = 16 - (w >> 1); x < 16 - (w >> 1) + w; x++) if (X.inFace(x, y)) at(x, y, (x + y) % 2 ? ROT : ROT_HI); }
      for (let x = 21; x < 25; x++) { at(x, 17, C.stone); at(x, 18, C.stone); } at(21, 19, C.ink); at(24, 19, C.ink); at(22, 16, C.soil); // an old ore cart
    }
  }
  function paintTile(t, v, ctx) {
    const look = t.ruin ? RUINS[t.ruin].look : t.b;
    const cv = X.cloverTile(look, v, ctx).cv, orig = cv.px.slice();
    const map = RECOLOR[t.ruin];
    if (map) cv.px = cv.px.map((c) => c && (map[c] || c));
    decal(cv, t, orig);
    const k = t.ruin ? RUINS[t.ruin].fade : SCENERY.has(t.b) ? 0.65 : 0; // bare hills and peaks sit grey around the valley
    if (k) cv.px = cv.px.map((c) => c && fade(c, k));
    if (t.rot) cv.px = cv.px.map((c, i) => { if (!c) return c; const x = i % cv.w, y = Math.floor(i / cv.w); return (x * 3 + y * 5) % 7 === 0 ? ROT_HI : mix(c, ROT, 0.6); });
    return cv;
  }

  // ---------- render ----------
  const canvas = document.getElementById('map'), cx = canvas.getContext('2d'), tip = document.getElementById('tip');
  const scene = document.createElement('canvas'), sx = scene.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  let R, scale = 2, offX = 0, offY = 0, dpr = 1, hover = null, sel = null, anim = [];
  const COLS = 16, ROWS = 11, MW = 24 * (COLS - 1) + 32, MH = X.FY + 28 * ROWS + 14 + 3;
  function redraw() {
    refreshSeen();
    const ctxs = X.contexts({ cells: cells.map((t) => ({ c: t.c, r: t.r, b: t.ruin ? RUINS[t.ruin].look : t.b })), river: RIVER });
    const px = new Array(MW * MH).fill(null), drawn = new Int16Array(MW * MH).fill(-1), owner = new Int16Array(MW * MH).fill(-1);
    const order = cells.map((t, i) => ({ t, i, ...X.at(t.c, t.r) })).sort((a, b) => a.y - b.y || a.t.c - b.t.c);
    order.forEach(({ t, i, x: ox, y: oy }) => {
      const img = paintTile(t, (t.c * 5 + t.r * 3) % 2, ctxs.get(key(t.c, t.r)));
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = img.px[y * img.w + x]; if (c && ox + x < MW && oy + y < MH) { px[(oy + y) * MW + ox + x] = c; drawn[(oy + y) * MW + ox + x] = i; } }
      for (let y = 0; y < X.FH; y++) for (let x = 0; x < X.FW; x++) if (X.inFace(x, y)) owner[(oy + X.FY + y) * MW + ox + x] = i;
    });
    R = { w: MW, h: MH, owner };
    base.width = scene.width = MW; base.height = scene.height = MH;
    const im = bx.createImageData(MW, MH), sky = rgb('#a9d5f0');
    for (let i = 0; i < MW * MH; i++) {
      const c = px[i], v = c ? rgb(c) : sky, o = i * 4, t = c ? cells[drawn[i]] : null;
      let k = 1, add = [0, 0, 0];
      if (t && !t.seen) { k = 0.28; add = [20, 26, 38]; } // fog
      else if (t && !t.own && t.b0 !== 'lake') k = 0.84;  // land you don't own is drawn a little dimmer
      im.data[o] = v[0] * k + add[0]; im.data[o + 1] = v[1] * k + add[1]; im.data[o + 2] = v[2] * k + add[2]; im.data[o + 3] = c ? 255 : 0;
    }
    // your border: a cream line on your side, ink on the other
    const lit = (i, c) => { const o = i * 4; [im.data[o], im.data[o + 1], im.data[o + 2]] = rgb(c); };
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      const i = y * MW + x, a = owner[i]; if (a < 0) continue;
      const ta = cells[a];
      for (const j of [i - 1, i + 1, i - MW, i + MW]) {
        const b = owner[j]; if (b < 0 || b === a) continue;
        const tb = cells[b];
        if (ta.own && !tb.own && tb.b0 !== 'lake') lit(i, '#f4f6ea');
        else if (!ta.own && tb.own && ta.b0 !== 'lake' && ta.seen) lit(i, '#141d26');
      }
    }
    bx.putImageData(im, 0, 0);
    // life is motion: only living, visible tiles get glints and birds
    anim = [];
    cells.forEach((t) => {
      if (!t.seen || !healthy(t) || t === DOCK) return;
      const p = center(t), ph = (t.c * 7 + t.r * 13) % 10;
      if (['pond', 'river', 'lake', 'beach', 'swamp'].includes(t.b)) anim.push({ kind: 'glint', x: p.x - 6 + (ph % 5) * 2, y: p.y - 3 + (ph % 3) * 2, ph }, { kind: 'glint', x: p.x + 3 - (ph % 4), y: p.y + 4 - (ph % 2) * 3, ph: ph + 3 });
      if (isForest(t)) anim.push({ kind: 'bird', x: p.x, y: p.y - 14, ph });
    });
    fit();
  }
  function fit() {
    if (!R) return;
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const vw = innerWidth, vh = innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    const s = Math.min(vw / R.w, vh / R.h);
    scale = s >= 2 ? Math.floor(s) : s; // whole pixels when there is room, otherwise fill the screen
    offX = Math.round((vw - R.w * scale) / 2); offY = Math.round((vh - R.h * scale) / 2);
  }
  const px = (x, y, w, h, c) => { sx.fillStyle = c; sx.fillRect(Math.round(x), Math.round(y), w, h); };
  function drawLog(x, y) { px(x, y, 5, 2, '#77513c'); px(x, y + 1, 5, 1, '#3f2b31'); px(x + 4, y, 1, 2, '#e2bd78'); }
  function drawDock(now) {
    const p = center(DOCK);
    px(p.x - 3, p.y + 2, 12, 3, '#b57f52'); px(p.x - 3, p.y + 4, 12, 1, '#77513c');
    for (let i = 0; i < 4; i++) px(p.x - 2 + i * 3, p.y + 5, 1, 3, '#3f2b31');
    const hx = p.x - 13, hy = p.y - 7; // the crew's hut, with a fire going while anyone is alive
    px(hx, hy + 3, 9, 6, '#b57f52'); px(hx, hy + 8, 9, 1, '#3f2b31'); px(hx - 1, hy + 1, 11, 2, '#c0473f'); px(hx + 1, hy, 7, 1, '#c0473f');
    px(hx + 3, hy + 5, 3, 4, '#141d26'); px(hx + 7, hy - 2, 2, 3, '#5f6e8a');
    if (S.workers.length) for (let i = 0; i < 3; i++) { const f = (now * 0.6 + i / 3) % 1; px(hx + 7 + Math.round(Math.sin((f + i) * 6) * 1.5), hy - 4 - f * 12, f < 0.5 ? 2 : 1, f < 0.5 ? 2 : 1, '#f4f6ea'); }
    if (S.logs > 0) for (let i = 0; i < Math.min(5, Math.ceil(S.logs / 4)); i++) drawLog(p.x + 2 + (i % 2) * 3, p.y - 3 - Math.floor(i / 2) * 2);
  }
  const TOOL = { chop: ['#77513c', '#a3b5c4'], clear: ['#77513c', '#a3b5c4'], farm: ['#77513c', '#b57f52'], plant: ['#77513c', '#9bcb3e'], compost: ['#77513c', '#5f6e8a'], burn: ['#77513c', '#f39a52'], filter: ['#9bcb3e', '#e2bd78'] };
  function drawWorker(w, now) {
    const walking = w.path.length > 0, bob = walking ? Math.floor(now * 8) % 2 : 0, shiver = w.cold ? (Math.floor(now * 12) % 2) : 0;
    const x = Math.round(w.x) - 1 + ((w.id * 5) % 7) - 3 + shiver, y = Math.round(w.y) - 7 - bob + ((w.id * 3) % 5) - 2;
    const sick = w.sick > SICKEN / 4, body = sick ? mix(w.hue, '#a3b5c4', 0.6) : w.hue;
    px(x, y + 6, 1, 1, '#141d26'); px(x + 2, y + 6, 1, 1, '#141d26');
    px(x, y + 3, 3, 3, body); px(x, y + 5, 3, 1, '#1a3445');
    px(x, y, 3, 3, sick ? '#c3d3e0' : '#f0c08a'); px(x, y, 3, 1, '#3f2b31');
    const j = w.post && w.postJob;
    if (j === 'fish') { px(x + 3, y - 2, 1, 6, '#77513c'); if (w.job === 'working') px(x + 4, y - 2, 1, 1, '#f4f6ea'); }
    else if (j) { const [h, head] = TOOL[j]; px(x + 3, y + 2, 1, 3, h); px(x + 3, y + 1, 2, 2, j === 'burn' && Math.floor(now * 6) % 2 ? '#e6e773' : head); }
    for (let i = 0; i < w.carry; i++) drawLog(x - 1, y - 3 - i * 2);
    if (w.job === 'working' && Math.floor(now * 4) % 2) px(x + 4, y + 1, 2, 1, '#f4f6ea');
    if (w.cold) px(x + 3 + (Math.floor(now * 3) % 2), y + 1, 1, 1, '#dce7ee'); // breath in the cold
    if (w.hungry) { const bx2 = x - 1, by = y - 9 - w.carry * 2; px(bx2, by, 6, 5, '#f4f6ea'); px(bx2 + 1, by + 2, 4, 2, '#b57f52'); px(bx2 + 2, by + 3, 2, 1, '#77513c'); px(bx2 + 1, by + 5, 1, 1, '#f4f6ea'); } // an empty bowl
    if (!w.post && w.at === DOCK && !w.path.length && Math.floor(now * 2) % 2) px(x + 1, y - 4, 1, 2, '#e6e773'); // idle: waiting for a job
  }
  function drawGrave(g) { px(g.x - 1, g.y - 4, 3, 4, '#a3b5c4'); px(g.x - 1, g.y - 4, 1, 4, '#dce7ee'); px(g.x, g.y - 3, 1, 2, '#5f6e8a'); px(g.x - 2, g.y, 5, 1, '#3f2b31'); }
  function label(text, x, y, color) { cx.lineWidth = 3 * dpr; cx.strokeStyle = '#141d26'; cx.strokeText(text, x, y); cx.fillStyle = color; cx.fillText(text, x, y); }
  function render(now) {
    sx.clearRect(0, 0, R.w, R.h);
    sx.drawImage(base, 0, 0);
    const s = seasonOf(S.seasonCount);
    for (const a of anim) {
      if (a.kind === 'glint' && Math.sin(now * 1.7 + a.ph) > 0.55) px(a.x, a.y, 2, 1, '#f4f6ea');
      if (a.kind === 'bird' && s !== WINTER) { const ang = now * 0.7 + a.ph, bx2 = a.x + Math.cos(ang) * 8, by = a.y + Math.sin(ang) * 3, f = Math.floor(now * 5 + a.ph) % 2; px(bx2, by + f, 1, 1, '#141d26'); px(bx2 + 1, by + 1 - f, 1, 1, '#141d26'); px(bx2 + 2, by + f, 1, 1, '#141d26'); }
    }
    S.graves.forEach(drawGrave);
    drawDock(now);
    [...S.workers].sort((a, b) => a.y - b.y).forEach((w) => drawWorker(w, now));
    sx.globalCompositeOperation = 'source-atop'; // season tints stay on the land
    if (s === WINTER) { sx.fillStyle = 'rgba(220,231,238,0.22)'; sx.fillRect(0, 0, R.w, R.h); }
    else if (s === 2) { sx.fillStyle = 'rgba(243,154,82,0.08)'; sx.fillRect(0, 0, R.w, R.h); }
    sx.globalCompositeOperation = 'source-over';
    // the spring flood, and the water seeping up before it
    const seep = s === WINTER && into() > SEASON_LEN - SEEP;
    if (S.flood > 0 || seep) FLOODS.forEach((t) => {
      if (!t.seen) return;
      const p = X.at(t.c, t.r);
      if (S.flood > 0) sx.drawImage(waterHex, p.x, p.y + X.FY);
      else for (let i = 0; i < 4; i++) if (Math.sin(now * 3 + i * 1.7 + t.c) > 0.2) px(p.x + 7 + ((i * 7 + t.r * 3) % 18), p.y + X.FY + 6 + ((i * 5 + t.c) % 15), 2, 1, '#5f9edd');
    });
    if (hover && hover !== sel) { const p = X.at(hover.c, hover.r); sx.drawImage(ring, p.x, p.y + X.FY); }
    if (sel) { const p = X.at(sel.c, sel.r); sx.drawImage(ringSel, p.x, p.y + X.FY); }
    // scale up onto the screen, then draw text at screen resolution
    const k = scale * dpr, ox = offX * dpr, oy = offY * dpr;
    cx.fillStyle = '#a9d5f0'; cx.fillRect(0, 0, canvas.width, canvas.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(scene, ox, oy, R.w * k, R.h * k);
    cx.textAlign = 'center'; cx.font = `600 ${Math.round(Math.max(11, 5.5 * scale) * dpr)}px "Pixelify Sans", monospace`;
    for (const f of S.fx) {
      cx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      label(f.text, ox + f.x * k, oy + (f.y - f.t * 10) * k, f.color);
      cx.globalAlpha = 1;
    }
  }
  function hexShape(color, edgeOnly) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 28;
    const rc = c.getContext('2d'); rc.fillStyle = color;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) if (X.inFace(x, y) && (!edgeOnly || !X.inFace(x - 1, y) || !X.inFace(x + 1, y) || !X.inFace(x, y - 1) || !X.inFace(x, y + 1))) rc.fillRect(x, y, 1, 1);
    return c;
  }
  const ring = hexShape('#f4f6ea', true), ringSel = hexShape('#e6c35a', true), waterHex = hexShape('rgba(95,158,221,0.6)', false);

  // ---------- input ----------
  function cellAt(e) {
    const x = Math.floor((e.clientX - offX) / scale), y = Math.floor((e.clientY - offY) / scale);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? cells[o] : null;
  }
  canvas.addEventListener('pointerdown', (e) => { if (!running()) return; select(cellAt(e)); });
  canvas.addEventListener('pointermove', (e) => {
    hover = running() ? cellAt(e) : null;
    if (!hover || e.pointerType === 'touch' || hover === sel) { tip.style.display = 'none'; return; }
    const t = hover;
    tip.innerHTML = `<b>${t.seen ? (t.rot && t.ruin !== 'mine' ? 'Rot' : nameOf(t)) : 'Unexplored'}</b><span>${t.seen ? tileLine(t) : 'Under fog'}</span>`;
    tip.style.display = 'block';
    let lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + tip.offsetWidth > innerWidth - 8) lx = e.clientX - tip.offsetWidth - 12;
    if (ly + tip.offsetHeight > innerHeight - 8) ly = e.clientY - tip.offsetHeight - 12;
    tip.style.left = `${lx}px`; tip.style.top = `${ly}px`;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; tip.style.display = 'none'; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 80); });
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  // ---------- tile panel ----------
  const $ = (id) => document.getElementById(id);
  function tileLine(t) {
    if (t === DOCK) return `Your dock. ${S.logs} logs and ${S.food} food in store.`;
    const j = jobOf(t), crew = crewOn(t).length;
    const own = t.own ? '' : canOwn(t) ? ` · ${price(t)}g to buy` : ' · not yours';
    if (t.rot) return `Rot over ${lower(nameOf(t))}${own}`;
    if (j === 'chop' || j === 'clear') return `${t.wood} logs left · ${crew}/${JOBS[j].slots} ${JOBS[j].who}s${own}`;
    if (j && JOBS[j].work) return `${Math.round((t.work / JOBS[j].work) * 100)}% healed · ${crew}/${JOBS[j].slots} ${JOBS[j].who}s${own}`;
    if (j) return `${crew}/${JOBS[j].slots} ${JOBS[j].who}s${own}`;
    if (t.ruin === 'sapling') return winter() ? 'Saplings, resting through winter' : `Saplings, ${Math.round((t.grow / SAPLING_GROW) * 100)}% grown${own}`;
    return `${t.ruin ? RUINS[t.ruin].name : B[t.b].name}${own}`;
  }
  function select(t) {
    sel = t && t.seen ? t : null;
    tip.style.display = 'none';
    lastKey = '';
  }
  function updateTilePanel() {
    const t = sel, panel = $('tilePanel');
    panel.hidden = !t;
    if (!t) return;
    const j = jobOf(t), crew = crewOn(t), free = idle().length, dock = t === DOCK;
    $('tName').textContent = t.rot && t.ruin !== 'mine' ? 'Rot' : nameOf(t);
    let info = dock ? 'Your crew lives here. Logs and food are stored here, and boats buy what you sell.'
      : t.rot && t.ruin !== 'mine' ? `Rot from the mine has spread over this ${lower(nameOf(t))}. Nothing grows, and workers on it or next to it fall sick.`
        : t.ruin ? RUINS[t.ruin].text : LIVE_TEXT[t.b] || (moveCost(t) ? `${B[t.b].name}. Nothing to do here yet.` : 'Open water.');
    if (j && JOBS[j].work && t.work > 0) info += ` ${Math.round((t.work / JOBS[j].work) * 100)}% done.`;
    if ((j === 'chop' || j === 'clear') && t.own) info += ` ${t.wood} logs left.`;
    if (t.ruin === 'sapling') info += ` ${Math.round((t.grow / SAPLING_GROW) * 100)}% grown.`;
    $('tInfo').textContent = info;
    const slots = t.own && j && techOk(j) ? JOBS[j].slots : 0;
    $('tSlots').innerHTML = Array.from({ length: slots }, (_, i) => `<div class="slot${i < crew.length ? ' on' : ''}"><img alt="${i < crew.length ? 'worker' : 'empty slot'}" src="${icon('pop')}"></div>`).join('');
    $('tActs').hidden = !slots;
    $('tMinus').disabled = !crew.length;
    $('tPlus').disabled = !free || crew.length >= slots;
    if (j) $('tPlus').textContent = `+ ${JOBS[j].who}`;
    const buyable = canOwn(t);
    $('tBuy').hidden = !buyable;
    if (buyable) { $('tBuy').innerHTML = `Buy this land <span class="cost">${price(t)}g</span>`; $('tBuy').disabled = S.gold < price(t); }
    $('tDock').hidden = !dock;
    if (dock) {
      $('sellLogs').innerHTML = `Sell 5 logs <span class="cost">+${5 * LOG_PRICE}g</span>`; $('sellLogs').disabled = S.logs < 1;
      $('sellFood').innerHTML = `Sell 5 food <span class="cost">+${5 * FISH_PRICE}g</span>`; $('sellFood').disabled = S.food < 1;
    }
    let note = '';
    if (dock) note = free ? `${free} idle at the dock.` : '';
    else if (!t.own) note = buyable ? (S.gold < price(t) ? `You have ${S.gold} gold.` : '') : t.b0 === 'lake' ? '' : 'Only land next to your border can be bought.';
    else if (j && !techOk(j)) note = `${JOBS[j].who[0].toUpperCase()}${JOBS[j].who.slice(1)}s need ${TECH.find((q) => q.id === JOBS[j].tech).name} from the tech tree.`;
    else if (slots) note = crew.length >= slots ? 'This tile is full.' : free ? `${free} idle at the dock.` : `No one is idle. Hire for ${hireCost()} gold, or move someone.`;
    $('tNote').textContent = note;
  }
  $('tClose').addEventListener('click', () => select(null));
  $('tPlus').addEventListener('click', () => { if (sel) assign(sel); lastKey = ''; });
  $('tMinus').addEventListener('click', () => { if (sel) unassign(sel); lastKey = ''; });
  $('tBuy').addEventListener('click', () => { if (sel) buy(sel); lastKey = ''; });
  $('sellLogs').addEventListener('click', () => { sell('logs', 5); lastKey = ''; });
  $('sellFood').addEventListener('click', () => { sell('food', 5); lastKey = ''; });

  // ---------- HUD ----------
  document.querySelectorAll('img[data-ic]').forEach((im) => { im.src = icon(im.dataset.ic); });
  const RES = [
    { id: 'gold', icon: 'coin', name: 'Gold', val: () => S.gold },
    { id: 'pop', icon: 'pop', name: 'Crew', val: () => { const n = idle().length; return n ? `${S.workers.length} · ${n} idle` : S.workers.length; } },
    { id: 'food', icon: 'food', name: 'Food', val: () => S.food, warn: () => S.workers.some((w) => w.hungry) },
    { id: 'logs', icon: 'log', name: 'Logs', val: () => S.logs, warn: () => S.workers.some((w) => w.cold) },
  ];
  $('res').innerHTML = RES.map((r) => `<div class="panel chip" id="r-${r.id}" title="${r.name}"><img class="ic" alt="${r.name}" src="${icon(r.icon)}"><div><b>0</b><small>${r.name}</small></div></div>`).join('');
  let speed = 1, view = 'menu';
  const running = () => view === 'game';
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
  $('hire').addEventListener('click', () => { hire(); lastKey = ''; });
  let lastKey = '', lastNotes = '';
  function updateHud() {
    const s = seasonOf(S.seasonCount);
    $('season').textContent = SEASONS[s];
    $('year').textContent = `Year ${Math.floor(S.seasonCount / 4) + 1}`;
    $('seasonBar').style.width = `${(into() / SEASON_LEN) * 100}%`;
    $('seasonBar').style.background = ['#7fe0c4', '#c9e05a', '#f39a52', '#a9d5f0'][s];
    RES.forEach((r) => { const el = $(`r-${r.id}`); el.querySelector('b').textContent = r.val(); el.classList.toggle('warn', !!(r.warn && r.warn())); });
    const nowMs = performance.now();
    for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].until < nowMs) toasts.splice(i, 1);
    const nk = toasts.map((n) => n.text).join('|');
    if (nk !== lastNotes) { lastNotes = nk; $('notes').innerHTML = toasts.map((n) => `<div class="panel notice${n.bad ? ' bad' : ''}">${n.text}</div>`).join(''); }
    const k = [S.gold, S.food, S.logs, S.workers.map((w) => `${idx(w.post)}${w.hungry}${w.cold}`).join(), S.log.join(), Object.keys(S.tech).join(), s,
      sel && idx(sel), sel && sel.wood, sel && sel.ruin, sel && sel.rot, sel && sel.own, sel && Math.round(sel.work / 3), sel && Math.round(sel.grow / 7)].join('|');
    if (k === lastKey) return;
    lastKey = k;
    $('hireCost').textContent = `${hireCost()}g`;
    $('hire').disabled = S.gold < hireCost();
    $('treeBtn').querySelector('.lbl').textContent = TECH.some((t) => canBuy(t)) ? 'Tech •' : 'Tech';
    $('log').innerHTML = S.log.map((m) => `<li>${m}</li>`).join('');
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
    fresh(); sel = null; save(); show('game');
  });
  $('again').addEventListener('click', () => { fresh(); sel = null; save(); show('game'); });

  // ---------- tech tree ----------
  const owned = (t) => !!S.tech[t.id];
  const unlocked = (t) => !t.needs || !!S.tech[t.needs];
  const afford = (t) => S.gold >= t.cost && S.logs >= (t.logs || 0) && S.food >= (t.food || 0);
  const canBuy = (t) => !t.soon && !owned(t) && unlocked(t) && afford(t);
  $('treeBtn').addEventListener('click', () => { drawTree(); show('tree'); });
  $('treeBack').addEventListener('click', () => show('game'));
  const graph = $('graph');
  graph.insertAdjacentHTML('beforeend', TECH.map((t) => `<button class="node" id="n-${t.id}" style="left:${t.x}%;top:${t.y}%" aria-label="${t.name}"><img alt="" src="${icon(t.icon)}"><span>${t.name}</span></button>`).join(''));
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
  let last = performance.now(), saveT = 0;
  function advance(dt) {
    S.time += dt;
    const sc = Math.floor(S.time / SEASON_LEN);
    if (sc !== S.seasonCount) { S.seasonCount = sc; newSeason(); }
    if (S.flood > 0) S.flood = Math.max(0, S.flood - dt);
    [...S.workers].forEach((w) => stepWorker(w, dt));
    stepNeeds(dt); stepLand(dt);
  }
  function frame(now) {
    const dt = running() && !S.over ? Math.min(0.1, (now - last) / 1000) * speed : 0; last = now;
    if (S) {
      if (dt > 0) { advance(dt); saveT += dt / speed; if (saveT > 5) { saveT = 0; save(); } }
      const rdt = Math.min(0.1, dt);
      S.fx.forEach((f) => { f.t += rdt; });
      S.fx = S.fx.filter((f) => f.t < 1.2);
      render(now / 1000);
      updateHud();
    }
    requestAnimationFrame(frame);
  }
  // The valley shows behind the menu: the saved one if there is one, otherwise a fresh one.
  const saved = loadSave();
  if (saved && !saved.over) { try { load(saved); } catch (e) { fresh(); } } else fresh();
  openMenu();
  requestAnimationFrame(frame);
  window.HexCivGame = { get state() { return S; }, hire, assign, unassign, select, buy, sell, cells, get, show, jobOf, price, die, spreadRot, newSeason, redraw, screenOf(c, r) { const p = center(get(c, r)); return { x: offX + p.x * scale, y: offY + (p.y + 4) * scale }; }, run(sec) { for (let i = 0; i < sec * 10 && !S.over; i++) advance(0.1); }, reveal() { cells.forEach((t) => { t.own = true; }); redraw(); } };
})();
