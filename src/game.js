// HexCiv prototype: tap a tile and assign workers to it. Lumberjacks chop and haul logs to the dock, fishers feed the
// crew, workers cost gold and food each season, a tech tree speeds everything up, and the dock posts contracts.
// Cut forests grow back. See docs/game-design.md.
(() => {
  const X = buildHexTiles(), icon = buildHudIcons();
  const B = X.BIOMES, MAP = X.MAPS.world, RIVER = MAP.river;

  // ---------- tuning ----------
  const SEASON_LEN = 60;              // seconds per season
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const WINTER = 3;
  const CHOP_TIME = 4;                // seconds to cut one log by hand; Axes halve it
  const FISH_TIME = 8;                // seconds per fish; Fishing nets halve it
  const STEP = 0.45;                  // seconds per point of move cost
  const SNOW = 1.6;                   // winter walking slowdown
  const RAFT_STEP = 0.7;              // seconds per river tile
  const LOG_PRICE = 2, PLANK_PRICE = 6, MILL_TIME = 3;
  const UPKEEP = 2, EAT = 1;          // gold and food per worker per season
  const SLOW = 0.5;                   // speed of a worker who is unpaid or hungry
  const REGROW = 70;                  // seconds for cut land to grow back one stage (outside winter)
  const hireCost = () => 15 + 5 * Math.max(0, S.workers.length - 1);
  const WOOD = { forest: { wood: 18, next: 'pines' }, pines: { wood: 12, next: 'grass' }, grove: { wood: 10, next: 'grass' } };
  const FISH = new Set(['beach', 'pond']);
  const SLOTS = { wood: 3, fish: 2 };
  // x, y place the node on the tree (percent of the board)
  const TECH = [
    { id: 'axes', name: 'Axes', icon: 'axe', cost: 40, x: 30, y: 14, text: 'Lumberjacks chop twice as fast.' },
    { id: 'fishing', name: 'Fishing nets', icon: 'fishing', cost: 30, x: 76, y: 14, text: 'Fishers catch twice as many fish.' },
    { id: 'baskets', name: 'Baskets', icon: 'basket', cost: 50, x: 12, y: 40, needs: 'axes', text: 'Lumberjacks carry 3 logs per trip instead of 1.' },
    { id: 'sawmill', name: 'Sawmill', icon: 'sawmill', cost: 80, x: 36, y: 40, needs: 'axes', text: `Built at the dock. Turns 2 logs into 1 plank, which sells for ${PLANK_PRICE} gold.` },
    { id: 'forestry', name: 'Forestry', icon: 'forestry', cost: 60, x: 60, y: 40, needs: 'axes', text: 'Cut land grows back twice as fast.' },
    { id: 'farms', name: 'Farms', icon: 'farms', x: 84, y: 40, needs: 'fishing', soon: true, text: 'Fields of wheat on grassland and meadow. Coming in a later prototype.' },
    { id: 'rafting', name: 'Log rafting', icon: 'raft', cost: 100, x: 12, y: 66, needs: 'baskets', text: 'Lumberjacks drop logs into the nearest river tile and the river floats them to the dock. The river freezes in winter.' },
    { id: 'stone', name: 'Stone', icon: 'stone', x: 36, y: 66, needs: 'sawmill', soon: true, text: 'Quarry boulder fields and hills for stone. Coming in a later prototype.' },
    { id: 'mining', name: 'Mining', icon: 'mining', x: 36, y: 88, needs: 'stone', soon: true, text: 'Mines in the mountains for ore and coal. Coming in a later prototype.' },
  ];
  const CONTRACTS = [
    { item: 'logs', n: 25, reward: 60, reveal: true, text: 'The harbourmaster wants 25 logs for a new pier.' },
    { item: 'planks', n: 12, reward: 150, text: 'A shipwright wants 12 planks for a riverboat.' },
  ];

  // ---------- map helpers ----------
  const key = (c, r) => `${c},${r}`;
  const byKey = new Map(MAP.cells.map((t) => [key(t.c, t.r), t]));
  const get = (c, r) => byKey.get(key(c, r));
  const center = (t) => { const p = X.at(t.c, t.r); return { x: p.x + 16, y: p.y + X.FY + 14 }; };
  const cube = (t) => { const x = t.c, z = t.r - (t.c - (t.c & 1)) / 2; return [x, -x - z, z]; };
  const dist = (a, b) => { const p = cube(a), q = cube(b); return Math.max(...p.map((v, i) => Math.abs(v - q[i]))); };
  const nbs = (t) => X.NB(t.c, t.r).map(([c, r]) => get(c, r)).filter(Boolean);
  const DOCK = get(9, 9);
  const riverCells = RIVER.map(([c, r]) => get(c, r));
  const ORIG = MAP.cells.map((t) => t.b);
  const HUES = ['#e8587d', '#5f9edd', '#e6e773', '#cfa0ff', '#f39a52', '#7fe0c4'];
  const kind = (t) => (t === DOCK ? 'dock' : t.wood > 0 ? 'wood' : FISH.has(t.b) ? 'fish' : null);

  // ---------- state ----------
  let S;
  function fresh() {
    MAP.cells.forEach((t, i) => {
      t.b = ORIG[i]; t.wood = WOOD[t.b] ? WOOD[t.b].wood : 0; t.regrow = 0;
      t.seen = dist(t, DOCK) <= 2 || riverCells.some((v) => dist(t, v) <= 2);
    });
    S = { time: 0, gold: 10, food: 10, logsSold: 0, planks: 0, workers: [], rafts: [], fx: [], tech: {}, mill: 0, millT: 0,
      contract: 0, base: { logs: 0, planks: 0 }, late: false, deadline: WINTER, seasonCount: 0, log: [], nextId: 1 };
    addWorker();
    say('Spring, year 1. Your first worker waits at the dock for a job.');
    redraw();
  }
  const seasonOf = (n) => n % 4;
  const winter = () => seasonOf(S.seasonCount) === WINTER;
  const cap = () => (S.tech.baskets ? 3 : 1);
  const workerName = (w) => `Worker ${S.workers.indexOf(w) + 1}`;
  const crewOn = (t) => S.workers.filter((w) => w.post === t);
  const idle = () => S.workers.filter((w) => !w.post);
  function say(m) { S.log.unshift(m); S.log.length = Math.min(S.log.length, 3); }
  function fx(t, text, color) { const p = center(t); S.fx.push({ x: p.x, y: p.y - 10, text, color, t: 0 }); }

  // ---------- save ----------
  const SAVE = 'hexciv-save-v3';
  const idx = (t) => (t ? MAP.cells.indexOf(t) : -1);
  function save() {
    if (!S) return;
    const data = { ...S, fx: [], cells: MAP.cells.map((t) => [t.b, t.wood, t.seen ? 1 : 0, Math.round(t.regrow)]),
      workers: S.workers.map((w) => ({ id: w.id, at: idx(w.at), post: idx(w.post), carry: w.carry, paid: w.paid, hue: w.hue })) };
    try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) { /* no storage: the game still plays, it just won't resume */ }
  }
  function loadSave() { try { const v = localStorage.getItem(SAVE); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function load(d) {
    MAP.cells.forEach((t, i) => { const c = d.cells[i]; t.b = c[0]; t.wood = c[1]; t.seen = !!c[2]; t.regrow = c[3]; });
    S = { ...d, fx: [], workers: [] };
    delete S.cells;
    d.workers.forEach((w) => {
      const at = MAP.cells[w.at], p = center(at);
      S.workers.push({ ...w, at, post: w.post >= 0 ? MAP.cells[w.post] : null, x: p.x, y: p.y, path: [], seg: 0, job: null, timer: 0, unpaid: false });
    });
    redraw();
  }

  // ---------- paths ----------
  const passable = (t) => t.seen && B[t.b].move > 0;
  function dijkstra(from) {
    const cost = new Map([[from, 0]]), prev = new Map(), open = [from];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (cost.get(open[i]) < cost.get(open[bi])) bi = i;
      const t = open.splice(bi, 1)[0];
      for (const n of nbs(t)) {
        if (!passable(n)) continue;
        const v = cost.get(t) + B[n.b].move;
        if (!cost.has(n) || v < cost.get(n)) { cost.set(n, v); prev.set(n, t); open.push(n); }
      }
    }
    return { cost, prev };
  }
  function nearest(D, list) { let best = null; for (const t of list) { const d = D.cost.get(t); if (d !== undefined && (!best || d < best.d)) best = { t, d }; } return best; }

  // ---------- workers ----------
  function addWorker() {
    const p = center(DOCK);
    S.workers.push({ id: S.nextId++, at: DOCK, post: null, x: p.x, y: p.y, path: [], seg: 0, job: null, carry: 0, timer: 0, paid: S.seasonCount, unpaid: false, hue: HUES[S.workers.length % HUES.length] });
  }
  function hire() {
    const c = hireCost(); if (S.gold < c) return;
    S.gold -= c; addWorker();
    say(`Worker ${S.workers.length} hired for ${c} gold.`);
  }
  function assign(t) {
    const k = kind(t); if (!k || k === 'dock' || crewOn(t).length >= SLOTS[k]) return;
    const free = idle(); if (!free.length) return;
    // the idle worker closest to the tile takes the job
    free.sort((a, b) => dist(a.at, t) - dist(b.at, t));
    const w = free[0]; w.post = t; if (!w.carry) { w.job = null; w.path = w.path.slice(0, 1); }
    say(`${workerName(w)} now works the ${B[t.b].name.toLowerCase()}.`);
  }
  function unassign(t) {
    const crew = crewOn(t); if (!crew.length) return;
    const w = crew[crew.length - 1]; w.post = null; if (!w.carry) { w.job = null; w.path = w.path.slice(0, 1); }
    say(`${workerName(w)} heads back to the dock.`);
  }
  function go(w, D, t, job) {
    if (!D.cost.has(t)) { w.job = 'wait'; w.timer = 1; return; } // unreachable: try again shortly
    const path = []; let k = t; while (k !== w.at) { path.unshift(k); k = D.prev.get(k); }
    w.path = path; w.seg = 0; w.job = job; w.target = t;
    if (!path.length) arrive(w);
  }
  function plan(w) {
    const D = dijkstra(w.at);
    if (w.carry > 0) {
      if (S.tech.rafting && !winter()) {
        const r = nearest(D, riverCells), d = D.cost.get(DOCK);
        if (r && r.d < d) return go(w, D, r.t, 'raft');
      }
      return go(w, D, DOCK, 'deliver');
    }
    const t = w.post, k = t && kind(t);
    if (k === 'wood') return go(w, D, t, 'chop');
    if (k === 'fish') return go(w, D, t, 'fish');
    if (t) { w.post = null; say(`${workerName(w)} has nothing left to do there and heads back to the dock.`); }
    if (w.at !== DOCK) return go(w, D, DOCK, 'home');
    w.job = 'wait'; w.timer = 1;
  }
  function arrive(w) {
    const t = w.target;
    if (w.job === 'chop') { w.job = 'chopping'; w.timer = CHOP_TIME / (S.tech.axes ? 2 : 1); }
    else if (w.job === 'fish') { w.job = 'fishing'; w.timer = FISH_TIME / (S.tech.fishing ? 2 : 1); }
    else if (w.job === 'deliver') { deliver(w.carry); w.carry = 0; w.job = null; }
    else if (w.job === 'raft') { for (let i = 0; i < w.carry; i++) S.rafts.push({ i: riverCells.indexOf(t), p: -i * 0.35 }); w.carry = 0; w.job = null; }
    else w.job = null;
  }
  // Wages and food are due once a season. A worker who goes without keeps working, but at half speed.
  function pay(w) {
    if (w.paid >= S.seasonCount) return 1;
    if (S.gold >= UPKEEP && S.food >= EAT) {
      S.gold -= UPKEEP; S.food -= EAT; w.paid = S.seasonCount;
      if (w.unpaid) say(`${workerName(w)} is paid and fed, and back to full speed.`);
      w.unpaid = false; return 1;
    }
    if (!w.unpaid) say(`${workerName(w)} slows down: ${S.gold < UPKEEP ? 'no gold for wages' : 'no food'}.`);
    w.unpaid = S.gold < UPKEEP ? 'gold' : 'food';
    return SLOW;
  }
  function stepWorker(w, dt) {
    dt *= pay(w);
    if (w.path.length) {
      const n = w.path[0], a = center(w.at), b = center(n);
      w.seg += dt / (STEP * B[n.b].move * (winter() ? SNOW : 1));
      if (w.seg >= 1) { w.at = n; w.path.shift(); w.seg = 0; w.x = b.x; w.y = b.y; if (!w.path.length) arrive(w); }
      else { w.x = a.x + (b.x - a.x) * w.seg; w.y = a.y + (b.y - a.y) * w.seg; }
      return;
    }
    if (w.job === 'chopping') {
      const t = w.target;
      if (w.post !== t || t.wood <= 0) { w.job = null; return; }
      w.timer -= dt;
      if (w.timer <= 0) {
        cut(t); w.carry++; fx(t, '+1 log', '#e2bd78');
        if (w.carry < cap() && t.wood > 0) w.timer = CHOP_TIME / (S.tech.axes ? 2 : 1); else w.job = null;
      }
      return;
    }
    if (w.job === 'fishing') {
      const t = w.target;
      if (w.post !== t) { w.job = null; return; }
      if (winter() && t.b === 'pond') return; // the pond freezes; the sea does not
      w.timer -= dt;
      if (w.timer <= 0) { w.timer = FISH_TIME / (S.tech.fishing ? 2 : 1); S.food++; fx(t, '+1 fish', '#a9d5f0'); }
      return;
    }
    if (w.job === 'wait') { w.timer -= dt; if (w.timer <= 0) w.job = null; return; }
    if (!w.job) plan(w);
  }

  // ---------- land ----------
  function cut(t) {
    t.wood--; t.regrow = 0;
    if (t.wood > 0) return;
    const was = B[t.b].name, next = WOOD[t.b].next;
    t.b = next; t.wood = WOOD[next] ? WOOD[next].wood : 0;
    if (!t.wood) {
      const n = crewOn(t).length;
      // the crew moves on to the closest standing wood nearby, if there is room; otherwise they go idle
      crewOn(t).forEach((w) => {
        const spots = MAP.cells.filter((o) => o.seen && o.wood > 0 && dist(o, t) <= 3 && crewOn(o).length < SLOTS.wood).sort((a, b) => dist(a, t) - dist(b, t));
        w.post = spots[0] || null;
      });
      say(`${was} cut back to ${B[next].name.toLowerCase()}. It will grow back.${n ? ' Its lumberjacks move to nearby forest, or go idle if there is none.' : ''}`);
    } else say(`${was} thinned to ${B[next].name.toLowerCase()}.`);
    redraw();
  }
  function stepLand(dt) {
    if (winter()) return;
    let changed = false;
    MAP.cells.forEach((t, i) => {
      const orig = ORIG[i];
      if (!WOOD[orig] || t.b === orig || crewOn(t).length) return;
      t.regrow += dt * (S.tech.forestry ? 2 : 1);
      if (t.regrow < REGROW) return;
      t.regrow = 0;
      t.b = t.b === 'grass' ? (orig === 'grove' ? 'grove' : 'pines') : orig;
      t.wood = WOOD[t.b].wood; changed = true;
      if (t.seen) fx(t, 'regrown', '#9bcb3e');
    });
    if (changed) redraw();
  }

  // ---------- economy ----------
  function deliver(n) {
    if (!n) return;
    if (S.tech.sawmill) { S.mill += n; fx(DOCK, `+${n} to mill`, '#e2bd78'); }
    else { S.gold += n * LOG_PRICE; fx(DOCK, `+${n * LOG_PRICE}g`, '#e6c35a'); }
    S.logsSold += n;
  }
  function stepDock(dt) {
    if (S.tech.sawmill && S.mill >= 2) {
      S.millT += dt;
      if (S.millT >= MILL_TIME) { S.millT = 0; S.mill -= 2; S.planks++; S.gold += PLANK_PRICE; fx(DOCK, `+${PLANK_PRICE}g plank`, '#e6c35a'); }
    } else S.millT = 0;
  }
  function stepRafts(dt) {
    if (winter()) return; // frozen in place
    const speed = seasonOf(S.seasonCount) === 0 ? 1.6 : 1; // spring melt
    S.rafts = S.rafts.filter((r) => {
      r.p += (dt / RAFT_STEP) * speed;
      while (r.p >= 1) { r.p -= 1; r.i++; if (r.i >= riverCells.length) { deliver(1); return false; } }
      return true;
    });
  }
  const contract = () => CONTRACTS[S.contract];
  const progress = () => { const c = contract(); return c ? (c.item === 'logs' ? S.logsSold : S.planks) - S.base[c.item] : 0; };
  function checkContract() {
    const c = contract(); if (!c) return;
    if (progress() < c.n) return;
    const reward = S.late ? Math.floor(c.reward / 2) : c.reward;
    S.gold += reward;
    say(`Contract filled! +${reward} gold.`);
    if (c.reveal) { MAP.cells.forEach((t) => { t.seen = true; }); say('The fog lifts. All of Verdant Reach is open.'); redraw(); }
    S.contract++; S.base = { logs: S.logsSold, planks: S.planks }; S.late = false;
    S.deadline = S.seasonCount - seasonOf(S.seasonCount) + 4 + WINTER;
  }
  function newSeason() {
    const s = seasonOf(S.seasonCount), y = Math.floor(S.seasonCount / 4) + 1;
    const note = ['The melt is in and the river runs fast.', 'Long days for hauling.', 'Winter is one season away. Stock food.', 'The river and the pond freeze, snow slows walking, and nothing grows.'][s];
    say(`${SEASONS[s]}, year ${y}. ${note}`);
    if (contract() && S.seasonCount >= S.deadline) {
      S.late = true; S.deadline += 4;
      say('Winter came before the contract was filled. It still stands, but now pays half.');
    }
    if (s === WINTER) for (const w of S.workers) if (w.job === 'raft') { w.job = null; w.path = w.path.slice(0, 1); }
    save();
  }

  // ---------- render ----------
  const canvas = document.getElementById('map'), cx = canvas.getContext('2d'), tip = document.getElementById('tip');
  const scene = document.createElement('canvas'), sx = scene.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  let R, scale = 2, offX = 0, offY = 0, dpr = 1, hover = null, sel = null;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function redraw() {
    R = X.renderMap('world');
    base.width = scene.width = R.w; base.height = scene.height = R.h;
    const im = bx.createImageData(R.w, R.h), sky = rgb('#a9d5f0');
    // fog covers each hidden face, plus the headroom above it where its tall art rises
    const fog = new Uint8Array(R.w * R.h);
    MAP.cells.forEach((t, i) => {
      if (t.seen) return;
      const p = X.at(t.c, t.r);
      for (let y = p.y; y < p.y + X.FY + X.FH; y++) for (let x = p.x; x < p.x + X.FW; x++) {
        const o = y * R.w + x, own = R.owner[o];
        if (own === i || (y < p.y + X.FY + 4 && (own < 0 || !MAP.cells[own].seen))) fog[o] = 1;
      }
    });
    for (let i = 0; i < R.w * R.h; i++) {
      const c = R.px[i], v = c ? rgb(c) : sky, o = i * 4, f = c && fog[i]; // the sky stays clear
      im.data[o] = f ? v[0] * 0.28 + 20 : v[0]; im.data[o + 1] = f ? v[1] * 0.28 + 26 : v[1]; im.data[o + 2] = f ? v[2] * 0.28 + 38 : v[2]; im.data[o + 3] = 255;
    }
    bx.putImageData(im, 0, 0);
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
  function drawDock() {
    const p = center(DOCK);
    px(p.x - 3, p.y + 2, 12, 3, '#b57f52'); px(p.x - 3, p.y + 4, 12, 1, '#77513c');
    for (let i = 0; i < 4; i++) px(p.x - 2 + i * 3, p.y + 5, 1, 3, '#3f2b31');
    px(p.x + 7, p.y - 7, 1, 9, '#3f2b31'); px(p.x + 8, p.y - 7, 4, 3, '#e8587d');
    if (S.tech.sawmill) {
      const x = p.x - 12, y = p.y - 9;
      px(x, y + 3, 9, 6, '#77513c'); px(x, y + 8, 9, 1, '#3f2b31'); px(x - 1, y + 2, 11, 2, '#c0473f'); px(x + 1, y + 1, 7, 1, '#c0473f');
      px(x + 3, y + 5, 3, 4, '#141d26'); px(x + 9, y + 4, 1, 4, '#a3b5c4');
    }
  }
  function drawWorker(w, now) {
    const walking = w.path.length > 0, bob = walking ? Math.floor(now * 8) % 2 : 0, x = Math.round(w.x) - 1 + ((w.id * 5) % 7) - 3, y = Math.round(w.y) - 7 - bob + ((w.id * 3) % 5) - 2;
    px(x, y + 6, 1, 1, '#141d26'); px(x + 2, y + 6, 1, 1, '#141d26');
    px(x, y + 3, 3, 3, w.hue); px(x, y + 5, 3, 1, '#1a3445');
    px(x, y, 3, 3, '#f0c08a'); px(x, y, 3, 1, '#3f2b31');
    const lumber = w.post && w.post.wood > 0;
    if (lumber) { px(x + 3, y + 2, 1, 3, '#77513c'); px(x + 3, y + 1, 2, 2, S.tech.axes ? '#a3b5c4' : '#5f6e8a'); }
    if (w.post && FISH.has(w.post.b)) { px(x + 3, y - 2, 1, 6, '#77513c'); if (w.job === 'fishing') px(x + 4, y - 2, 1, 1, '#f4f6ea'); }
    for (let i = 0; i < w.carry; i++) drawLog(x - 1, y - 3 - i * 2);
    if ((w.job === 'chopping' || w.job === 'fishing') && Math.floor(now * 4) % 2) px(x + 4, y + 1, 2, 1, '#f4f6ea');
    if (w.unpaid) { // a bubble: a coin when wages are owed, a fish when food is
      const bx2 = x - 1, by = y - 9 - w.carry * 2, c = w.unpaid === 'gold' ? '#e6c35a' : '#5f9edd';
      px(bx2, by, 5, 5, '#f4f6ea'); px(bx2 + 1, by + 1, 3, 3, c); px(bx2 + 1, by + 5, 1, 1, '#f4f6ea');
    }
    if (!w.post && w.at === DOCK && !w.path.length && Math.floor(now * 2) % 2) px(x + 1, y - 4, 1, 2, '#e6e773'); // idle: waiting for a job
  }
  function label(text, x, y, color) { cx.lineWidth = 3 * dpr; cx.strokeStyle = '#141d26'; cx.strokeText(text, x, y); cx.fillStyle = color; cx.fillText(text, x, y); }
  function render(now) {
    sx.drawImage(base, 0, 0);
    drawDock();
    for (const r of S.rafts) {
      const a = center(riverCells[Math.max(0, r.i)]), b = r.i + 1 < riverCells.length ? center(riverCells[r.i + 1]) : center(DOCK), f = Math.max(0, r.p);
      drawLog(a.x + (b.x - a.x) * f - 2, a.y + (b.y - a.y) * f - 1);
    }
    [...S.workers].sort((a, b) => a.y - b.y).forEach((w) => drawWorker(w, now));
    const s = seasonOf(S.seasonCount);
    if (s === WINTER) { sx.fillStyle = 'rgba(220,231,238,0.22)'; sx.fillRect(0, 0, R.w, R.h); }
    else if (s === 2) { sx.fillStyle = 'rgba(243,154,82,0.08)'; sx.fillRect(0, 0, R.w, R.h); }
    if (hover && hover !== sel) { const p = X.at(hover.c, hover.r); sx.drawImage(ring, p.x, p.y + X.FY); }
    if (sel) { const p = X.at(sel.c, sel.r); sx.drawImage(ringSel, p.x, p.y + X.FY); }
    // scale up onto the screen, then draw text at screen resolution
    const k = scale * dpr, ox = offX * dpr, oy = offY * dpr;
    cx.fillStyle = '#a9d5f0'; cx.fillRect(0, 0, canvas.width, canvas.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(scene, ox, oy, R.w * k, R.h * k);
    cx.textAlign = 'center'; cx.font = `600 ${Math.round(Math.max(11, 5.5 * scale) * dpr)}px "Pixelify Sans", monospace`;
    const idleN = idle().length;
    if (idleN) { const p = center(DOCK); label(`${idleN} idle`, ox + (p.x + 2) * k, oy + (p.y - 14) * k, '#e6e773'); }
    if (S.tech.sawmill && S.mill > 0) { const p = center(DOCK); label(`${S.mill} logs at mill`, ox + (p.x - 8) * k, oy + (p.y + 16) * k, '#f3dca0'); }
    for (const f of S.fx) {
      cx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      label(f.text, ox + f.x * k, oy + (f.y - f.t * 10) * k, f.color);
      cx.globalAlpha = 1;
    }
  }
  function hexRing(color) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 28;
    const rc = c.getContext('2d'); rc.fillStyle = color;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) if (X.inFace(x, y) && (!X.inFace(x - 1, y) || !X.inFace(x + 1, y) || !X.inFace(x, y - 1) || !X.inFace(x, y + 1))) rc.fillRect(x, y, 1, 1);
    return c;
  }
  const ring = hexRing('#f4f6ea'), ringSel = hexRing('#e6c35a');

  // ---------- input ----------
  function cellAt(e) {
    const x = Math.floor((e.clientX - offX) / scale), y = Math.floor((e.clientY - offY) / scale);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? MAP.cells[o] : null;
  }
  canvas.addEventListener('pointerdown', (e) => { if (!running()) return; select(cellAt(e)); });
  canvas.addEventListener('pointermove', (e) => {
    hover = running() ? cellAt(e) : null;
    if (!hover || e.pointerType === 'touch' || hover === sel) { tip.style.display = 'none'; return; }
    const t = hover;
    tip.innerHTML = `<b>${t.seen ? B[t.b].name : 'Unexplored'}</b><span>${t.seen ? tileLine(t) : 'Under fog'}</span>`;
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
    const k = kind(t), crew = crewOn(t).length, i = idx(t);
    if (k === 'dock') return 'Your dock. Logs sell here, and idle workers wait here.';
    if (k === 'wood') return `${t.wood} logs of wood left · ${crew}/${SLOTS.wood} lumberjacks`;
    if (k === 'fish') return `Fishing spot · ${crew}/${SLOTS.fish} fishers`;
    if (WOOD[ORIG[i]] && t.b !== ORIG[i]) return winter() ? 'Cut land. Regrowing after winter.' : `Cut land, regrowing: ${Math.round((t.regrow / REGROW) * 100)}%`;
    return B[t.b].move ? `Walk cost ${B[t.b].move}. No work here yet.` : 'Impassable.';
  }
  function select(t) {
    sel = t && t.seen ? t : null;
    if (t && !t.seen) say('That land is under fog. Fill the first contract to explore it.');
    tip.style.display = 'none';
    lastKey = '';
  }
  function updateTilePanel() {
    const t = sel, panel = $('tilePanel');
    panel.hidden = !t; $('hint').hidden = !!t;
    if (!t) return;
    const k = kind(t), crew = crewOn(t), free = idle().length;
    $('tName').textContent = t === DOCK ? 'Dock' : B[t.b].name;
    let info = tileLine(t);
    if (k === 'wood') info = `${t.wood} logs of wood left. Lumberjacks chop here and carry logs to the ${S.tech.rafting ? 'river or the dock' : 'dock'}.`;
    if (k === 'fish') info = `Fishers catch a fish every ${FISH_TIME / (S.tech.fishing ? 2 : 1)} seconds${t.b === 'pond' ? ', except in winter when the pond freezes' : ''}.`;
    $('tInfo').textContent = info;
    const slots = k === 'wood' || k === 'fish' ? SLOTS[k] : 0;
    $('tSlots').innerHTML = Array.from({ length: slots }, (_, i) => `<div class="slot${i < crew.length ? ' on' : ''}"><img alt="${i < crew.length ? 'worker' : 'empty slot'}" src="${icon('pop')}"></div>`).join('');
    $('tActs').hidden = !slots;
    $('tMinus').disabled = !crew.length;
    $('tPlus').disabled = !free || crew.length >= slots;
    $('tPlus').textContent = k === 'fish' ? '+ Assign fisher' : '+ Assign lumberjack';
    $('tNote').textContent = !slots ? (t === DOCK ? `${free} idle worker${free === 1 ? '' : 's'} here. Tap a forest or a beach to give them a job.` : '')
      : crew.length >= slots ? 'This tile is full.' : free ? `${free} idle worker${free === 1 ? '' : 's'} at the dock.` : `No idle workers. Hire one for ${hireCost()} gold, or remove a worker from another tile.`;
  }
  $('tClose').addEventListener('click', () => select(null));
  $('tPlus').addEventListener('click', () => { if (sel) assign(sel); lastKey = ''; });
  $('tMinus').addEventListener('click', () => { if (sel) unassign(sel); lastKey = ''; });

  // ---------- HUD ----------
  document.querySelectorAll('img[data-ic]').forEach((im) => { im.src = icon(im.dataset.ic); });
  const RES = [
    { id: 'gold', icon: 'coin', name: 'Gold', val: () => S.gold },
    { id: 'pop', icon: 'pop', name: 'Workers', val: () => { const n = idle().length; return n ? `${S.workers.length} · ${n} idle` : S.workers.length; }, warn: () => idle().length > 0 },
    { id: 'food', icon: 'food', name: 'Food', val: () => S.food, warn: () => S.food < S.workers.length * EAT },
    { id: 'logs', icon: 'log', name: 'Logs sold', val: () => S.logsSold },
    { id: 'planks', icon: 'plank', name: 'Planks', val: () => S.planks },
  ];
  $('res').innerHTML = RES.map((r) => `<div class="panel chip" id="r-${r.id}" title="${r.name}"><img class="ic" alt="${r.name}" src="${icon(r.icon)}"><div><b>0</b><small>${r.name}</small></div></div>`).join('');
  let speed = 1, view = 'menu';
  const running = () => view === 'game';
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
  $('hire').addEventListener('click', () => { hire(); lastKey = ''; });
  function hint() {
    const free = idle().length, fishers = S.workers.filter((w) => w.post && FISH.has(w.post.b)).length;
    if (S.workers.some((w) => w.unpaid === 'food') || (S.food < S.workers.length * EAT * 2 && !fishers)) return 'Food is running low and hungry workers slow down. Tap a beach tile and assign a fisher.';
    if (S.workers.some((w) => w.unpaid === 'gold')) return 'You can\'t pay wages, so your crew has slowed down. Sell more logs.';
    if (!S.workers.some((w) => w.post)) return 'Tap a pine or oak tile near the river, then assign your worker as a lumberjack. They chop and carry the logs to the dock to sell.';
    if (free) return `${free} worker${free === 1 ? ' is' : 's are'} idle at the dock. Tap a tile to give them a job.`;
    if (!S.tech.axes) return 'Save 40 gold for Axes in the tech tree so lumberjacks chop twice as fast. Hire more workers to grow faster.';
    if (!S.tech.rafting) return 'Lumberjacks walk slowly through forest and swamp. Log rafting lets the river carry logs to the dock for free.';
    return 'Cut forests grow back when nobody works them, so move lumberjacks around, and stock food before winter.';
  }
  let lastKey = '';
  function updateHud() {
    const s = seasonOf(S.seasonCount), into = S.time - S.seasonCount * SEASON_LEN;
    $('season').textContent = SEASONS[s];
    $('year').textContent = `Year ${Math.floor(S.seasonCount / 4) + 1} · ${Math.ceil(SEASON_LEN - into)}s`;
    $('seasonBar').style.width = `${(into / SEASON_LEN) * 100}%`;
    $('seasonBar').style.background = ['#7fe0c4', '#c9e05a', '#f39a52', '#a9d5f0'][s];
    RES.forEach((r) => { const el = $(`r-${r.id}`); el.querySelector('b').textContent = r.val(); el.classList.toggle('warn', !!(r.warn && r.warn())); });
    const k = [S.gold, S.food, S.workers.map((w) => idx(w.post)).join(), S.contract, progress(), S.late, S.deadline, S.log.join(), Object.keys(S.tech).join(), s,
      S.workers.map((w) => w.unpaid).join(), sel && idx(sel), sel && sel.wood, sel && sel.b, sel && Math.round(sel.regrow / 7)].join('|');
    if (k === lastKey) return;
    lastKey = k;
    const c = contract();
    if (c) {
      const left = S.deadline - S.seasonCount, p = Math.min(progress(), c.n);
      $('contract').innerHTML = `<div class="row"><span>Contract: ${p}/${c.n} ${c.item}</span><span class="${S.late ? 'late' : ''}">${S.late ? 'late, half pay' : `${c.reward}g`}</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${(p / c.n) * 100}%;background:var(--gold)"></i></div>
        <p>${c.text} ${left <= 0 ? 'Due now.' : `Due before winter${left > 1 ? ` (${left} seasons)` : ' (this season)'}.`}${c.reveal ? ' Lifts the fog.' : ''}</p>`;
    } else $('contract').innerHTML = '<div class="row"><span>All contracts filled</span><span>✓</span></div><p>That is everything in this prototype. Keep growing the valley.</p>';
    $('hireCost').textContent = `${hireCost()}g`;
    $('hire').disabled = S.gold < hireCost();
    $('treeBtn').querySelector('.lbl').textContent = TECH.some((t) => canBuy(t)) ? 'Tech •' : 'Tech';
    $('log').innerHTML = S.log.map((m) => `<li>${m}</li>`).join('');
    $('hint').textContent = hint();
    updateTilePanel();
    if (view === 'tree') drawTree();
  }

  // ---------- menu ----------
  function show(v) {
    view = v;
    $('menu').hidden = v !== 'menu'; $('treeView').hidden = v !== 'tree' && v !== 'pop'; $('popView').hidden = v !== 'pop';
    if (v !== 'game') { tip.style.display = 'none'; hover = null; }
  }
  function openMenu() {
    save();
    const sv = loadSave();
    $('resume').hidden = !sv && !S;
    $('resume').textContent = 'Resume';
    $('newGame').textContent = 'New game';
    $('newGame').classList.remove('go');
    $('newGame').dataset.armed = '';
    $('saveNote').textContent = sv ? `Saved: ${SEASONS[seasonOf(sv.seasonCount)]}, year ${Math.floor(sv.seasonCount / 4) + 1}, ${sv.gold} gold.` : 'Your game saves in this browser as you play.';
    show('menu');
  }
  $('menuBtn').addEventListener('click', openMenu);
  $('resume').addEventListener('click', () => { if (!S) load(loadSave()); show('game'); });
  $('newGame').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again: replace your saved game'; return; }
    fresh(); sel = null; save(); show('game');
  });

  // ---------- tech tree ----------
  const owned = (t) => !!S.tech[t.id];
  const unlocked = (t) => !t.needs || !!S.tech[t.needs];
  const canBuy = (t) => !t.soon && !owned(t) && unlocked(t) && S.gold >= t.cost;
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
  graph.addEventListener('click', (e) => {
    const n = e.target.closest('.node'); if (!n) return;
    picked = TECH.find((t) => `n-${t.id}` === n.id);
    const t = picked;
    $('popIcon').src = icon(t.icon); $('popName').textContent = t.name; $('popText').textContent = t.text;
    $('popPrice').innerHTML = t.soon ? '' : owned(t) ? 'Owned' : `<img class="ic" alt="" src="${icon('coin')}">${t.cost}`;
    $('popNeed').textContent = t.soon || owned(t) ? '' : !unlocked(t) ? `Buy ${TECH.find((q) => q.id === t.needs).name} first.` : S.gold < t.cost ? `You need ${t.cost - S.gold} more gold.` : '';
    $('popYes').hidden = t.soon || owned(t);
    $('popYes').disabled = !canBuy(t);
    $('popNo').textContent = t.soon || owned(t) ? 'Close' : 'Cancel';
    show('pop');
    ($('popYes').hidden || $('popYes').disabled ? $('popNo') : $('popYes')).focus();
  });
  $('popNo').addEventListener('click', () => show('tree'));
  $('popYes').addEventListener('click', () => {
    const t = picked; if (!t || !canBuy(t)) return;
    S.gold -= t.cost; S.tech[t.id] = true; say(`${t.name} bought.`); save();
    drawTree(); show('tree');
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (view === 'pop') show('tree'); else if (view === 'tree') show('game'); else if (view === 'game') { if (sel) select(null); else openMenu(); }
  });

  // ---------- loop ----------
  let last = performance.now(), saveT = 0;
  function frame(now) {
    const dt = running() ? Math.min(0.1, (now - last) / 1000) * speed : 0; last = now;
    if (S) {
      if (dt > 0) {
        S.time += dt;
        const sc = Math.floor(S.time / SEASON_LEN);
        if (sc !== S.seasonCount) { S.seasonCount = sc; newSeason(); }
        S.workers.forEach((w) => stepWorker(w, dt));
        stepRafts(dt); stepDock(dt); stepLand(dt); checkContract();
        saveT += dt / speed; if (saveT > 5) { saveT = 0; save(); }
      }
      const rdt = Math.min(0.1, dt);
      S.fx.forEach((f) => { f.t += rdt; });
      S.fx = S.fx.filter((f) => f.t < 1.2);
      render(now / 1000);
      updateHud();
    }
    requestAnimationFrame(frame);
  }
  // The map shows behind the menu: the saved valley if there is one, otherwise a fresh one.
  const saved = loadSave();
  if (saved) { try { load(saved); } catch (e) { fresh(); } } else fresh();
  openMenu();
  if (!saved) { $('resume').hidden = true; $('newGame').textContent = 'Start'; $('newGame').classList.add('go'); $('newGame').dataset.armed = '1'; $('saveNote').textContent = 'Your game saves in this browser as you play.'; }
  requestAnimationFrame(frame);
  window.HexCivGame = { get state() { return S; }, hire, assign, unassign, select, cells: MAP.cells, get, show };
})();
