// Grove redraw study: the same Grove tile drawn five ways, each a different drawing technique rather than a
// palette swap. Nothing here uses random noise. Shapes are built from explicit clumps, facets and hand-placed
// sprites, then a cleanup pass removes stray single pixels from the crowns and ground.
// buildGroveRedraws() returns [{ id, name, ..., w, h, px: Array<'#rrggbb'|null>, metrics }].
function buildGroveRedraws() {
  const C = {
    deep: '#1a3445', pine: '#23584c', leaf: '#2f7d46', grass: '#56a43c', lime: '#9bcb3e', glow: '#e6e773',
    sage: '#7fb39a', bark: '#3f2b31', soil: '#77513c', clay: '#b57f52', stone: '#5f6e8a', pale: '#a3b5c4',
    cloud: '#f4f6ea', rose: '#e8587d', ink: '#141d26',
  };

  class Cv {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); this.mask = null; this.tag = new Uint8Array(w * h); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (!this.in(x, y) || !c) return; this.px[y * this.w + x] = c; if (this.mask) this.mask[y * this.w + x] = 1; }
    get(x, y) { return this.in(x, y) ? this.px[y * this.w + x] : null; }
    // Paint fn, then outline exactly what it painted: `hard` on the bottom/right, `soft` on the top/left.
    outlined(fn, soft, hard) {
      const m = new Uint8Array(this.w * this.h), prev = this.mask;
      this.mask = m; fn(); this.mask = prev;
      const marks = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (m[i]) continue;
        const at = (xx, yy) => this.in(xx, yy) && m[yy * this.w + xx];
        if (at(x, y - 1) || at(x - 1, y)) marks.push([x, y, hard]);
        else if (at(x, y + 1) || at(x + 1, y)) marks.push([x, y, soft]);
      }
      marks.forEach(([x, y, c]) => this.set(x, y, c));
      if (prev) m.forEach((v, i) => { if (v) prev[i] = 1; });
    }
    // A hand-drawn sprite: rows of characters, each mapped to a color by the legend ('.' is empty).
    sprite(x0, y0, rows, legend) { rows.forEach((r, y) => [...r].forEach((ch, x) => { if (legend[ch]) this.set(x0 + x, y0 + y, legend[ch]); })); }
  }

  // A pixel that matches none of its four neighbours reads as noise. Merge it into its most common neighbour.
  function cleanup(cv, keep = new Set()) {
    let fixed = 0;
    for (let pass = 0; pass < 2; pass++) {
      const src = cv.px.slice();
      for (let y = 1; y < cv.h - 1; y++) for (let x = 1; x < cv.w - 1; x++) {
        const c = src[y * cv.w + x];
        if (!c || keep.has(c)) continue;
        const n = [src[(y - 1) * cv.w + x], src[(y + 1) * cv.w + x], src[y * cv.w + x - 1], src[y * cv.w + x + 1]];
        if (n.includes(c) || n.some((v) => !v)) continue;
        const count = new Map(); n.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
        cv.px[y * cv.w + x] = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
        fixed++;
      }
    }
    return fixed;
  }
  function orphans(cv) {
    let n = 0;
    for (let y = 1; y < cv.h - 1; y++) for (let x = 1; x < cv.w - 1; x++) {
      const c = cv.px[y * cv.w + x];
      if (!c) continue;
      const nb = [cv.px[(y - 1) * cv.w + x], cv.px[(y + 1) * cv.w + x], cv.px[y * cv.w + x - 1], cv.px[y * cv.w + x + 1]];
      if (!nb.includes(c) && !nb.some((v) => !v)) n++;
    }
    return n;
  }

  // ---------- the tile ----------
  // Pointy-top hex, squashed for a 3/4 view. `s` scales everything for the low-res style.
  function hexGeom(s) { return { x: 48 * s, y: 70 * s, hw: 30 * s, hh: 17 * s, wall: Math.round(11 * s) }; }
  const inHex = (g, x, y) => { const dx = Math.abs(x + 0.5 - g.x), dy = Math.abs(y + 0.5 - g.y); return dx <= g.hw && dy <= g.hh - (g.hh / 2) * (dx / g.hw); };
  function bottoms(cv, g) { const b = new Array(cv.w).fill(-1); for (let x = 0; x < cv.w; x++) for (let y = 0; y < cv.h; y++) if (inHex(g, x, y)) b[x] = y; return b; }

  // Tile: flat top, lit rim on the top-left edges, two wall faces with banded strata. opt picks the idiom.
  function tile(cv, g, opt) {
    const b = bottoms(cv, g);
    for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
      if (!inHex(g, x, y)) continue;
      let c = opt.top;
      if (!inHex(g, x, y - 1)) c = x + 0.5 < g.x ? opt.rimLit : opt.rimShade;
      else if (opt.bevel && !inHex(g, x, y - 2)) c = x + 0.5 < g.x ? opt.bevel : opt.top;
      cv.set(x, y, c);
      cv.tag[y * cv.w + x] = 1; // face
    }
    for (let x = 0; x < cv.w; x++) {
      if (b[x] < 0) continue;
      const lit = x + 0.5 < g.x;
      for (let d = 1; d <= g.wall; d++) {
        const y = b[x] + d;
        let c = opt.band(d, lit, x);
        if (opt.crease && Math.abs(x + 0.5 - g.x) < 0.6 && d > 1) c = opt.crease;
        cv.set(x, y, c);
      }
    }
    return b;
  }
  function shadow(cv, g, cx, cy, rx, ry, map) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1 || !cv.tag[y * cv.w + x]) continue;
      const c = cv.get(x, y); if (map[c]) cv.set(x, y, map[c]);
    }
  }
  const SHADE = { [C.grass]: C.leaf, [C.lime]: C.grass, [C.leaf]: C.pine, [C.glow]: C.lime };

  // The grove's layout, shared by every style: three oaks, a bush, a log, flowers, tufts, one mushroom.
  // Trunk bases sit well inside the hex so the tile edge stays visible all the way round.
  const TREES = [[48, 58, 0.72], [29, 68, 0.8], [67, 66, 0.82], [45, 80, 1.0]]; // [baseX, baseY, size], drawn back to front
  const BUSH = [63, 82], LOG = [20, 72], TUFTS = [[32, 80], [52, 84], [72, 78], [22, 70]];
  const FLOWERS = [[26, 79, 'rose'], [35, 81, 'cloud'], [70, 75, 'glow'], [76, 77, 'rose'], [47, 85, 'cloud']];
  const MUSH = [74, 74];

  // ---------- shared small sprites, drawn by hand ----------
  const SPR = {
    log: { rows: ['.oo.......', 'occoooooo.', 'cyscCCCCCo', 'occoSSSSSo', '.oooBBBBo.', '....oooo..'], legend: (o) => ({ o, C: C.clay, S: C.soil, B: C.bark, y: C.glow, s: C.soil, c: C.clay }) },
    tuft: { rows: ['l...l', '.l.g.', '.ggG.'], legend: () => ({ l: C.lime, g: C.grass, G: C.leaf }) },
    mush: { rows: ['.rrr.', 'rwrrr', 'rrrwk', '.kpk.', '..p..'], legend: (o) => ({ r: C.rose, w: C.cloud, k: o, p: C.pale }) },
    flower: (c) => ({ rows: ['.p.', 'pyp', '.p.', '.e.'], legend: { p: C[c], y: c === 'glow' ? C.lime : C.glow, e: C.leaf } }),
  };
  // Every hand-placed detail must sit on the tile's top face. Count any pixel that would land on the wall or off the tile.
  function offTile(g) {
    let n = 0;
    const check = (x0, y0, rows) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && !inHex(g, x0 + x, y0 + y)) n++; }));
    TUFTS.forEach(([x, y]) => check(x - 2, y - 2, SPR.tuft.rows));
    FLOWERS.forEach(([x, y, c]) => check(x - 1, y - 2, SPR.flower(c).rows));
    check(LOG[0], LOG[1], SPR.log.rows);
    check(MUSH[0] - 2, MUSH[1] - 4, SPR.mush.rows);
    TREES.forEach(([x, y]) => { if (!inHex(g, x, y + 1)) n++; });
    return n;
  }
  // A detail painted over a tree would break depth (everything here stands behind the trees in front of it),
  // so count any detail pixel that would cover something other than open ground.
  let covered = 0;
  const GROUND = new Set([C.grass, C.lime, C.leaf, C.pine]);
  function guard(cv, x0, y0, rows) { rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && !GROUND.has(cv.get(x0 + x, y0 + y))) covered++; })); }
  function details(cv, ink) {
    covered = 0;
    TUFTS.forEach(([x, y]) => guard(cv, x - 2, y - 2, SPR.tuft.rows));
    FLOWERS.forEach(([x, y, c]) => guard(cv, x - 1, y - 2, SPR.flower(c).rows));
    guard(cv, LOG[0], LOG[1], SPR.log.rows);
    guard(cv, MUSH[0] - 2, MUSH[1] - 4, SPR.mush.rows);
    TUFTS.forEach(([x, y]) => cv.sprite(x - 2, y - 2, SPR.tuft.rows, SPR.tuft.legend()));
    FLOWERS.forEach(([x, y, c]) => { const f = SPR.flower(c); cv.sprite(x - 1, y - 2, f.rows, f.legend); });
    cv.sprite(LOG[0], LOG[1], SPR.log.rows, SPR.log.legend(ink));
    cv.sprite(MUSH[0] - 2, MUSH[1] - 4, SPR.mush.rows, SPR.mush.legend(ink));
  }

  // ---------- crown techniques ----------
  // Clumps for an oak of size s whose crown centre is (cx, cy). Back clumps first, so front clumps overlap them.
  const oakClumps = (cx, cy, s) => [[0, -6, 6.5], [-6, -1, 6], [6, -2, 6], [-3, 3, 6.5], [4, 4, 6]].map(([x, y, r]) => [cx + x * s, cy + y * s, r * s]);
  const disc = (dx, dy, r) => dx * dx + dy * dy <= r * r + r * 0.6;

  // Tone for a crown pixel: one big light mass for the whole crown (so it reads as one tree), plus a little
  // of each clump's own roundness. Light comes from the upper left.
  const lightAt = (px, py, cx, cy, R, qx, qy, r) => (-(px - cx) * 0.62 - (py - cy) * 0.78) / R + 0.35 * (-(px - qx) * 0.62 - (py - qy) * 0.78) / r;
  const DOWN = (t) => ({ [t.h]: t.l, [t.l]: t.m, [t.m]: t.d, [t.d]: t.o2 });

  // 1 Clean Cluster: one light mass across the crown; each clump gets a thin dark crescent on its lower-right
  // rim, which is what separates the leaf clusters. Selective outline goes on afterwards.
  function crownBands(cv, clumps, t, cx0, cy0, R) {
    const dn = DOWN(t);
    clumps.slice().sort((a, b) => a[1] - b[1]).forEach(([qx, qy, r]) => {
      for (let y = Math.floor(qy - r - 1); y <= qy + r + 1; y++) for (let x = Math.floor(qx - r - 1); x <= qx + r + 1; x++) {
        const px = x + 0.5, py = y + 0.5;
        if (!disc(px - qx, py - qy, r)) continue;
        const v = lightAt(px, py, cx0, cy0, R, qx, qy, r);
        let c = v > 0.95 ? t.h : v > 0.35 ? t.l : v > -0.35 ? t.m : t.d;
        if (!disc(px - (qx - 0.22 * r), py - (qy - 0.28 * r), 0.9 * r)) c = dn[c] || c;
        cv.set(x, y, c);
      }
    });
  }
  // 2 Bold Cartoon: three flat tones from the same light mass, each front clump's top edge drawn as a dark arc,
  // and a solid ink line around the outside only.
  function crownInk(cv, clumps, t, cx0, cy0, R) {
    const sorted = clumps.slice().sort((a, b) => a[1] - b[1]);
    const owner = new Map();
    sorted.forEach(([qx, qy, r], k) => {
      for (let y = Math.floor(qy - r - 1); y <= qy + r + 1; y++) for (let x = Math.floor(qx - r - 1); x <= qx + r + 1; x++) {
        const px = x + 0.5, py = y + 0.5;
        if (!disc(px - qx, py - qy, r)) continue;
        const v = lightAt(px, py, cx0, cy0, R, qx, qy, r);
        cv.set(x, y, v > 0.4 ? t.l : v > -0.4 ? t.m : t.d);
        owner.set(y * cv.w + x, k);
      }
    });
    owner.forEach((k, i) => { // seams: a pixel whose upper neighbour belongs to a clump further back
      const up = owner.get(i - cv.w);
      if (up !== undefined && up < k && sorted[k][1] - sorted[up][1] > 2) cv.px[i] = t.d;
    });
  }
  // 6 Leafy Cluster: Clean Cluster's structure with three fixes from its review. The silhouette is lobed like leaf
  // clusters instead of smooth circles, each clump is shaded mostly on its own so no diagonal banding runs across
  // the crown, and highlights come as small two-pixel leaf marks instead of a soft blob.
  const lobed = (dx, dy, r) => {
    const a = Math.atan2(dy, dx), lobes = Math.max(5, Math.round(r * 1.1));
    const edge = r + 0.9 * Math.max(0, Math.cos(a * lobes)) - 0.3;
    return dx * dx + dy * dy <= edge * edge;
  };
  function crownLeafy(cv, clumps, t, cx0, cy0, R) {
    const sorted = clumps.slice().sort((a, b) => a[1] - b[1]);
    sorted.forEach(([qx, qy, r]) => {
      for (let y = Math.floor(qy - r - 2); y <= qy + r + 2; y++) for (let x = Math.floor(qx - r - 2); x <= qx + r + 2; x++) {
        const px = x + 0.5, py = y + 0.5;
        if (!lobed(px - qx, py - qy, r)) continue;
        const v = 0.45 * (-(px - cx0) * 0.62 - (py - cy0) * 0.78) / R + 0.8 * (-(px - qx) * 0.62 - (py - qy) * 0.78) / r;
        let c = v > 0.45 ? t.l : v > -0.2 ? t.m : v > -0.65 ? t.d : t.o2;
        if (!disc(px - (qx - 0.25 * r), py - (qy - 0.3 * r), 0.86 * r) && c !== t.o2) c = c === t.l ? t.m : t.d; // clump crescent
        cv.set(x, y, c);
      }
    });
    // leaf marks: little two-pixel strokes on the sunlit side of each clump
    sorted.forEach(([qx, qy, r], k) => {
      for (const [ox, oy] of [[-0.45, -0.45], [-0.05, -0.62], [-0.62, -0.05]]) {
        const x = Math.round(qx + ox * r), y = Math.round(qy + oy * r);
        if (cv.get(x, y) === t.l && cv.get(x + 1, y) === t.l) { cv.set(x, y, t.h); cv.set(x + 1, y, t.h); cv.set(x, y + 1, t.l); }
      }
    });
  }

  // 4 Faceted: the crown is a cut gem. Six flat facets around an apex nudged toward the light, plus a top plane.
  function crownGem(cv, cx, cy, r, t) {
    const ax = cx - 0.22 * r, ay = cy - 0.28 * r;
    const pts = []; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k / 7) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92]); }
    const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const top = pts.map(([x, y]) => [ax + (x - cx) * 0.42, ay + (y - cy) * 0.42]);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inPoly(pts, px, py)) continue;
      let c;
      if (inPoly(top, px, py)) c = t.h;
      else {
        let k = Math.floor(((Math.atan2(py - ay, px - ax) + Math.PI / 2 + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2 / 7));
        const a = -Math.PI / 2 + (k + 0.5) * (Math.PI * 2 / 7);
        const l = -0.6 * Math.cos(a) - 0.8 * Math.sin(a);
        c = l > 0.45 ? t.l : l > -0.1 ? t.m : l > -0.6 ? t.d : t.o;
      }
      cv.set(x, y, c);
    }
  }
  // 5 Hi-bit Leaves: a dark silhouette covered in small hand-drawn leaf stamps, toned by where they face the light.
  const LEAF = ['..a..', '.aab.', 'abbbc', '.bcc.'];
  function crownLeaves(cv, clumps, cx, cy, R, t) {
    const inside = (x, y) => clumps.some(([qx, qy, r]) => disc(x + 0.5 - qx, y + 0.5 - qy, r));
    for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) if (inside(x, y)) cv.set(x, y, t.d);
    for (let row = 0, y = Math.floor(cy - R - 2); y < cy + R + 2; y += 3, row++) {
      for (let x = Math.floor(cx - R - 3) + (row % 2) * 2; x < cx + R + 2; x += 4) {
        const sx = Math.round(x), sy = y;
        if (!inside(sx + 2, sy) || !inside(sx, sy + 2) || !inside(sx + 4, sy + 2) || !inside(sx + 2, sy + 3)) continue;
        const v = (-(sx + 2 - cx) * 0.6 - (sy + 2 - cy) * 0.8) / R;
        const tone = v > 0.45 ? [t.h, t.l, t.m] : v > 0.05 ? [t.l, t.m, t.d] : v > -0.4 ? [t.m, t.d, t.o2] : [t.d, t.o2, t.o];
        cv.sprite(sx, sy, LEAF, { a: tone[0], b: tone[1], c: tone[2] });
      }
    }
  }

  const TONE = { o: C.deep, o2: C.pine, d: C.leaf, m: C.grass, l: C.lime, h: C.glow };
  function trunk(cv, x, y, h, cols) { for (let k = 0; k <= h; k++) cols.forEach((c, i) => cv.set(x - 1 + i, y - k, c)); }

  // Strata used by most styles: grass lip with drips, topsoil, soil with a clay band on the lit face.
  const strata = (wall) => (d, lit, x) => {
    if (d === 1) return lit ? C.grass : C.leaf;
    if (d === 2 && x % 7 === 3) return lit ? C.grass : C.leaf; // drips at a fixed rhythm
    if (d <= 3) return C.bark;
    if (d === wall) return C.deep;
    if (d === 6) return lit ? C.clay : C.bark;
    return lit ? C.soil : C.bark;
  };

  const STYLES = [
    {
      id: 'leafy', name: 'Leafy Cluster', tag: 'Recommended', s: 1, pick: true,
      blurb: 'Clean Cluster with its three review problems fixed. Crown edges are lobed like real leaf clusters, each clump is shaded on its own so no banding cuts across the crown, and the highlights are small leaf strokes.',
      draw(cv) {
        const g = hexGeom(1);
        tile(cv, g, { top: C.grass, rimLit: C.lime, rimShade: C.grass, bevel: C.lime, band: strata(g.wall), crease: C.bark });
        TREES.forEach(([x, y, s]) => shadow(cv, g, x + 5 * s, y + 1, 10 * s, 3.2 * s, SHADE));
        shadow(cv, g, BUSH[0] + 3, BUSH[1] + 1, 6, 2, SHADE);
        TREES.forEach(([x, y, s]) => cv.outlined(() => {
          trunk(cv, x, y, Math.round(9 * s), [C.clay, C.soil, C.bark]);
          cv.set(x - 2, y, C.soil); cv.set(x + 2, y, C.bark);
          cv.set(x - 2, y - Math.round(9 * s), C.soil); cv.set(x + 2, y - Math.round(8 * s), C.bark); // branches fork into the crown
          crownLeafy(cv, oakClumps(x, y - 15 * s, s), TONE, x, y - 15 * s, 12 * s);
        }, C.pine, C.deep));
        cv.outlined(() => crownLeafy(cv, [[BUSH[0] - 3, BUSH[1] - 3, 3.6], [BUSH[0] + 3, BUSH[1] - 3, 3.6], [BUSH[0], BUSH[1] - 5, 3.8]], TONE, BUSH[0], BUSH[1] - 4, 6), C.pine, C.deep);
        return { cleanupAfter: true, ink: C.bark };
      },
    },
    {
      id: 'cluster', name: 'Clean Cluster', tag: 'Modern indie', s: 1,
      blurb: 'Each crown is five clumps, and each clump has the same four bands: a dark crescent away from the sun, a mid body, a light cap and one highlight. A selective outline goes darkest on the shade side.',
      draw(cv) {
        const g = hexGeom(1);
        tile(cv, g, { top: C.grass, rimLit: C.lime, rimShade: C.grass, bevel: C.lime, band: strata(g.wall), crease: C.bark });
        TREES.forEach(([x, y, s]) => shadow(cv, g, x + 5 * s, y + 1, 10 * s, 3.2 * s, SHADE));
        shadow(cv, g, BUSH[0] + 3, BUSH[1] + 1, 6, 2, SHADE);
        TREES.forEach(([x, y, s]) => cv.outlined(() => {
          trunk(cv, x, y, Math.round(8 * s), [C.clay, C.soil, C.bark]);
          cv.set(x - 2, y, C.soil); cv.set(x + 2, y, C.bark);
          crownBands(cv, oakClumps(x, y - 15 * s, s), TONE, x, y - 15 * s, 12 * s);
        }, C.pine, C.deep));
        cv.outlined(() => crownBands(cv, [[BUSH[0] - 3, BUSH[1] - 3, 3.6], [BUSH[0] + 3, BUSH[1] - 3, 3.6], [BUSH[0], BUSH[1] - 5, 3.8]], TONE, BUSH[0], BUSH[1] - 4, 6), C.pine, C.deep);
        return { cleanupAfter: true, ink: C.bark };
      },
    },
    {
      id: 'cartoon', name: 'Bold Cartoon', tag: 'Adventure-game tiles', s: 1,
      blurb: 'Flat fills with one highlight and a solid ink line around every clump, trunk and tile edge. It gives up subtle shading for silhouettes that read instantly at any size.',
      draw(cv) {
        const g = hexGeom(1);
        const band = (d, lit) => (d === 1 ? (lit ? C.grass : C.leaf) : d === g.wall ? C.ink : d <= 3 ? C.bark : lit ? C.soil : C.bark);
        tile(cv, g, { top: C.grass, rimLit: C.lime, rimShade: C.grass, band, crease: C.ink });
        TREES.forEach(([x, y, s]) => shadow(cv, g, x + 5 * s, y + 1, 10 * s, 3.2 * s, SHADE));
        TREES.forEach(([x, y, s]) => {
          cv.outlined(() => trunk(cv, x, y, Math.round(8 * s), [C.clay, C.soil, C.bark]), C.ink, C.ink);
          cv.outlined(() => crownInk(cv, oakClumps(x, y - 15 * s, s), { d: C.leaf, m: C.grass, l: C.lime }, x, y - 15 * s, 12 * s), C.ink, C.ink);
        });
        cv.outlined(() => crownInk(cv, [[BUSH[0] - 3, BUSH[1] - 3, 3.8], [BUSH[0] + 3, BUSH[1] - 3, 3.8], [BUSH[0], BUSH[1] - 5, 4]], { d: C.leaf, m: C.grass, l: C.lime }, BUSH[0], BUSH[1] - 4, 6), C.ink, C.ink);
        // ink around the whole tile
        const src = cv.px.slice();
        for (let y = 1; y < cv.h - 1; y++) for (let x = 1; x < cv.w - 1; x++) {
          if (src[y * cv.w + x]) continue;
          if (src[(y - 1) * cv.w + x] || src[(y + 1) * cv.w + x] || src[y * cv.w + x - 1] || src[y * cv.w + x + 1]) cv.set(x, y, C.ink);
        }
        return { cleanupAfter: true, ink: C.ink };
      },
    },
    {
      id: 'chunky', name: 'Chunky Token', tag: 'Board-game icon', s: 0.5,
      blurb: 'Half the resolution, so every pixel is doubled. Each tree is one round crown on a short trunk in three tones with a full dark outline, built to read as a map token at a glance.',
      draw(cv) {
        const g = hexGeom(0.5);
        const band = (d, lit) => (d === 1 ? (lit ? C.grass : C.leaf) : d === g.wall ? C.deep : lit ? C.soil : C.bark);
        tile(cv, g, { top: C.grass, rimLit: C.lime, rimShade: C.grass, band });
        const T = TREES.map(([x, y, s]) => [x / 2, y / 2, s]);
        T.forEach(([x, y, s]) => shadow(cv, g, x + 2.5 * s, y + 0.5, 5 * s, 1.6, SHADE));
        T.forEach(([x, y, s]) => cv.outlined(() => {
          for (let k = 0; k <= 3; k++) { cv.set(x - 0.5, y - k, C.soil); cv.set(x + 0.5, y - k, C.bark); }
          crownBands(cv, [[x, y - 8 * s, 5.2 * s]], TONE, x, y - 8 * s, 5.2 * s);
        }, C.deep, C.deep));
        cv.outlined(() => crownBands(cv, [[BUSH[0] / 2, BUSH[1] / 2 - 2, 2.6]], TONE, BUSH[0] / 2, BUSH[1] / 2 - 2, 2.6), C.deep, C.deep);
        cv.sprite(LOG[0] / 2, LOG[1] / 2, ['oooooo', 'oCCCyo', 'oooooo'], { o: C.bark, C: C.clay, y: C.glow });
        return { cleanupAfter: true, noDetails: true };
      },
    },
    {
      id: 'faceted', name: 'Faceted Gem', tag: 'Low-poly pixel', s: 1,
      blurb: 'Crowns are cut like gems: seven flat facets around an apex nudged toward the sun, with a bright top plane. There are no outlines, only hard value changes, matching the angular boulders.',
      draw(cv) {
        const g = hexGeom(1);
        const band = (d, lit) => (d === 1 ? (lit ? C.lime : C.leaf) : d === g.wall ? C.deep : lit ? (d < 6 ? C.clay : C.soil) : (d < 6 ? C.soil : C.bark));
        tile(cv, g, { top: C.grass, rimLit: C.lime, rimShade: C.grass, band });
        TREES.forEach(([x, y, s]) => shadow(cv, g, x + 5 * s, y + 1, 10 * s, 3.2 * s, SHADE));
        TREES.forEach(([x, y, s]) => {
          trunk(cv, x, y, Math.round(8 * s), [C.clay, C.soil, C.bark]);
          crownGem(cv, x, y - 15 * s, 12 * s, { o: C.pine, d: C.leaf, m: C.grass, l: C.lime, h: C.glow });
        });
        crownGem(cv, BUSH[0], BUSH[1] - 4, 5, { o: C.pine, d: C.leaf, m: C.grass, l: C.lime, h: C.lime });
        return { cleanupAfter: true, ink: C.bark };
      },
    },
    {
      id: 'hibit', name: 'Hi-bit Leaves', tag: 'Detailed 16-bit', s: 1,
      blurb: 'A dark crown silhouette covered in small hand-drawn leaf stamps, row over row like scales. Each stamp takes a tone set by where it faces the light, giving leaf texture without random noise.',
      draw(cv) {
        const g = hexGeom(1);
        tile(cv, g, { top: C.grass, rimLit: C.lime, rimShade: C.grass, bevel: C.lime, band: strata(g.wall), crease: C.bark });
        [[33, 90], [58, 92], [70, 86]].forEach(([x, y]) => cv.sprite(x, y, ['pS', 'SS'], { p: C.pale, S: C.stone })); // stones set in the wall
        TREES.forEach(([x, y, s]) => shadow(cv, g, x + 5 * s, y + 1, 10 * s, 3.2 * s, SHADE));
        TREES.forEach(([x, y, s]) => cv.outlined(() => {
          trunk(cv, x, y, Math.round(8 * s), [C.clay, C.soil, C.bark]);
          for (let k = 2; k < 8 * s; k += 3) cv.set(x, y - k, C.bark); // bark lines
          cv.set(x - 2, y, C.soil); cv.set(x + 2, y, C.bark);
          crownLeaves(cv, oakClumps(x, y - 15 * s, s), x, y - 15 * s, 12 * s, { ...TONE });
        }, C.pine, C.deep));
        cv.outlined(() => crownLeaves(cv, [[BUSH[0] - 3, BUSH[1] - 3, 3.6], [BUSH[0] + 3, BUSH[1] - 3, 3.6], [BUSH[0], BUSH[1] - 5, 3.8]], BUSH[0], BUSH[1] - 4, 6, TONE), C.pine, C.deep);
        return { cleanupAfter: true, ink: C.bark };
      },
    },
  ];

  const list = STYLES.map((st) => {
    const lo = st.s < 1;
    const cv = new Cv(lo ? 48 : 96, lo ? 56 : 112);
    const r = st.draw(cv);
    const before = orphans(cv);
    const fixed = r.cleanupAfter ? cleanup(cv) : 0;
    const after = orphans(cv); // measured before the hand-drawn details, whose single-pixel flower hearts are intended
    if (!r.noDetails) details(cv, r.ink);
    // scale the low-res style up so every style shows at the same size
    let px = cv.px;
    if (lo) { px = new Array(96 * 112).fill(null); for (let y = 0; y < 112; y++) for (let x = 0; x < 96; x++) px[y * 96 + x] = cv.px[(y >> 1) * 48 + (x >> 1)]; }
    const colors = new Set(px.filter(Boolean)).size;
    // how much of the tile's top rim is still visible (the hex must stay readable as a hex)
    const g = hexGeom(st.s); let rim = 0, rimShown = 0;
    for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) if (inHex(g, x, y) && !inHex(g, x, y - 1)) { rim++; const c = cv.get(x, y); if (c === C.lime || c === C.grass) rimShown++; }
    return { ...st, w: 96, h: 112, px, metrics: { offTile: r.noDetails ? 0 : offTile(hexGeom(1)), overTrees: r.noDetails ? 0 : covered, strayBefore: before, strayFixed: fixed, strayAfter: after, colors, rimVisible: Math.round((rimShown / rim) * 100) } };
  });
  list.countStray = (px, w, h) => orphans(Object.assign(new Cv(w, h), { px }));
  return list;
}
