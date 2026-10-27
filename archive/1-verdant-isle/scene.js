// Verdant Isle: a 256x192, 16-color pixel scene of five hex tiles over a valley.
// Everything is painted per pixel as palette indices, following Slynyrd's landscape process:
// horizon bars, bands, far and near mountains, haze, clouds, then the near plane with the most contrast.
// buildVerdantIsle() returns { W, H, PAL, NAMES, HEX, STEPS, render(step, t) } where render fills and returns a Uint8Array.
function buildVerdantIsle() {
  const W = 256, H = 192;
  const PAL = ['#1a3445', '#23584c', '#2f7d46', '#56a43c', '#9bcb3e', '#e6e773', '#7fb39a', '#3f2b31',
               '#77513c', '#b57f52', '#5f6e8a', '#a3b5c4', '#5f9edd', '#a9d5f0', '#f4f6ea', '#e8587d'];
  const NAMES = ['deep', 'pine', 'leaf', 'grass', 'lime', 'glow', 'sage', 'bark',
                 'soil', 'clay', 'stone', 'pale', 'sky', 'mist', 'cloud', 'rose'];
  const [DEEP, PINE, LEAF, GRASS, LIME, GLOW, SAGE, BARK, SOIL, CLAY, STONE, PALE, SKY, MIST, CLOUD, ROSE] = PAL.map((_, i) => i);
  const STEPS = ['Horizon bars', 'Sky and valley bands', 'Far mountains', 'Near range and haze', 'Near clouds',
                 'Valley texture', 'Island block', 'Ground detail', 'Props', 'Life'];

  const buf = new Uint8Array(W * H);
  const face = new Int8Array(W * H);
  const outMark = new Uint8Array(W * H); // 1 = soft outline, 2 = hard outline, for the style variants   // index of the hex top that owns a pixel, or -1
  const ybot = new Int16Array(W).fill(-1); // lowest face pixel per column
  const cut = new Int16Array(W).fill(-1);  // lowest island pixel per column

  function hash(x, y, s = 0) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s = 0) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  // Isolation state for the per-tile build views: ONLY limits drawing to one hex, REMAP flattens colors to a
  // two-value block-in, SHADOW_ONLY lets props lay down their cast shadows without painting themselves.
  let ONLY = -1, REMAP = null, SHADOW_ONLY = false, inShadow = false, MASK = null;
  const BLOCK = { [GLOW]: GRASS, [LIME]: GRASS, [LEAF]: PINE, [CLOUD]: PALE, [CLAY]: SOIL, [MIST]: SKY };
  const put = (x, y, c) => {
    if (SHADOW_ONLY && !inShadow) return;
    if (REMAP && !inShadow && REMAP[c] !== undefined) c = REMAP[c];
    x = Math.floor(x); y = Math.floor(y);
    if (inb(x, y)) { buf[y * W + x] = c; outMark[y * W + x] = 0; if (MASK && !inShadow) MASK[y * W + x] = 1; }
  };
  const at = (x, y) => (inb(x, y) ? buf[y * W + x] : -1);
  const faceAt = (x, y) => { if (!inb(x, y)) return -1; const f = face[y * W + x]; return ONLY >= 0 && f !== ONLY ? -1 : f; };
  const fillRows = (y0, y1, c) => buf.fill(c, Math.max(0, y0) * W, Math.min(H, y1) * W);

  // Shadow is a darker, bluer step of the local hue.
  const DARK = { [GRASS]: LEAF, [LIME]: GRASS, [LEAF]: PINE, [GLOW]: LIME, [SOIL]: BARK, [CLAY]: SOIL, [PINE]: DEEP,
                 [CLOUD]: PALE, [PALE]: STONE, [ROSE]: SOIL, [SKY]: PINE, [MIST]: SKY };
  const darken = (x, y) => { const c = at(x, y); if (c >= 0 && DARK[c] !== undefined) put(x, y, DARK[c]); };

  const TONE = [-0.06, -0.1, 0, 0.07, -0.02]; // per-tile grass tone, so neighbouring tiles read apart
  // ---------- hex layout: pointy-top, squashed for a 3/4 view ----------
  const R = 35.8, HW = 31, K = 0.62, S3 = Math.sqrt(3);
  const HEX = [
    { id: 'A', name: 'Grove', x: 97, y: 85, front: false },
    { id: 'B', name: 'Pines', x: 159, y: 85, front: false },
    { id: 'C', name: 'Pond', x: 66, y: 118, front: true },
    { id: 'D', name: 'Meadow', x: 128, y: 118, front: true },
    { id: 'E', name: 'Rocks', x: 190, y: 118, front: true },
  ];
  function inHex(h, x, y) {
    const dx = Math.abs(x + 0.5 - h.x), dy = Math.abs((y + 0.5 - h.y) / K);
    return dx <= HW && dy <= R - dx / S3;
  }
  face.fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    HEX.forEach((h, i) => { if (inHex(h, x, y)) { face[y * W + x] = i; ybot[x] = Math.max(ybot[x], y); } });
  const T = 12; // wall depth before the rocky underside
  for (let x = 0; x < W; x++) {
    if (ybot[x] < 0) continue;
    const u = (x - 128) / 96;
    const taper = 32 * Math.pow(Math.max(0, 1 - u * u), 1.3);
    cut[x] = ybot[x] + T + Math.floor(taper * (0.75 + 0.25 * vnoise(x / 5, 3, 11)) + hash(x >> 1, 0, 12) * 3);
  }

  // Each tile on its own gets a short wall of its own, so back tiles show their sides in the build views.
  const TILE = HEX.map((h, i) => {
    const yb = new Int16Array(W).fill(-1), ct = new Int16Array(W).fill(-1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (face[y * W + x] === i) yb[x] = Math.max(yb[x], y);
    for (let x = 0; x < W; x++) if (yb[x] >= 0) {
      if (h.front) { ct[x] = cut[x]; continue; } // front tiles keep their slice of the island's underside
      const u = (x + 0.5 - h.x) / HW;
      ct[x] = yb[x] + T + Math.floor(9 * Math.max(0, 1 - u * u) + hash(x >> 1, 0, 12) * 2);
    }
    return { yb, ct };
  });
  let YB = ybot, CUT = cut;

  // ---------- background helpers ----------
  // Linear streak texture across a band edge, the tutorial's way of blending a gradient without dither.
  function blendEdge(yb, upper, lower, k, seed) {
    for (let d = 1; d <= k; d++) {
      const p = (1 - d / (k + 1)) * 0.75;
      for (const [y, c, q] of [[yb - d, lower, p], [yb + d - 1, upper, p * 0.55]]) {
        let x = Math.floor(hash(d, y, seed) * 6) - 6;
        while (x < W) {
          const len = 3 + Math.floor(hash(x, y, seed + 1) * 11);
          if (hash(x + 7, y, seed + 2) < q) for (let i = 0; i < len; i++) put(x + i, y, c);
          x += len + 1 + Math.floor(hash(x, y, seed + 3) * 5);
        }
      }
    }
  }
  function makePeaks(seed, x0, x1, gap, yLo, yHi, sLo, sHi) {
    const peaks = [];
    for (let x = x0, i = 0; x < x1; i++) {
      peaks.push({ x, y: yLo + hash(i, 1, seed) * (yHi - yLo), s: sLo + hash(i, 2, seed) * (sHi - sLo), seed: seed + i });
      x += gap * (0.7 + hash(i, 3, seed) * 0.6);
    }
    return peaks;
  }
  // A mountain layer: silhouette is the lowest peak profile; right of each ridge line falls into shadow.
  function range(peaks, base, body, shade, opt = {}) {
    for (let x = 0; x < W; x++) {
      let top = 1e9, own = null;
      for (const p of peaks) {
        const t = p.y + Math.abs(x - p.x) * p.s + (vnoise(x / 3, p.seed, 21) - 0.5) * 2.2;
        if (t < top) { top = t; own = p; }
      }
      if (opt.bumps) { // tree crowns along a forested ridge
        const cell = Math.floor(x / 4), u = (x % 4) - 1.5;
        top -= Math.max(0, (2.2 - u * u * 0.55) * (0.4 + hash(cell, 0, opt.seed) * 0.8));
      }
      top = Math.round(top);
      for (let y = Math.max(0, top); y < base; y++) {
        const ridge = own.x + (y - own.y) * 0.32 + (vnoise(y / 4, own.seed, 22) - 0.5) * 4;
        let c = x > ridge ? shade : body;
        if (c === body && vnoise((x - (y - own.y) * 0.7) / 2.5, y / 7, own.seed + 40) > 0.8) c = shade; // gullies
        if (opt.lit !== undefined && c === body && (y - top < 1 || ((x % 4 === 1) && ((y + (x >> 2)) % 4 === 0)))) c = opt.lit;
        put(x, y, c);
      }
    }
  }
  function cloud(cx, cy, w, seed) {
    const blobs = [];
    for (let i = 0, n = Math.max(3, Math.round(w / 7)); i < n; i++) {
      const f = i / (n - 1) - 0.5;
      blobs.push({ x: cx + f * w, y: cy - (1 - Math.abs(f) * 1.8) * 4 - hash(i, 0, seed) * 3, r: 4 + (1 - Math.abs(f) * 1.6) * 4 + hash(i, 1, seed) * 2 });
    }
    for (let y = Math.floor(cy - 18); y <= cy + 1; y++) for (let x = Math.floor(cx - w); x <= cx + w; x++) {
      let inside = false, lit = 0;
      for (const b of blobs) {
        const dx = x - b.x, dy = y - b.y, d2 = dx * dx + dy * dy;
        if (d2 <= b.r * b.r) { inside = true; lit = Math.max(lit, (-dx * 0.5 - dy * 0.85) / b.r); }
      }
      if (!inside) continue;
      const xx = ((x % W) + W) % W;
      let c = CLOUD;
      if (y >= cy - 1) c = y === cy + 1 ? PALE : MIST;          // flat shaded underside
      else if (lit < -0.35) c = MIST;
      else if (lit < -0.1 && (x + y) % 2 === 0 && y > cy - 4) c = MIST;
      put(xx, y, c);
    }
  }

  // ---------- props ----------
  // A one-pixel outline around whatever fn paints, so each asset reads on busy grass:
  // the darkest tone on the bottom and right, a softer dark on the lit top and left.
  function outlined(fn, soft = PINE, hard = DEEP) {
    const m = new Uint8Array(W * H), prev = MASK;
    MASK = m; fn(); MASK = prev;
    const marks = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (m[i]) continue;
      if (m[i - W] || m[i - 1] || m[i - W - 1]) marks.push(i, hard);
      else if (m[i + W] || m[i + 1]) marks.push(i, soft);
    }
    for (let k = 0; k < marks.length; k += 2) { put(marks[k] % W, (marks[k] / W) | 0, marks[k + 1]); outMark[marks[k]] = marks[k + 1] === hard ? 2 : 1; }
    if (prev) for (let i = 0; i < m.length; i++) if (m[i]) prev[i] = 1;
  }
  function shadowEllipse(cx, cy, rx, ry, onFaceOnly = true) {
    inShadow = true;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e <= 1 + (hash(x, y, 5) - 0.5) * 0.3 && (!onFaceOnly || faceAt(x, y) >= 0)) darken(x, y);
    }
    inShadow = false;
  }
  // Leaf canopy: clumps drawn top first so lower clumps overlap with their lit top-left rims, the clustering
  // rule from the tutorial's foliage. A selective dark rim sits only on the shadow side.
  function canopy(cx, cy, Rr, blobs, seed, opt = {}) {
    blobs = blobs.slice().sort((a, b) => a[1] - b[1]);
    for (const [bxo, byo, br] of blobs) {
      const bx = cx + bxo, by = cy + byo;
      for (let y = Math.floor(by - br - 1); y <= by + br + 1; y++) for (let x = Math.floor(bx - br - 1); x <= bx + br + 1; x++) {
        const dx = x + 0.5 - bx, dy = y + 0.5 - by, d = Math.hypot(dx, dy);
        const edge = br + (hash(x, y, seed) - 0.5) * 1.6;
        if (d > edge) continue;
        const l = (-0.6 * dx - 0.8 * dy) / br;
        const g = (-0.45 * (x - cx) - 0.6 * (y - cy)) / Rr;
        let v = 0.55 * l + 0.5 * g + (vnoise(x / 2, y / 2, seed + 1) - 0.5) * 0.35;
        // scalloped sub-clusters: the bottom-right corner of each little leaf cell steps darker
        const cxl = (x + ((y / 3) | 0) * 2) % 4, cyl = y % 3;
        if (cxl === 3 && cyl === 2) v -= 0.35;
        let c = v > 0.62 ? LIME : v > 0.25 ? GRASS : v > -0.12 ? LEAF : v > -0.5 ? PINE : DEEP;
        if (v > 0.86 && hash(x, y, seed + 2) < 0.5 && !opt.noGlow) c = GLOW;
        if (d > edge - 1 && l < -0.25) c = DEEP;
        put(x, y, c);
      }
    }
  }
  function oak(x0, y0, s, seed) {
    shadowEllipse(x0 + 7 * s, y0 + 1, 13 * s, 4 * s);
    outlined(() => oakBody(x0, y0, s, seed));
    for (let i = 0; i < 10; i++) { // fallen leaves and light flecks beneath
      const fx = x0 + (hash(i, 9, seed) - 0.3) * 24 * s, fy = y0 + 2 + (hash(i, 10, seed) - 0.3) * 5;
      if (faceAt(fx, fy) >= 0 && at(fx, fy) !== DEEP) put(fx, fy, hash(i, 11, seed) < 0.5 ? LIME : GLOW);
    }
  }
  function oakBody(x0, y0, s, seed) {
    const th = Math.round(11 * s);
    for (let y = y0 - th; y <= y0; y++) {
      put(x0 - 2, y, CLAY); put(x0 - 1, y, SOIL); put(x0, y, SOIL); put(x0 + 1, y, BARK);
      if ((y + seed) % 5 === 0) put(x0, y, BARK);
    }
    put(x0 - 3, y0, SOIL); put(x0 + 2, y0, BARK); put(x0 + 3, y0, BARK); // root flare
    for (let i = 0; i < 5; i++) { put(x0 - 2 - i, y0 - th - i, i < 2 ? SOIL : BARK); put(x0 + 1 + i, y0 - th - 1 - i, BARK); } // forks into the crown
    const cy = y0 - th - 9 * s, r = (v) => v * s;
    const jit = (i, k) => (hash(i, k, seed) - 0.5) * 3;
    const wide = 0.85 + hash(0, 7, seed) * 0.35, lean = (hash(0, 8, seed) - 0.5) * 4; // no two crowns the same shape
    const base = [[-8, 1, 7], [7, 0, 7], [0, -7, 8.5], [-4, -1, 7], [4, 5, 6], [-9, 6, 5], [9, 6, 5], [0, 3, 7.5], [-5, -10, 5], [5, -11, 5]];
    const crown = base.filter((_, i) => i < 6 || hash(i, 6, seed) > 0.3);
    canopy(x0, cy, 16 * s, crown.map(([a, b, c], i) => [r(a * wide + jit(i, 1) + lean * (b < 0 ? 1 : 0)), r(b + jit(i, 2)), r(c + jit(i, 3) * 0.5)]), seed);
    // gaps in the crown where branches show through
    for (const [gx, gy] of [[-5, 6], [6, 4], [1, 9]]) {
      const px = Math.round(x0 + gx * s), py = Math.round(cy + gy * s);
      put(px, py, DEEP); put(px + 1, py, DEEP); put(px, py + 1, BARK);
    }
  }
  // Conifer: stacked drooping tiers, drawn bottom tier first so each upper tier's ragged hem overlaps the one below.
  function pine(x0, y0, h, seed) {
    shadowEllipse(x0 + h * 0.3, y0 + 1, h * 0.34, 3);
    outlined(() => {
      for (let y = y0 - 4; y <= y0; y++) { put(x0 - 1, y, SOIL); put(x0, y, BARK); }
      const top = y0 - h, tiers = h > 26 ? 5 : 4, step = (h - 4) / tiers, maxW = h * 0.34;
      for (let i = tiers - 1; i >= 0; i--) {
        const tTop = Math.round(top + i * step * 0.78), tBot = Math.round(top + (i + 1) * step + 1);
        const wB = maxW * (0.3 + 0.7 * (i + 1) / tiers);
        for (let y = tTop; y <= tBot; y++) {
          const f = (y - tTop) / Math.max(1, tBot - tTop), w = 0.6 + (wB - 0.6) * f;
          for (let x = Math.floor(x0 - w); x <= Math.ceil(x0 + w) - 1; x++) {
            if (y === tBot && (x + i) % 2 === 0) continue;            // drooping tips along the hem
            const side = (x + 0.5 - x0) / w;
            let c = PINE;
            if (side < -0.15) c = LEAF;
            if (side < -0.5 && f > 0.45) c = GRASS;                    // sunlit tier tips
            if (side > 0.5 || (f > 0.82 && side > -0.2)) c = DEEP;     // tier underside and shade side
            if (c === LEAF && hash(x, y, seed) < 0.14) c = GRASS;
            if (c === PINE && hash(x, y, seed + 1) < 0.1) c = LEAF;
            put(x, y, c);
          }
        }
      }
      put(x0, top - 1, LIME); put(x0 - 1, top, GRASS);
    });
  }
  // Fern: arched fronds with leaflets on both sides, so it reads as a fern and not a tuft.
  function fern(x0, y0, seed, size = 1) {
    outlined(() => {
      const fronds = [[-1, -0.35], [-0.6, -0.9], [0.05, -1], [0.65, -0.85], [1, -0.3]];
      fronds.forEach(([fx, fy], k) => {
        const n = Math.round((5 + (k === 2 ? 1 : 0)) * size);
        for (let i = 1; i <= n; i++) {
          const t = i / n, x = Math.round(x0 + fx * n * t), y = Math.round(y0 + fy * n * t + t * t * n * 0.45);
          const lit = fx < 0.2;
          put(x, y, lit ? GRASS : LEAF);
          if (i % 2 === 0 && i < n) { put(x - 1, y - (fx > 0 ? 1 : 0), lit ? LIME : GRASS); put(x + 1, y - (fx < 0 ? 1 : 0), lit ? GRASS : LEAF); }
        }
      });
      put(x0, y0, PINE);
    }, PINE, DEEP);
  }
  function tuft(x0, y0, big, seed) {
    const tall = big ? 3 : 2;
    for (let i = 0; i <= tall; i++) put(x0, y0 - i, i === tall ? LIME : GRASS);
    for (let i = 0; i < tall; i++) { put(x0 - 1 - (i >> 1), y0 - i, i === tall - 1 ? GRASS : LEAF); put(x0 + 1 + (i >> 1), y0 - i, LEAF); }
  }
  // Flowers: 0 poppy (rose cup), 1 daisy (white star, yellow eye), 2 buttercup (yellow cup), 3 lupine (rose spike).
  // Front-row flowers stand on a 2-3px stem with a leaf; back-row ones are a single pixel.
  function flower(x, y, kind, big) {
    if (!big) { put(x, y, kind === 0 || kind === 3 ? ROSE : kind === 1 ? CLOUD : GLOW); return; }
    const stem = kind === 3 ? 3 : 2;
    for (let i = 1; i <= stem; i++) put(x, y + i, LEAF);
    put(x + 1, y + stem, GRASS); put(x - 1, y + stem - 1, LEAF);
    if (kind === 0) { put(x - 1, y, ROSE); put(x, y, SOIL); put(x + 1, y, ROSE); put(x - 1, y - 1, ROSE); put(x + 1, y - 1, ROSE); put(x, y - 1, ROSE); }
    else if (kind === 1) { put(x, y, GLOW); put(x - 1, y, CLOUD); put(x + 1, y, CLOUD); put(x, y - 1, CLOUD); put(x, y + 1, CLOUD); }
    else if (kind === 2) { put(x - 1, y - 1, GLOW); put(x + 1, y - 1, GLOW); put(x, y, GLOW); put(x - 1, y, LIME); put(x + 1, y, GLOW); }
    else { for (let i = 0; i < 4; i++) { put(x, y - i, i === 3 ? CLOUD : ROSE); if (i < 2) put(x + (i ? -1 : 1), y - i, ROSE); } }
  }
  function boulder(x0, y0, a, b, seed) {
    shadowEllipse(x0 + 2, y0 + 1, a + 2, 2.5);
    outlined(() => boulderBody(x0, y0, a, b, seed), STONE, DEEP);
  }
  // Angular boulder: a jittered polygon with a flat base. Each side is one flat facet lit by its outward
  // normal, and a smaller top plane catches the most light, so it reads as stone rather than an egg.
  function boulderBody(x0, y0, a, b, seed) {
    const cy = y0 - b, n = 7, pts = [];
    for (let k = 0; k < n; k++) {
      const ang = Math.PI + (k / (n - 1)) * Math.PI; // upper half, left to right
      const rr = 0.85 + hash(k, 0, seed) * 0.3;
      pts.push([x0 + Math.cos(ang) * a * rr, cy + Math.sin(ang) * b * 1.15 * rr]);
    }
    pts.push([x0 + a * 0.95, y0], [x0 - a * 0.95, y0]);
    const top = pts.slice(1, n - 1).map(([px, py]) => [x0 - a * 0.12 + (px - x0) * 0.55, cy - b * 0.3 + (py - cy) * 0.5]);
    const inPoly = (P, x, y) => {
      let c = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i], [xj, yj] = P[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const crackX = x0 + Math.round((hash(0, 0, seed) - 0.2) * a * 0.5);
    for (let y = Math.floor(cy - b * 1.3); y <= y0; y++) for (let x = Math.floor(x0 - a - 1); x <= x0 + a + 1; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inPoly(pts, px, py)) continue;
      let c;
      if (inPoly(top, px, py)) {
        c = PALE;
        if (!inPoly(top, px - 1, py) || !inPoly(top, px, py - 1)) c = CLOUD;     // lit edge of the top plane
      } else if (py > cy) { // the upright lower sides: lit on the left, shade only toward the right edge
        const u = (px - x0) / a;
        c = u < -0.35 ? (hash(x, y, seed) < 0.35 ? PALE : STONE) : u > 0.4 ? DEEP : STONE;
      } else {
        const ang = Math.atan2((py - cy) / b, (px - x0) / a);
        const sector = Math.round((ang + Math.PI) / (Math.PI / 3));
        const na = sector * (Math.PI / 3) - Math.PI;
        const l = -0.6 * Math.cos(na) - 0.8 * Math.sin(na);
        c = l > 0.35 ? PALE : l > -0.25 ? STONE : DEEP;
        if (py > y0 - 1.5) c = c === PALE ? STONE : DEEP;                          // base sits in its own shade
      }
      const ny = (py - cy) / b;
      const moss = inPoly(top, px, py) && (ny < -0.6 + (vnoise(x / 2, 0, seed) - 0.5) * 0.8);
      if (moss) c = c === CLOUD ? LIME : (hash(x, y, seed) < 0.3 ? LIME : GRASS);
      if (Math.abs(px - (crackX + (py - cy) * 0.5)) < 0.6 && ny > -0.2 && ny < 0.9) c = DEEP;
      put(x, y, c);
    }
  }
  function berryBush(x0, y0, seed) {
    shadowEllipse(x0 + 4, y0 + 1, 8, 2.5);
    outlined(() => {
      canopy(x0, y0 - 5, 8, [[-4, 1, 4.5], [4, 1, 4.5], [0, -2, 5], [-1, 2, 4.5], [3, -3, 3.5]], seed, { noGlow: true });
      for (let i = 0; i < 16; i++) { // berries in little pairs, each with a glint on its lit side
        const bx = x0 + Math.round((hash(i, 0, seed) - 0.5) * 13), by = y0 - 2 - Math.round(hash(i, 1, seed) * 8);
        const c = at(bx, by);
        if (c === GRASS || c === LEAF || c === LIME) { put(bx, by, ROSE); put(bx + 1, by, i % 2 ? ROSE : SOIL); put(bx, by - 1, c === LIME ? CLOUD : at(bx, by - 1)); }
      }
    });
  }
  function mushroom(x, y, big = true) {
    shadowEllipse(x + 1, y + 1, 3, 1.2);
    outlined(() => {
      put(x, y, CLOUD); put(x, y - 1, CLOUD); put(x + 1, y, PALE); put(x + 1, y - 1, PALE);   // stem
      const rows = big ? [[-1, 1], [-2, 2], [-3, 3]] : [[-1, 1], [-2, 2]];
      rows.forEach(([a, b], k) => { for (let i = a; i <= b + 1; i++) put(x + i, y - 2 - rows.length + k, i > b - 1 ? SOIL : ROSE); });
      for (let i = rows[rows.length - 1][0] + 1; i <= rows[rows.length - 1][1]; i++) put(x + i, y - 1 - (big ? 0 : 0), i === 0 || i === 1 ? at(x + i, y - 1) : PALE);
      put(x - 1, y - 2 - rows.length + 1, CLOUD); put(x + 1, y - 2 - rows.length + 2, CLOUD); if (big) put(x - 2, y - 3, CLOUD); // spots
    }, BARK, BARK);
  }
  function cattail(x, y, h) {
    outlined(() => {
      for (let i = 0; i < h; i++) put(x, y - i, i > h - 4 ? GRASS : LEAF);
      for (let i = 0; i < 4; i++) { put(x, y - h - i, i === 0 ? BARK : SOIL); put(x + 1, y - h - i, BARK); } // the brown head
      put(x, y - h - 4, LIME); put(x, y - h - 5, LIME);
      for (let i = 0; i < h - 2; i++) put(x - 1 - (i >> 2), y - i, i > h - 5 ? LIME : GRASS); // one long blade
    }, PINE, DEEP);
  }
  // ---------- pond, channel, waterfall ----------
  const pondC = HEX[2];
  const channel = [[51, 124], [49, 127], [47, 130], [45, 132.5]];
  function inPond(x, y) {
    const e = ((x + 0.5 - 61) / 19) ** 2 + ((y + 0.5 - 119) / 7.5) ** 2;
    if (e <= 1 + (vnoise(x / 4, y / 3, 77) - 0.5) * 0.35) return true;
    for (const [cx, cy] of channel) if (Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.3) < 2.6) return faceAt(x, y) === 2;
    return false;
  }
  const FALL = [42, 48];
  function waterfall(t) {
    for (let x = FALL[0] - 4; x <= FALL[1] + 4; x++) {
      const top = YB[Math.min(Math.max(x, FALL[0]), FALL[1])];
      for (let y = top; y < 188; y++) {
        const spread = (y - top) / 34;
        const l = FALL[0] - spread * 0.6, r = FALL[1] + spread;
        if (x < Math.floor(l) || x > Math.ceil(r)) continue;
        if (y < top + 1 && (x < FALL[0] || x > FALL[1])) continue;
        let c = MIST;
        if (x <= l + 0.5) c = CLOUD; else if (x >= r - 0.6) c = SKY;
        else if (hash(x, Math.floor((y - t * 34) / 4), 61) < 0.32) c = CLOUD;
        else if (hash(x, Math.floor((y - t * 34) / 3), 62) < 0.18) c = SKY;
        if (y > 172) { // mist plume dissolving into the valley haze
          const k = (y - 172) / 16;
          if (hash(x, y, Math.floor(t * 8)) < k * 0.9) continue;
          c = (x + y) % 2 ? CLOUD : MIST;
        }
        put(x, y, c);
      }
      if (x === FALL[0] || x === FALL[1]) put(x, top, CLOUD); // water curling over the lip
    }
  }

  // ---------- path across the meadow, up between the back hexes ----------
  const PATH = [[128, 142], [131, 133], [128, 123], [126, 113], [128, 103], [129, 93], [128, 84], [128, 76]];
  function pathDist(x, y) {
    let best = 1e9, by = y;
    for (let i = 0; i < PATH.length - 1; i++) {
      const [ax, ay] = PATH[i], [bx, bY] = PATH[i + 1];
      const vx = bx - ax, vy = (bY - ay) / K, wx = x + 0.5 - ax, wy = (y + 0.5 - ay) / K;
      const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
      const dx = wx - vx * t, dy = wy - vy * t, d = Math.hypot(dx, dy);
      if (d < best) { best = d; by = ay + (bY - ay) * t; }
    }
    return { d: best, w: 0.8 + Math.max(0, (by - 72) / 70) * 5 };
  }

  // ---------- the passes ----------
  function background(step, t) {
    // 1: flat horizon bars
    fillRows(0, 104, step >= 2 ? SKY : SKY);
    fillRows(104, H, SAGE);
    if (step < 2) return;
    // 2: bands, joined by streaks; far clouds baked into the gradient
    fillRows(30, 60, MIST); fillRows(60, 104, CLOUD);
    fillRows(106, 128, SAGE); fillRows(128, H, LEAF);
    blendEdge(30, SKY, MIST, 6, 31); blendEdge(60, MIST, CLOUD, 7, 32); blendEdge(128, SAGE, LEAF, 6, 33);
    for (let y = 8; y < 58; y++) for (let x = 0; x < W; x++) {
      const v = vnoise(x / 26, y / 2.6, 34);
      if (y < 30 && v > 0.76) put(x, y, MIST);
      else if (y >= 30 && v > 0.73 && hash(x >> 2, y, 35) < 0.85) put(x, y, CLOUD);
    }
    if (step < 3) return;
    // 3: far range, lighter and bluer, shadows reuse the sky
    range(makePeaks(41, -20, 290, 34, 60, 76, 0.5, 0.85), 106, MIST, SKY);
    if (step >= 5) { // 5: near clouds among the mountains, drifting
      const drift = t * 1.6;
      for (const [cx, cy, w, s] of [[30, 54, 26, 51], [118, 48, 34, 52], [205, 56, 22, 53], [292, 50, 28, 54]]) {
        let x = ((cx + drift) % (W + 70)) - 35;
        cloud(x, cy, w, s);
      }
    }
    if (step < 4) return;
    // 4: near forested range, darker and bluer than the grass, haze band at its foot
    range(makePeaks(71, -30, 300, 46, 80, 92, 0.28, 0.45), 108, LEAF, PINE, { bumps: true, seed: 72, lit: SAGE });
    for (let y = 97; y < 110; y++) {
      const p = (y - 97) / 12;
      let x = Math.floor(hash(y, 0, 81) * 8) - 8;
      while (x < W) {
        const len = 4 + Math.floor(hash(x, y, 82) * 12);
        if (hash(x, y, 83) < p * 0.95) for (let i = 0; i < len; i++) put(x + i, y, MIST);
        x += len + Math.floor(hash(x, y, 84) * 4);
      }
    }
    for (let y = 106; y < 109; y++) for (let x = 0; x < W; x++) if (hash(x, y, 85) < 0.85) put(x, y, MIST);
    blendEdge(110, MIST, SAGE, 3, 86);
    if (step < 6) return;
    // 6: valley texture. Farther planes: no blades. Nearer: 1-2px clusters, then blades and a darker shade.
    for (let y = 110; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 91);
      if (y < 126) { if (h < 0.05) put(x, y, MIST); continue; }
      if (y < 150) {
        if (h < 0.07) { put(x, y, vnoise(x / 9, y / 5, 92) > 0.5 ? SAGE : PINE); if (y > 140 && h < 0.05) put(x, y - 1, PINE); }
        continue;
      }
      const v = vnoise(x / 8, y / 5, 93);
      if (h < 0.13 && (v > 0.58 || v < 0.36)) { const c = v > 0.55 ? SAGE : PINE; put(x, y, c); put(x, y - 1, c); if (h < 0.05) put(x, y - 2, c); }
    }
    // distant trees reuse the near greens: hedgerows of small clumps across the valley planes
    for (let i = 0; i < 46; i++) {
      const bx = hash(i, 0, 95) * W, by = 112 + hash(i, 1, 95) * 26, r = 1.5 + hash(i, 2, 95) * 2.2 + (by - 112) / 16;
      for (let y = Math.floor(by - r); y <= by; y++) for (let x = Math.floor(bx - r); x <= bx + r; x++) {
        const dx = x + 0.5 - bx, dy = y + 0.5 - by;
        if (dx * dx + dy * dy > r * r) continue;
        put(x, y, dx + dy < -r * 0.6 ? SAGE : dx > r * 0.35 || dy > -0.5 ? PINE : LEAF);
      }
    }
  }

  function island(step, t, fall = true) {
    // walls, strata, rocky underside
    for (let x = 0; x < W; x++) {
      if (YB[x] < 0) continue;
      const own = HEX[face[YB[x] * W + x]];
      const lit = x + 0.5 < own.x;
      const crease = Math.abs(x + 0.5 - own.x) < 0.6 || (x > 0 && YB[x - 1] >= 0 && face[YB[x - 1] * W + x - 1] !== face[YB[x] * W + x]);
      const drip = hash(x, 0, 101) < 0.4 ? 1 + Math.floor(hash(x, 1, 101) * 3) : 0;
      const strata = Math.floor(vnoise(x / 9, 0, 102) * 3);
      for (let y = YB[x] + 1; y <= CUT[x]; y++) {
        const d = y - YB[x];
        let c;
        if (step < 8) c = d <= 1 ? (lit ? GRASS : LEAF) : d <= T ? (lit ? SOIL : BARK) : STONE;
        else if (d <= 1 + drip) c = lit ? (d === 1 && hash(x, y, 103) < 0.4 ? LIME : GRASS) : LEAF;
        else if (d <= 4) c = BARK;
        else if (d <= T) {
          c = lit ? SOIL : (hash(x, y, 104) < 0.5 ? SOIL : BARK);
          if ((d + strata) % 4 === 0 && hash(x >> 1, y, 105) > 0.25) c = lit ? CLAY : BARK;
          if (hash(x >> 1, y, 106) < 0.05) c = lit ? PALE : STONE;
          if (crease) c = BARK;
        } else {
          const v = vnoise(x / 6, y / 4, 107), bottom = CUT[x] - y;
          c = STONE;
          if (lit && v > 0.66) c = PALE;
          if (!lit && v < 0.34) c = DEEP;
          if (v > 0.475 && v < 0.5 && hash(x, y, 110) < 0.7) c = DEEP;   // cracks between rock plates
          if (d === T + 1) c = BARK;
          if (bottom < 2 || (bottom < 4 && hash(x, y, 108) < 0.5)) c = DEEP;
          if (vnoise(x / 7, y / 4, 109) > 0.78 && bottom > 3) c = lit ? SOIL : BARK;
        }
        put(x, y, c);
      }
    }
    if (step < 8) return;
    if (fall && (ONLY < 0 || ONLY === 2)) waterfall(t);
    // hanging vines and roots
    for (let x = 0; x < W; x++) {
      if (YB[x] < 0 || (x >= FALL[0] - 2 && x <= FALL[1] + 3)) continue;
      const h = hash(x, 0, 111);
      if (h < 0.09) {
        const len = 6 + Math.floor(hash(x, 1, 111) * (CUT[x] - YB[x] + 4));
        const lit = x + 0.5 < HEX[face[YB[x] * W + x]].x;
        for (let i = 2; i < len; i++) {
          const vx = x + Math.round(Math.sin(i * 0.45 + x) * 0.7), vy = YB[x] + i;
          put(vx, vy, lit ? LEAF : PINE);
          if (i % 3 === 0) put(vx + (i % 6 ? -1 : 1), vy, lit ? GRASS : LEAF);
        }
        put(x, YB[x] + len, lit ? LIME : GRASS);
      } else if (h > 0.95 && CUT[x] - YB[x] > T + 6) {
        const len = 3 + Math.floor(hash(x, 2, 111) * 7);
        for (let i = 0; i < len; i++) put(x + (i % 4 === 3 ? 1 : 0), CUT[x] + 1 + i, BARK);
      }
    }
  }

  function ground(step, t, L = { tex: true, rims: true, feat: true }) {
    // flat tops first
    for (let i = 0; i < W * H; i++) if (face[i] >= 0 && (ONLY < 0 || face[i] === ONLY)) buf[i] = GRASS;
    if (step < 8) return;
    if (L.tex) {
    // grass streaks: 1px vertical, scaled by row. Front row: 3-4px blades. Back row: 1-2px clusters.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = faceAt(x, y);
      if (f < 0) continue;
      const h = HEX[f];
      const u = (x - h.x) / HW, v = (y - h.y) / 11;
      const light = -0.35 * u - 0.45 * v;
      const P = vnoise(x / 9, y / 5, 121) + light * 0.35 + TONE[f];
      const r = hash(x, y, 122);
      const strong = P > 0.6 || P < 0.4;
      if (r > (h.front ? 0.17 : 0.13) * (strong ? 1 : 0.25)) continue;
      const c = P > 0.55 ? LIME : P < 0.45 ? LEAF : null;
      if (c === null) continue;
      const len = h.front ? 3 + (r < 0.05 ? 1 : 0) : 1 + (r < 0.06 ? 1 : 0);
      for (let i = 0; i < len; i++) if (faceAt(x, y - i) === f) put(x, y - i, i === len - 1 && c === LIME && h.front && P > 0.8 ? GLOW : c);
    }
    }
    if (L.rims) {
    // rims and seams: lit top-left lips, a dark groove where two tiles meet with a lit bevel on the far side
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = faceAt(x, y);
      if (f < 0) continue;
      const up = faceAt(x, y - 1), dn = faceAt(x, y + 1), rt = faceAt(x + 1, y), lf = faceAt(x - 1, y);
      if (up < 0) put(x, y, x + 0.5 < HEX[f].x ? LIME : GRASS);
      if ((dn >= 0 && dn !== f) || (rt >= 0 && rt !== f)) put(x, y, hash(x, y, 123) < 0.12 ? LEAF : PINE);
      else if ((up >= 0 && up !== f) || (lf >= 0 && lf !== f)) put(x, y, hash(x, y, 124) < 0.2 ? GRASS : LIME);
    }
    }
    if (!L.feat) return;
    // path
    for (let y = 60; y < H; y++) for (let x = 100; x < 160; x++) {
      if (faceAt(x, y) < 0) continue;
      const { d, w } = pathDist(x, y);
      const e = d - w + (hash(x, y, 131) - 0.5) * 0.7;
      if (e > 0) continue;
      let c = w > 2.2 && e < -1.6 ? CLAY : SOIL;
      const side = x + 0.5 - (PATH.reduce((a, p) => (Math.abs(p[1] - y) < Math.abs(a[1] - y) ? p : a))[0]);
      if (e > -1) c = side < 0 ? SOIL : BARK;
      else if (hash(x, y, 132) < 0.07) c = w > 2.5 ? PALE : SOIL;
      put(x, y, c);
    }
    // pond: dark far bank, tree reflections, sky body, light streaks, sparkles
    for (let y = 100; y < 140; y++) for (let x = 36; x < 90; x++) {
      if (!inPond(x, y) || faceAt(x, y) < 0) continue;
      const above = inPond(x, y - 1), above2 = inPond(x, y - 2), above3 = inPond(x, y - 3);
      let c = SKY;
      if (!above) c = BARK;
      else if (!above2) c = PINE;
      else if (!above3 && hash(x, y, 141) < 0.6) c = PINE;
      else {
        if (hash(x >> 2, y, 142) < 0.22 && y % 2 === 0) c = MIST;
        if (hash(Math.floor((x + t * 2) / 2), y, 143 + Math.floor(t * 2) % 3) < 0.04) c = CLOUD;
        if (y > 124 && (x + Math.floor(t * 6) + y * 3) % 7 === 0) c = MIST; // ripples running down the channel
      }
      put(x, y, c);
      if (!inPond(x, y + 1) && faceAt(x, y + 1) >= 0) put(x, y + 1, hash(x, y, 144) < 0.5 ? CLAY : SOIL);
    }
  }

  function props(step, t, P = { main: true, detail: true }) {
    const list = [];
    let tile = 0, kind = 'main';
    const add = (y, fn) => list.push({ y, fn, tile, kind });
    const on = (i, k) => { tile = i; kind = k; };
    on(0, 'main');
    // A Grove: a cluster of broadleaf trees of different sizes under one shaded floor, with undergrowth and a log
    add(60, () => shadowEllipse(98, 94, 24, 8));
    add(78, () => oak(96, 78, 0.7, 23));
    add(86, () => oak(114, 86, 0.82, 19));
    add(89, () => oak(76, 89, 0.62, 31));
    add(97, () => oak(90, 97, 1.0, 7));
    add(103, () => oak(117, 103, 0.5, 37));
    add(104, () => outlined(() => canopy(74, 101, 7, [[-3, 1, 4], [3, 1, 4], [0, -2, 4.5], [5, -1, 3]], 182)));
    add(102, () => outlined(() => { // fallen log with a cut end
      for (let x = 100; x <= 108; x++) { put(x, 100, CLAY); put(x, 101, SOIL); put(x, 102, BARK); }
      put(109, 100, CLAY); put(109, 101, GLOW); put(109, 102, CLAY); put(110, 101, CLAY);
      put(103, 99, GRASS); put(106, 99, LIME);
    }, BARK, DEEP));
    on(0, 'detail');
    add(105, () => { fern(84, 105, 11, 0.8); tuft(124, 96, false); });
    on(1, 'main');
    // B Pines: a stand of conifers on a needle-dark floor, ferns at their roots
    add(60, () => shadowEllipse(162, 92, 26, 9));
    add(76, () => pine(160, 76, 24, 8));
    add(80, () => pine(146, 80, 26, 3));
    add(83, () => pine(181, 83, 30, 4));
    add(92, () => pine(167, 92, 37, 5));
    add(99, () => pine(150, 99, 21, 9));
    add(101, () => pine(183, 101, 18, 12));
    on(1, 'detail');
    add(102, () => { fern(160, 102, 1); fern(140, 93, 3, 0.8); fern(175, 97, 2, 0.8); });
    on(2, 'main');
    // C Pond: lily pads, cattails, bank stones
    for (const [px, py, bloom] of [[54, 119, true], [67, 121, false], [61, 116, false]]) add(py - 20, () => outlined(() => {
      for (let y = py - 2; y <= py + 2; y++) for (let x = px - 4; x <= px + 4; x++) {
        const e = ((x + 0.5 - px) / 3.4) ** 2 + ((y + 0.5 - py) / 1.6) ** 2;
        if (e > 1) continue;
        put(x, y, x - px + (y - py) * 2 < -1 ? GRASS : LEAF);
      }
      put(px + 2, py - 1, SKY); put(px + 2, py, SKY); // the notch
      if (bloom) { put(px - 1, py - 1, ROSE); put(px, py - 2, CLOUD); put(px + 1, py - 1, ROSE); put(px, py - 1, GLOW); }
    }, SKY, PINE));
    add(118, () => { cattail(78, 117, 10); cattail(81, 119, 8); cattail(84, 120, 11); cattail(75, 121, 7); });
    add(127, () => { boulder(70, 128, 3, 2, 191); boulder(44, 123, 2.5, 1.8, 192); });
    on(2, 'detail');
    add(128, () => { tuft(72, 132, true); tuft(40, 119, true); fern(88, 125, 4, 0.8); flower(50, 112, 2, true); flower(85, 131, 1, true); flower(59, 131, 0, true); });
    on(3, 'detail');
    // D Meadow: single-kind clumps of poppies, daisies, buttercups and lupines, tall grass, butterflies
    const flowers = [];
    const clumps = [[110, 110, 1], [118, 128, 0], [140, 112, 0], [145, 126, 1], [114, 120, 2], [137, 133, 2], [149, 118, 3], [108, 128, 3], [122, 104, 2], [134, 104, 1]];
    clumps.forEach(([cx, cy, kind], i) => {
      for (let j = 0; j < 11; j++) {
        const fx = Math.round(cx + (hash(i, j + 2, 152) - 0.5) * 10), fy = Math.round(cy + (hash(i, j + 2, 153) - 0.5) * 5);
        if (faceAt(fx, fy) === 3 && faceAt(fx, fy + 3) === 3 && pathDist(fx, fy).d > pathDist(fx, fy).w + 1.5 &&
            !flowers.some(([ax, ay]) => Math.abs(ax - fx) < 3 && Math.abs(ay - fy) < 2)) flowers.push([fx, fy, kind]);
      }
    });
    for (const [fx, fy, k] of flowers) add(fy, () => flower(fx, fy, k, true));
    for (const [tx, ty] of [[112, 134], [143, 129], [126, 112], [151, 122], [104, 118]]) add(ty, () => tuft(tx, ty, true));
    // A and B: small flowers at the farther scale, kept out of the shaded floors
    for (let i = 0; i < 22; i++) {
      const fx = Math.round(70 + hash(i, 0, 161) * 118), fy = Math.round(68 + hash(i, 1, 161) * 38), f = face[fy * W + fx];
      if ((f === 0 || f === 1) && pathDist(fx, fy).d > 3) { on(f, 'detail'); add(fy, () => { if (at(fx, fy) === GRASS || at(fx, fy) === LIME) flower(fx, fy, i % 3, false); }); }
    }
    on(4, 'main');
    // E Rocks: angular mossy boulders, a berry bush, mushrooms, pebbles
    add(127, () => boulder(199, 127, 11, 7, 171));
    add(115, () => boulder(184, 115, 7, 5, 172));
    add(108, () => boulder(207, 108, 5, 3.5, 173));
    add(131, () => boulder(214, 134, 3, 2, 175));
    add(130, () => berryBush(175, 131, 174));
    on(4, 'detail');
    add(134, () => { mushroom(206, 136); mushroom(210, 133, false); mushroom(188, 131, false); });
    add(121, () => { flower(170, 118, 1, true); flower(216, 118, 0, true); tuft(192, 103, true); tuft(165, 124, true); });
    for (const [px, py] of [[194, 131], [205, 119], [179, 120], [220, 125]]) add(py, () => { put(px, py, PALE); put(px + 1, py, STONE); put(px + 1, py + 1, DEEP); });
    list.filter((p) => (ONLY < 0 || p.tile === ONLY) && P[p.kind]).sort((a, b) => a.y - b.y).forEach((p) => p.fn());

    if (step < 10 || ONLY >= 0) return;
    // life: butterflies over the meadow, birds over the far range
    for (const [ph, wing, ax] of [[0, CLOUD, 0], [2.1, GLOW, 1]]) {
      const bx = 128 + Math.sin(t * 0.6 + ph) * 16 + ax * 6, by = 104 + Math.sin(t * 1.3 + ph) * 5;
      const open = Math.floor(t * 7 + ph * 3) % 2 === 0;
      put(bx, by, BARK);
      if (open) { put(bx - 1, by, wing); put(bx + 1, by, wing); put(bx - 1, by - 1, wing); put(bx + 1, by - 1, wing); }
      else { put(bx, by - 1, wing); put(bx - 1, by - 1, wing); }
    }
    for (const [ox, oy, ph] of [[0, 20, 0], [9, 25, 1.7]]) {
      const bx = ((ox + 30 + t * 5) % (W + 30)) - 15, by = oy + Math.sin(t * 0.8 + ph) * 2;
      const up = Math.floor(t * 4 + ph) % 2 === 0;
      put(bx, by, STONE); put(bx - 1, by - (up ? 1 : 0), STONE); put(bx + 1, by - (up ? 1 : 0), STONE);
      if (up) { put(bx - 2, by - 1, STONE); put(bx + 2, by - 1, STONE); }
    }
  }

  // Build stages for one tile on its own, transparent (255) around it.
  const TILE_STAGES = ['Tile shape', 'Sides and rims', 'Grass texture', 'Ground and shadows', 'Props block-in', 'Props shaded', 'Details', 'In the scene'];
  function renderTile(i, stage, t = 0) {
    if (stage >= 8) { render(STEPS.length, t); return buf; }
    ONLY = i; YB = TILE[i].yb; CUT = TILE[i].ct;
    buf.fill(255); outMark.fill(0);
    island(stage >= 2 ? 8 : 7, t, stage >= 4);
    ground(stage >= 2 ? 8 : 7, t, { tex: stage >= 3, rims: stage >= 2, feat: stage >= 4 });
    if (stage === 4) { SHADOW_ONLY = true; props(9, t, { main: true, detail: false }); SHADOW_ONLY = false; }
    if (stage >= 5) { REMAP = stage === 5 ? BLOCK : null; props(9, t, { main: true, detail: stage >= 7 }); REMAP = null; }
    ONLY = -1; YB = ybot; CUT = cut;
    return buf;
  }
  // Pixel box around a tile for the build views.
  const tileBox = (i) => ({ x: HEX[i].x - 40, y: HEX[i].y - 50, w: 80, h: 112 });
  const tileAt = (x, y) => (inb(x, y) ? face[y * W + x] : -1);

  function render(step = STEPS.length, t = 0) {
    buf.fill(SKY); outMark.fill(0);
    background(step, t);
    if (step >= 7) { island(step, t); ground(step, t); }
    if (step >= 9) props(step, t);
    return buf;
  }

  return { W, H, PAL, NAMES, HEX, STEPS, TILE_STAGES, K, render, renderTile, tileBox, tileAt, outMark };
}
