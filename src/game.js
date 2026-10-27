// HexCiv prototype 1: click to chop, hire workers who walk the hexes, sell at the dock, pay upkeep each season,
// buy tech (axes, baskets, sawmill, log rafting) and fill the dock's contracts. See docs/game-design.md.
(() => {
  const X = buildHexTiles();
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
  const UPKEEP = 2;                   // gold per worker per season
  const hireCost = () => 15 + 5 * S.workers.length;
  const WOOD = { forest: { wood: 15, next: 'pines' }, pines: { wood: 10, next: 'grass' }, grove: { wood: 8, next: 'grass' } };
  const TECH = [
    { id: 'axes', name: 'Axes', cost: 40, text: 'Workers chop trees on their own when there are no logs to pick up.' },
    { id: 'baskets', name: 'Baskets', cost: 50, text: 'Workers carry 3 logs per trip instead of 1.' },
    { id: 'sawmill', name: 'Sawmill', cost: 80, text: 'Built at the dock. Turns 2 logs into 1 plank, which sells for 6 gold.' },
    { id: 'rafting', name: 'Log rafting', cost: 100, needs: 'axes', text: 'Workers drop logs into the nearest river tile and the river floats them to the dock. The river freezes in winter.' },
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

  // ---------- state ----------
  let S;
  function reset() {
    MAP.cells.forEach((t, i) => {
      t.b = ORIG[i]; t.wood = WOOD[t.b] ? WOOD[t.b].wood : 0; t.logs = 0; t.reserved = 0; t.hits = 0; t.choppers = 0;
      t.seen = dist(t, DOCK) <= 2 || riverCells.some((v) => dist(t, v) <= 2);
    });
    S = { time: 0, gold: 15, logsSold: 0, planks: 0, earned: 0, workers: [], rafts: [], fx: [], tech: {}, mill: 0, millT: 0,
      contract: 0, base: { logs: 0, planks: 0 }, late: false, deadline: WINTER, seasonCount: 0, log: [], nextId: 1 };
    say('Spring, year 1. The dock is open and the valley is yours.');
    redraw();
  }
  const seasonOf = (n) => n % 4;
  const winter = () => seasonOf(S.seasonCount) === WINTER;
  const cap = () => (S.tech.baskets ? 3 : 1);
  function say(m) { S.log.unshift(m); S.log.length = Math.min(S.log.length, 6); ui.dirty = true; }
  function fx(t, text, color) { const p = center(t); S.fx.push({ x: p.x, y: p.y - 10, text, color, t: 0 }); }

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
  function hire() {
    const c = hireCost(); if (S.gold < c) return;
    S.gold -= c;
    const p = center(DOCK);
    S.workers.push({ id: S.nextId++, at: DOCK, x: p.x, y: p.y, path: [], seg: 0, job: null, carry: 0, claim: 0, timer: 0, paid: S.seasonCount, unpaid: false, hue: ['#e8587d', '#5f9edd', '#e6e773', '#cfa0ff', '#f39a52', '#7fe0c4'][S.workers.length % 6] });
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
    else if (w.job === 'deliver') { deliver(w.carry, DOCK); w.carry = 0; w.job = null; }
    else if (w.job === 'raft') { for (let i = 0; i < w.carry; i++) S.rafts.push({ i: riverCells.indexOf(t), p: -i * 0.35 }); w.carry = 0; w.job = null; }
    else w.job = null;
  }
  function stepWorker(w, dt) {
    if (w.paid < S.seasonCount) {
      if (S.gold >= UPKEEP) { S.gold -= UPKEEP; w.paid = S.seasonCount; if (w.unpaid) say(`Worker ${S.workers.indexOf(w) + 1} is paid and back to work.`); w.unpaid = false; }
      else { if (!w.unpaid) say(`Worker ${S.workers.indexOf(w) + 1} wasn't paid and stopped working.`); w.unpaid = true; return; }
    }
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
    t.wood--;
    if (t.wood > 0) return;
    const was = B[t.b].name, next = WOOD[t.b].next;
    t.b = next; t.wood = WOOD[next] ? WOOD[next].wood : 0;
    say(`${was} at ${t.c},${t.r} is cut back to ${B[next].name.toLowerCase()}.`);
    redraw();
  }
  function chopClick(t) {
    if (!t.seen) { say('That land is under fog. Fill a contract to explore it.'); return; }
    if (t === DOCK) { say(`The dock. Logs sell for ${LOG_PRICE} gold${S.tech.sawmill ? `, planks for ${PLANK_PRICE}` : ''}.`); return; }
    if (t.wood <= 0) return;
    t.hits++;
    const p = center(t); for (let i = 0; i < 4; i++) S.fx.push({ chip: true, x: p.x + (Math.random() * 8 - 4), y: p.y - 4, vx: Math.random() * 30 - 15, vy: -30 - Math.random() * 20, t: 0 });
    if (t.hits >= HITS_PER_LOG) { t.hits = 0; t.logs++; cut(t); fx(t, '+1 log', '#f3dca0'); }
  }

  // ---------- economy ----------
  function deliver(n, at) {
    if (!n) return;
    if (S.tech.sawmill) { S.mill += n; fx(at, `+${n} to mill`, '#e2bd78'); }
    else { S.gold += n * LOG_PRICE; S.earned += n * LOG_PRICE; fx(at, `+${n * LOG_PRICE}g`, '#e6c35a'); }
    S.logsSold += n; ui.dirty = true;
  }
  function stepMill(dt) {
    if (!S.tech.sawmill || S.mill < 2) { S.millT = 0; return; }
    S.millT += dt;
    if (S.millT >= MILL_TIME) { S.millT = 0; S.mill -= 2; S.planks++; S.gold += PLANK_PRICE; S.earned += PLANK_PRICE; fx(DOCK, `+${PLANK_PRICE}g plank`, '#e6c35a'); }
  }
  function stepRafts(dt) {
    if (winter()) return; // frozen in place
    const speed = seasonOf(S.seasonCount) === 0 ? 1.6 : 1; // spring melt
    S.rafts = S.rafts.filter((r) => {
      r.p += (dt / RAFT_STEP) * speed;
      while (r.p >= 1) { r.p -= 1; r.i++; if (r.i >= riverCells.length) { deliver(1, DOCK); return false; } }
      return true;
    });
  }
  const contract = () => CONTRACTS[S.contract];
  const progress = () => { const c = contract(); return c ? (c.item === 'logs' ? S.logsSold : S.planks) - S.base[c.item] : 0; };
  function checkContract() {
    const c = contract(); if (!c) return;
    if (progress() >= c.n) {
      const reward = S.late ? Math.floor(c.reward / 2) : c.reward;
      S.gold += reward;
      say(`Contract filled! +${reward} gold.`);
      if (c.reveal) { MAP.cells.forEach((t) => { t.seen = true; }); say('The fog lifts. The whole of Verdant Reach is open.'); redraw(); }
      S.contract++; S.base = { logs: S.logsSold, planks: S.planks }; S.late = false;
      S.deadline = S.seasonCount - seasonOf(S.seasonCount) + 4 + WINTER;
      if (contract()) say(`New contract: ${contract().text}`);
    }
  }
  function newSeason() {
    const s = seasonOf(S.seasonCount), y = Math.floor(S.seasonCount / 4) + 1;
    const note = ['The melt is in and the river runs fast.', 'Long days for hauling.', 'Winter is one season away.', 'The river freezes and snow slows everyone down.'][s];
    say(`${SEASONS[s]}, year ${y}. ${note}${S.workers.length ? ` Upkeep due: ${UPKEEP * S.workers.length} gold.` : ''}`);
    if (contract() && S.seasonCount >= S.deadline) {
      S.late = true; S.deadline += 4;
      say('Winter came before the contract was filled. It still stands, but now pays half.');
    }
    if (s === WINTER) for (const w of S.workers) if (w.job === 'raft') { w.job = null; w.path = w.path.slice(0, 1); }
  }

  // ---------- render ----------
  const stage = document.getElementById('stage'), canvas = document.getElementById('map'), tip = document.getElementById('tip');
  const scene = document.createElement('canvas'), sx = scene.getContext('2d');
  const base = document.createElement('canvas'), bx = base.getContext('2d');
  let R, scale = 2, hover = null;
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
    const room = stage.clientWidth - 18;
    scale = Math.max(1, Math.min(3, Math.floor(room / R.w)));
    canvas.width = R.w * scale; canvas.height = R.h * scale;
    canvas.style.width = scale === 1 && room > R.w ? `${room}px` : `${R.w * scale}px`;
  }
  const px = (x, y, w, h, c) => { sx.fillStyle = c; sx.fillRect(Math.round(x), Math.round(y), w, h); };
  function drawLog(x, y) { px(x, y, 5, 2, '#77513c'); px(x, y + 1, 5, 1, '#3f2b31'); px(x + 4, y, 1, 2, '#e2bd78'); }
  function drawDock() {
    const p = center(DOCK);
    // pier out over the water, lit from the upper left
    px(p.x - 3, p.y + 2, 12, 3, '#b57f52'); px(p.x - 3, p.y + 4, 12, 1, '#77513c');
    for (let i = 0; i < 4; i++) px(p.x - 2 + i * 3, p.y + 5, 1, 3, '#3f2b31');
    px(p.x + 7, p.y - 7, 1, 9, '#3f2b31'); px(p.x + 8, p.y - 7, 4, 3, '#e8587d');
    if (S.tech.sawmill) {
      const x = p.x - 12, y = p.y - 9;
      px(x, y + 3, 9, 6, '#77513c'); px(x, y + 8, 9, 1, '#3f2b31'); px(x - 1, y + 2, 11, 2, '#3f2b31'); px(x + 1, y + 1, 7, 1, '#3f2b31');
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
    // scale up, then draw text at screen resolution
    const cx = canvas.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(scene, 0, 0, canvas.width, canvas.height);
    cx.textAlign = 'center'; cx.font = `600 ${Math.max(11, 5 * scale)}px "IBM Plex Mono", monospace`;
    for (const t of MAP.cells) {
      if (t.logs <= 1) continue;
      const p = center(t), x = (p.x + 8) * scale, y = (p.y + 8) * scale;
      cx.lineWidth = 3; cx.strokeStyle = '#141d26'; cx.strokeText(`×${t.logs}`, x, y); cx.fillStyle = '#f4f6ea'; cx.fillText(`×${t.logs}`, x, y);
    }
    if (S.tech.sawmill && S.mill > 0) {
      const p = center(DOCK), x = (p.x - 8) * scale, y = (p.y + 16) * scale;
      cx.lineWidth = 3; cx.strokeStyle = '#141d26'; cx.strokeText(`${S.mill} logs`, x, y); cx.fillStyle = '#f3dca0'; cx.fillText(`${S.mill} logs`, x, y);
    }
    for (const f of S.fx) {
      if (f.chip) continue;
      cx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      const x = f.x * scale, y = (f.y - f.t * 10) * scale;
      cx.lineWidth = 3; cx.strokeStyle = '#141d26'; cx.strokeText(f.text, x, y); cx.fillStyle = f.color; cx.fillText(f.text, x, y);
      cx.globalAlpha = 1;
    }
  }
  // hover ring: the hex outline
  const ring = document.createElement('canvas'); ring.width = 32; ring.height = 28;
  { const rc = ring.getContext('2d'); rc.fillStyle = '#f4f6ea'; for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) if (X.inFace(x, y) && (!X.inFace(x - 1, y) || !X.inFace(x + 1, y) || !X.inFace(x, y - 1) || !X.inFace(x, y + 1))) rc.fillRect(x, y, 1, 1); }

  // ---------- input ----------
  function cellAt(e) {
    const r = canvas.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * R.w), y = Math.floor(((e.clientY - r.top) / r.height) * R.h);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? MAP.cells[o] : null;
  }
  canvas.addEventListener('pointerdown', (e) => { const t = cellAt(e); if (t) chopClick(t); });
  canvas.addEventListener('pointermove', (e) => {
    hover = cellAt(e);
    if (!hover || e.pointerType === 'touch') { tip.style.display = 'none'; return; }
    const t = hover, lines = [];
    if (!t.seen) lines.push('Under fog');
    else {
      if (t === DOCK) lines.push('Your dock: deliver here to sell');
      lines.push(B[t.b].move ? `walk cost ${B[t.b].move}` : 'impassable');
      if (t.wood > 0) lines.push(`${t.wood} logs of wood left`, `click to chop (${t.hits}/${HITS_PER_LOG})`);
      if (t.logs) lines.push(`${t.logs} logs on the ground`);
      if (riverCells.includes(t) && S.tech.rafting) lines.push(winter() ? 'frozen' : 'drop logs here to raft');
    }
    tip.innerHTML = `<b>${t.seen ? B[t.b].name : 'Unexplored'}</b>${lines.map((l) => `<span>${l}</span>`).join('')}`;
    const sr = stage.getBoundingClientRect();
    let lx = e.clientX - sr.left + 14, ly = e.clientY - sr.top + 14;
    tip.style.display = 'block';
    if (lx + tip.offsetWidth > sr.width - 4) lx = e.clientX - sr.left - tip.offsetWidth - 10;
    if (ly + tip.offsetHeight > sr.height - 4) ly = e.clientY - sr.top - tip.offsetHeight - 10;
    tip.style.left = `${lx}px`; tip.style.top = `${ly}px`;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; tip.style.display = 'none'; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 120); });

  // ---------- panel ----------
  const $ = (id) => document.getElementById(id);
  const ui = { dirty: true };
  let speed = 1;
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
  $('restart').addEventListener('click', () => { reset(); ui.dirty = true; });
  $('hire').addEventListener('click', () => { hire(); ui.dirty = true; });
  $('techs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tech]'); if (!b) return;
    const t = TECH.find((x) => x.id === b.dataset.tech);
    if (S.tech[t.id] || S.gold < t.cost || (t.needs && !S.tech[t.needs])) return;
    S.gold -= t.cost; S.tech[t.id] = true; say(`${t.name} bought.`); ui.dirty = true;
  });
  function hint() {
    if (!S.workers.length && S.gold < hireCost()) return `Click a pine or oak tile to chop. Every ${HITS_PER_LOG} chops drops a log on the tile. You'll need a worker to carry logs to the dock.`;
    if (!S.workers.length) return 'Hire a worker. They walk to your logs and carry them to the dock, where they sell.';
    if (!S.tech.axes) return 'Keep chopping while your crew hauls. Save 40 gold for Axes so workers chop on their own.';
    if (!S.tech.rafting) return 'Workers walk slowly through forest and swamp. Log rafting lets the river carry logs to the dock for free.';
    if (S.workers.some((w) => w.unpaid)) return 'Some workers are unpaid. They wait until you have gold for their upkeep.';
    return 'The valley runs itself now. Keep gold aside for upkeep, and plan for winter, when the river freezes.';
  }
  let lastKey = '';
  function updatePanel() {
    const s = seasonOf(S.seasonCount), into = S.time - S.seasonCount * SEASON_LEN;
    $('season').textContent = SEASONS[s];
    $('year').textContent = `Year ${Math.floor(S.seasonCount / 4) + 1} · ${Math.ceil(SEASON_LEN - into)}s left`;
    $('seasonBar').style.width = `${(into / SEASON_LEN) * 100}%`;
    $('seasonBar').style.background = ['#7fe0c4', '#c9e05a', '#f39a52', '#a9d5f0'][s];
    $('gold').textContent = S.gold; $('logs').textContent = S.logsSold; $('planks').textContent = S.planks;
    const k = [S.gold, S.workers.length, S.contract, progress(), S.late, S.log[0], Object.keys(S.tech).join(), S.deadline, s].join('|');
    if (k === lastKey && !ui.dirty) return;
    lastKey = k; ui.dirty = false;
    const c = contract();
    if (c) {
      const left = S.deadline - S.seasonCount, p = Math.min(progress(), c.n);
      $('contract').innerHTML = `<h2>Dock contract <span class="pill ${S.late ? 'late' : 'open'}">${S.late ? 'late' : 'open'}</span></h2>
        <p>${c.text}</p><div class="bar" aria-hidden="true"><i style="width:${(p / c.n) * 100}%;background:var(--gold)"></i></div>
        <p class="meta">${p} of ${c.n} ${c.item} · pays ${S.late ? Math.floor(c.reward / 2) : c.reward} gold${c.reveal ? ' and lifts the fog' : ''} · ${left <= 0 ? 'due now' : `due before winter (${left} season${left > 1 ? 's' : ''})`}</p>`;
    } else $('contract').innerHTML = '<h2>Dock contract <span class="pill done">done</span></h2><p>Every contract in this prototype is filled. Keep playing, or restart to try a faster run.</p>';
    $('crew').textContent = `${S.workers.length} worker${S.workers.length === 1 ? '' : 's'}`;
    $('hireCost').textContent = `${hireCost()}g`;
    $('hire').disabled = S.gold < hireCost();
    $('upkeep').textContent = `Each worker costs ${UPKEEP} gold of upkeep at the start of every season${S.workers.length ? `: ${UPKEEP * S.workers.length} gold next season` : ''}. Unpaid workers stop.`;
    $('techs').innerHTML = TECH.map((t) => {
      const own = S.tech[t.id], locked = t.needs && !S.tech[t.needs];
      return `<button class="tech${own ? ' owned' : ''}" data-tech="${t.id}" ${own || locked || S.gold < t.cost ? 'disabled' : ''}><span class="row"><span>${t.name}</span><span class="cost">${own ? 'owned' : `${t.cost}g`}</span></span><small>${locked ? `Needs ${TECH.find((x) => x.id === t.needs).name}. ` : ''}${t.text}</small></button>`;
    }).join('');
    $('log').innerHTML = S.log.map((m) => `<li>${m}</li>`).join('');
    $('hint').textContent = hint();
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000) * speed; last = now;
    if (dt > 0) {
      S.time += dt;
      const sc = Math.floor(S.time / SEASON_LEN);
      if (sc !== S.seasonCount) { S.seasonCount = sc; newSeason(); }
      S.workers.forEach((w) => stepWorker(w, dt));
      stepRafts(dt); stepMill(dt); checkContract();
    }
    const rdt = Math.min(0.1, dt || 0);
    S.fx.forEach((f) => { f.t += rdt || 0.016 * (speed ? 1 : 0); if (f.chip) { f.vy += 120 * (rdt || 0); f.x += f.vx * (rdt || 0); f.y += f.vy * (rdt || 0); } });
    S.fx = S.fx.filter((f) => f.t < (f.chip ? 0.4 : 1.2));
    render(now / 1000);
    updatePanel();
    requestAnimationFrame(frame);
  }
  reset();
  requestAnimationFrame(frame);
  window.HexCivGame = { get state() { return S; }, hire, chopClick, cells: MAP.cells, get: get };
})();
