// HexCiv prototype: click to chop, workers walk the hexes and haul to the dock, sell for gold, pay upkeep in gold and
// food each season, grow through a tech tree, fill the dock's contracts. Forests grow back. See docs/game-design.md.
(() => {
  const X = buildHexTiles(), icon = buildHudIcons();
  const B = X.BIOMES, MAP = X.MAPS.world, RIVER = MAP.river;

  // ---------- tuning ----------
  const SEASON_LEN = 60;              // seconds per season
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const WINTER = 3;
  const HITS_PER_LOG = 3;             // clicks per log
  const CHOP_TIME = 2.5;              // seconds for a worker with an axe to cut one log
  const STEP = 0.45;                  // seconds per point of move cost
  const SNOW = 1.6;                   // winter walking slowdown
  const RAFT_STEP = 0.7;              // seconds per river tile
  const LOG_PRICE = 2, PLANK_PRICE = 6, MILL_TIME = 3;
  const UPKEEP = 2, EAT = 1;          // gold and food per worker per season
  const FISH_TIME = 8;                // seconds per fish at the dock, with Fishing
  const REGROW = 70;                  // seconds for cut land to grow back one stage (outside winter)
  const hireCost = () => 15 + 5 * Math.max(0, S.workers.length - 1);
  const WOOD = { forest: { wood: 18, next: 'pines' }, pines: { wood: 12, next: 'grass' }, grove: { wood: 10, next: 'grass' } };
  // x, y place the node on the tree (percent of the board)
  const TECH = [
    { id: 'axes', name: 'Axes', icon: 'axe', cost: 40, x: 30, y: 14, text: 'Workers chop trees on their own when there are no logs to pick up.' },
    { id: 'fishing', name: 'Fishing', icon: 'fishing', cost: 30, x: 76, y: 14, text: `The dock catches a fish every ${FISH_TIME} seconds. Workers eat ${EAT} food each season.` },
    { id: 'baskets', name: 'Baskets', icon: 'basket', cost: 50, x: 12, y: 40, needs: 'axes', text: 'Workers carry 3 logs per trip instead of 1.' },
    { id: 'sawmill', name: 'Sawmill', icon: 'sawmill', cost: 80, x: 36, y: 40, needs: 'axes', text: `Built at the dock. Turns 2 logs into 1 plank, which sells for ${PLANK_PRICE} gold.` },
    { id: 'forestry', name: 'Forestry', icon: 'forestry', cost: 60, x: 60, y: 40, needs: 'axes', text: 'Cut land grows back twice as fast.' },
    { id: 'farms', name: 'Farms', icon: 'farms', x: 84, y: 40, needs: 'fishing', soon: true, text: 'Fields of wheat on grassland and meadow. Coming in a later prototype.' },
    { id: 'rafting', name: 'Log rafting', icon: 'raft', cost: 100, x: 12, y: 66, needs: 'baskets', text: 'Workers drop logs into the nearest river tile and the river floats them to the dock. The river freezes in winter.' },
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

  // ---------- state ----------
  let S;
  function fresh() {
    MAP.cells.forEach((t, i) => {
      t.b = ORIG[i]; t.wood = WOOD[t.b] ? WOOD[t.b].wood : 0; t.logs = 0; t.reserved = 0; t.hits = 0; t.choppers = 0; t.regrow = 0;
      t.seen = dist(t, DOCK) <= 2 || riverCells.some((v) => dist(t, v) <= 2);
    });
    S = { time: 0, gold: 10, food: 10, logsSold: 0, planks: 0, workers: [], rafts: [], fx: [], tech: {}, mill: 0, millT: 0, fishT: 0,
      contract: 0, base: { logs: 0, planks: 0 }, late: false, deadline: WINTER, seasonCount: 0, log: [], nextId: 1 };
    addWorker();
    say('Spring, year 1. Your first worker waits at the dock.');
    redraw();
  }
  const seasonOf = (n) => n % 4;
  const winter = () => seasonOf(S.seasonCount) === WINTER;
  const cap = () => (S.tech.baskets ? 3 : 1);
  const workerName = (w) => `Worker ${S.workers.indexOf(w) + 1}`;
  function say(m) { S.log.unshift(m); S.log.length = Math.min(S.log.length, 3); }
  function fx(t, text, color) { const p = center(t); S.fx.push({ x: p.x, y: p.y - 10, text, color, t: 0 }); }

  // ---------- save ----------
  const SAVE = 'hexciv-save-v2';
  function save() {
    if (!S) return;
    const idx = (t) => MAP.cells.indexOf(t);
    const data = { ...S, fx: [], cells: MAP.cells.map((t) => [t.b, t.wood, t.logs, t.hits, t.seen ? 1 : 0, Math.round(t.regrow)]),
      workers: S.workers.map((w) => ({ id: w.id, at: idx(w.at), carry: w.carry, paid: w.paid, hue: w.hue })) };
    try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) { /* no storage: the game still plays, it just won't resume */ }
  }
  function loadSave() { try { const v = localStorage.getItem(SAVE); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function load(d) {
    MAP.cells.forEach((t, i) => { const c = d.cells[i]; t.b = c[0]; t.wood = c[1]; t.logs = c[2]; t.hits = c[3]; t.seen = !!c[4]; t.regrow = c[5]; t.reserved = 0; t.choppers = 0; });
    S = { ...d, fx: [], workers: [] };
    delete S.cells;
    d.workers.forEach((w) => { const at = MAP.cells[w.at], p = center(at); S.workers.push({ ...w, at, x: p.x, y: p.y, path: [], seg: 0, job: null, claim: 0, timer: 0, unpaid: false }); });
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
    S.workers.push({ id: S.nextId++, at: DOCK, x: p.x, y: p.y, path: [], seg: 0, job: null, carry: 0, claim: 0, timer: 0, paid: S.seasonCount, unpaid: false, hue: HUES[S.workers.length % HUES.length] });
  }
  function hire() {
    const c = hireCost(); if (S.gold < c) return;
    S.gold -= c; addWorker();
    say(`Worker ${S.workers.length} hired for ${c} gold.`);
  }
  function go(w, D, t, job) {
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
    const pile = nearest(D, MAP.cells.filter((t) => t.logs - t.reserved > 0));
    if (pile) { const n = Math.min(cap(), pile.t.logs - pile.t.reserved); pile.t.reserved += n; w.claim = n; return go(w, D, pile.t, 'pickup'); }
    if (S.tech.axes) {
      const tree = nearest(D, MAP.cells.filter((t) => t.seen && t.wood > 0 && t.choppers < 2));
      if (tree) { tree.t.choppers++; return go(w, D, tree.t, 'chop'); }
    }
    if (w.at !== DOCK) return go(w, D, DOCK, 'home');
    w.job = 'wait'; w.timer = 1;
  }
  function arrive(w) {
    const t = w.target;
    if (w.job === 'pickup') { const n = Math.min(w.claim, t.logs); t.logs -= n; t.reserved -= w.claim; w.carry += n; w.claim = 0; w.job = null; }
    else if (w.job === 'chop') { w.job = 'chopping'; w.timer = CHOP_TIME; }
    else if (w.job === 'deliver') { deliver(w.carry); w.carry = 0; w.job = null; }
    else if (w.job === 'raft') { for (let i = 0; i < w.carry; i++) S.rafts.push({ i: riverCells.indexOf(t), p: -i * 0.35 }); w.carry = 0; w.job = null; }
    else w.job = null;
  }
  function pay(w) {
    if (w.paid >= S.seasonCount) return true;
    if (S.gold >= UPKEEP && S.food >= EAT) {
      S.gold -= UPKEEP; S.food -= EAT; w.paid = S.seasonCount;
      if (w.unpaid) say(`${workerName(w)} is paid and fed, and back to work.`);
      w.unpaid = false; return true;
    }
    if (!w.unpaid) say(`${workerName(w)} stopped: no ${S.gold < UPKEEP ? 'gold for wages' : 'food'}.`);
    w.unpaid = true; return false;
  }
  function stepWorker(w, dt) {
    if (!pay(w)) return;
    if (w.path.length) {
      const n = w.path[0], a = center(w.at), b = center(n);
      w.seg += dt / (STEP * B[n.b].move * (winter() ? SNOW : 1));
      if (w.seg >= 1) { w.at = n; w.path.shift(); w.seg = 0; w.x = b.x; w.y = b.y; if (!w.path.length) arrive(w); }
      else { w.x = a.x + (b.x - a.x) * w.seg; w.y = a.y + (b.y - a.y) * w.seg; }
      return;
    }
    if (w.job === 'chopping') {
      const t = w.target;
      w.timer -= dt;
      if (t.wood <= 0) { t.choppers--; w.job = null; return; }
      if (w.timer <= 0) {
        cut(t); w.carry++; fx(t, '+1', '#e2bd78');
        if (w.carry < cap() && t.wood > 0) w.timer = CHOP_TIME; else { t.choppers--; w.job = null; }
      }
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
    say(`${was} cut back to ${B[next].name.toLowerCase()}. It will grow back.`);
    redraw();
  }
  function stepLand(dt) {
    if (winter()) return;
    let changed = false;
    MAP.cells.forEach((t, i) => {
      const orig = ORIG[i];
      if (!WOOD[orig] || t.b === orig || t.choppers > 0) return;
      t.regrow += dt * (S.tech.forestry ? 2 : 1);
      if (t.regrow < REGROW) return;
      t.regrow = 0;
      t.b = t.b === 'grass' ? (orig === 'grove' ? 'grove' : 'pines') : orig;
      t.wood = WOOD[t.b].wood; t.hits = 0; changed = true;
      if (t.seen) fx(t, 'regrown', '#9bcb3e');
    });
    if (changed) redraw();
  }
  function chopClick(t) {
    if (!t.seen) { say('That land is under fog. Fill the first contract to explore it.'); return; }
    if (t === DOCK) { say(`The dock. Logs sell for ${LOG_PRICE} gold${S.tech.sawmill ? `, planks for ${PLANK_PRICE}` : ''}.`); return; }
    if (t.wood <= 0) return;
    t.hits++;
    const p = center(t); for (let i = 0; i < 4; i++) S.fx.push({ chip: true, x: p.x + (Math.random() * 8 - 4), y: p.y - 4, vx: Math.random() * 30 - 15, vy: -30 - Math.random() * 20, t: 0 });
    if (t.hits >= HITS_PER_LOG) { t.hits = 0; t.logs++; cut(t); fx(t, '+1 log', '#f3dca0'); }
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
    if (S.tech.fishing && !winter()) {
      S.fishT += dt;
      if (S.fishT >= FISH_TIME) { S.fishT = 0; S.food++; fx(DOCK, '+1 fish', '#a9d5f0'); }
    }
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
    const note = ['The melt is in and the river runs fast.', 'Long days for hauling.', 'Winter is one season away. Stock food.', 'The river freezes, snow slows walking, and nothing grows.'][s];
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
  let R, scale = 2, offX = 0, offY = 0, dpr = 1, hover = null;
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
    if (S.tech.fishing) { px(p.x - 6, p.y + 1, 1, 6, '#3f2b31'); px(p.x - 7, p.y, 3, 1, '#77513c'); px(p.x - 9, p.y + 2, 2, 1, '#5f9edd'); }
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
    if (S.tech.axes) { px(x + 3, y + 2, 1, 3, '#77513c'); px(x + 3, y + 1, 2, 2, '#a3b5c4'); }
    for (let i = 0; i < w.carry; i++) drawLog(x - 1, y - 3 - i * 2);
    if (w.job === 'chopping' && Math.floor(now * 4) % 2) px(x + 4, y, 2, 1, '#f4f6ea');
    if (w.unpaid) { px(x + 1, y - 6, 1, 3, '#e8587d'); px(x + 1, y - 2, 1, 1, '#e8587d'); }
  }
  function label(text, x, y, color) { cx.lineWidth = 3 * dpr; cx.strokeStyle = '#141d26'; cx.strokeText(text, x, y); cx.fillStyle = color; cx.fillText(text, x, y); }
  function render(now) {
    sx.drawImage(base, 0, 0);
    drawDock();
    for (const t of MAP.cells) {
      if (!t.logs) continue;
      const p = center(t);
      for (let i = 0; i < Math.min(t.logs, 6); i++) drawLog(p.x - 6 + (i % 2) * 6, p.y + 2 - Math.floor(i / 2) * 2);
    }
    for (const r of S.rafts) {
      const a = center(riverCells[Math.max(0, r.i)]), b = r.i + 1 < riverCells.length ? center(riverCells[r.i + 1]) : center(DOCK), f = Math.max(0, r.p);
      drawLog(a.x + (b.x - a.x) * f - 2, a.y + (b.y - a.y) * f - 1);
    }
    [...S.workers].sort((a, b) => a.y - b.y).forEach((w) => drawWorker(w, now));
    for (const f of S.fx) if (f.chip) px(f.x, f.y, 1, 1, f.t < 0.2 ? '#e2bd78' : '#77513c');
    const s = seasonOf(S.seasonCount);
    if (s === WINTER) { sx.fillStyle = 'rgba(220,231,238,0.22)'; sx.fillRect(0, 0, R.w, R.h); }
    else if (s === 2) { sx.fillStyle = 'rgba(243,154,82,0.08)'; sx.fillRect(0, 0, R.w, R.h); }
    if (hover) { const p = X.at(hover.c, hover.r); sx.drawImage(ring, p.x, p.y + X.FY); }
    // scale up onto the screen, then draw text at screen resolution
    const k = scale * dpr, ox = offX * dpr, oy = offY * dpr;
    cx.fillStyle = '#a9d5f0'; cx.fillRect(0, 0, canvas.width, canvas.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(scene, ox, oy, R.w * k, R.h * k);
    cx.textAlign = 'center'; cx.font = `600 ${Math.round(Math.max(11, 5.5 * scale) * dpr)}px "Pixelify Sans", monospace`;
    for (const t of MAP.cells) {
      if (t.logs <= 1) continue;
      const p = center(t); label(`×${t.logs}`, ox + (p.x + 8) * k, oy + (p.y + 8) * k, '#f4f6ea');
    }
    if (S.tech.sawmill && S.mill > 0) { const p = center(DOCK); label(`${S.mill} logs at mill`, ox + (p.x - 8) * k, oy + (p.y + 16) * k, '#f3dca0'); }
    for (const f of S.fx) {
      if (f.chip) continue;
      cx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      label(f.text, ox + f.x * k, oy + (f.y - f.t * 10) * k, f.color);
      cx.globalAlpha = 1;
    }
  }
  const ring = document.createElement('canvas'); ring.width = 32; ring.height = 28;
  { const rc = ring.getContext('2d'); rc.fillStyle = '#f4f6ea'; for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) if (X.inFace(x, y) && (!X.inFace(x - 1, y) || !X.inFace(x + 1, y) || !X.inFace(x, y - 1) || !X.inFace(x, y + 1))) rc.fillRect(x, y, 1, 1); }

  // ---------- input ----------
  function cellAt(e) {
    const x = Math.floor((e.clientX - offX) / scale), y = Math.floor((e.clientY - offY) / scale);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? MAP.cells[o] : null;
  }
  canvas.addEventListener('pointerdown', (e) => { if (!running()) return; const t = cellAt(e); if (t) chopClick(t); });
  canvas.addEventListener('pointermove', (e) => {
    hover = running() ? cellAt(e) : null;
    if (!hover || e.pointerType === 'touch') { tip.style.display = 'none'; return; }
    const t = hover, lines = [];
    if (!t.seen) lines.push('Under fog');
    else {
      if (t === DOCK) lines.push('Your dock: workers sell here');
      lines.push(B[t.b].move ? `Walk cost ${B[t.b].move}` : 'Impassable');
      if (t.wood > 0) lines.push(`${t.wood} logs of wood left`, `Click to chop (${t.hits}/${HITS_PER_LOG})`);
      const i = MAP.cells.indexOf(t);
      if (WOOD[ORIG[i]] && t.b !== ORIG[i]) lines.push(winter() ? 'Regrowing (paused for winter)' : `Regrowing: ${Math.round((t.regrow / REGROW) * 100)}%`);
      if (t.logs) lines.push(`${t.logs} logs on the ground`);
      if (riverCells.includes(t) && S.tech.rafting) lines.push(winter() ? 'Frozen' : 'Workers raft logs from here');
    }
    tip.innerHTML = `<b>${t.seen ? B[t.b].name : 'Unexplored'}</b>${lines.map((l) => `<span>${l}</span>`).join('')}`;
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

  // ---------- HUD ----------
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('img[data-ic]').forEach((im) => { im.src = icon(im.dataset.ic); });
  const RES = [
    { id: 'gold', icon: 'coin', name: 'Gold', val: () => S.gold },
    { id: 'pop', icon: 'pop', name: 'Workers', val: () => S.workers.length },
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
  $('hire').addEventListener('click', hire);
  function hint() {
    if (S.workers.some((w) => w.unpaid)) return S.food < EAT ? 'Your crew is out of food. Buy Fishing in the tech tree so the dock catches fish.' : 'Your crew is waiting for wages. Sell logs to pay them.';
    if (!S.tech.axes) return `Click pine or oak tiles to chop: every ${HITS_PER_LOG} clicks drops a log. Your worker carries logs to the dock and sells them. Save up for Axes in the tech tree.`;
    if (!S.tech.fishing) return `Each worker eats ${EAT} food a season and you have ${S.food}. Fishing at the dock keeps them fed.`;
    if (!S.tech.rafting) return 'Workers walk slowly through forest and swamp. Log rafting lets the river carry logs to the dock for free.';
    return 'The valley runs itself now. Cut forests grow back, so keep your crew near the trees and stock food before winter.';
  }
  let lastKey = '';
  function updateHud() {
    const s = seasonOf(S.seasonCount), into = S.time - S.seasonCount * SEASON_LEN;
    $('season').textContent = SEASONS[s];
    $('year').textContent = `Year ${Math.floor(S.seasonCount / 4) + 1} · ${Math.ceil(SEASON_LEN - into)}s`;
    $('seasonBar').style.width = `${(into / SEASON_LEN) * 100}%`;
    $('seasonBar').style.background = ['#7fe0c4', '#c9e05a', '#f39a52', '#a9d5f0'][s];
    RES.forEach((r) => { const el = $(`r-${r.id}`); el.querySelector('b').textContent = r.val(); el.classList.toggle('warn', !!(r.warn && r.warn())); });
    const k = [S.gold, S.workers.length, S.contract, progress(), S.late, S.deadline, S.log.join(), Object.keys(S.tech).join(), s, S.workers.some((w) => w.unpaid)].join('|');
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
    const ready = TECH.some((t) => canBuy(t));
    $('treeBtn').querySelector('.lbl').textContent = ready ? 'Tech •' : 'Tech';
    $('log').innerHTML = S.log.map((m) => `<li>${m}</li>`).join('');
    $('hint').textContent = hint();
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
    const has = !!loadSave();
    $('resume').hidden = !has && !S;
    $('resume').textContent = S ? 'Resume' : 'Resume saved game';
    $('newGame').textContent = has || S ? 'New game' : 'Start';
    $('newGame').classList.toggle('go', !has && !S);
    $('newGame').dataset.armed = '';
    const sv = loadSave();
    $('saveNote').textContent = sv ? `Saved: ${SEASONS[seasonOf(sv.seasonCount)]}, year ${Math.floor(sv.seasonCount / 4) + 1}, ${sv.gold} gold.` : 'Your game saves in this browser as you play.';
    show('menu');
  }
  $('menuBtn').addEventListener('click', openMenu);
  $('resume').addEventListener('click', () => { if (!S) load(loadSave()); show('game'); });
  $('newGame').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if ((S || loadSave()) && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again: replace your saved game'; return; }
    fresh(); save(); show('game');
  });

  // ---------- tech tree ----------
  const owned = (t) => !!S.tech[t.id];
  const unlocked = (t) => !t.needs || !!S.tech[t.needs];
  const canBuy = (t) => !t.soon && !owned(t) && unlocked(t) && S.gold >= t.cost;
  $('treeBtn').addEventListener('click', () => { drawTree(); show('tree'); });
  $('treeBack').addEventListener('click', () => show('game'));
  const graph = $('graph');
  graph.insertAdjacentHTML('beforeend', TECH.map((t) => `<button class="node" id="n-${t.id}" style="left:${t.x}%;top:${t.y}%" aria-label="${t.name}"><img alt="" src="${icon(t.icon)}"><span>${t.name}</span></button>`).join(''));
  $('links').innerHTML = TECH.filter((t) => t.needs).map((t) => { const p = TECH.find((q) => q.id === t.needs); return `<line id="l-${t.id}" x1="${p.x}" y1="${p.y}" x2="${t.x}" y2="${t.y}" stroke-width="1.2" vector-effect="non-scaling-stroke" style="stroke-width:4px"/>`; }).join('');
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
    $('popNeed').textContent = t.soon ? '' : owned(t) ? '' : !unlocked(t) ? `Buy ${TECH.find((q) => q.id === t.needs).name} first.` : S.gold < t.cost ? `You need ${t.cost - S.gold} more gold.` : '';
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
  addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (view === 'pop') show('tree'); else if (view === 'tree') show('game'); else if (view === 'game') openMenu(); });

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
      S.fx.forEach((f) => { f.t += rdt; if (f.chip) { f.vy += 120 * rdt; f.x += f.vx * rdt; f.y += f.vy * rdt; } });
      S.fx = S.fx.filter((f) => f.t < (f.chip ? 0.4 : 1.2));
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
  window.HexCivGame = { get state() { return S; }, hire, chopClick, cells: MAP.cells, get, show };
})();
