// Grove tile in 15 pixel-art styles. The Verdant Isle renderer paints the tile once in its 16 role colors
// (deep, pine, leaf, grass, ...); each style then re-reads those roles under its own hardware or genre rules:
// palette, how roles map onto it, outline treatment, pixel size, dithering and color-cell limits.
// buildGroveStyles(S) returns [{ ...style, image: { w, h, rgb } }] where rgb is an array of [r,g,b] or null (background).
function buildGroveStyles(S) {
  const [DEEP, PINE, LEAF, GRASS, LIME, GLOW, SAGE, BARK, SOIL, CLAY, STONE, PALE, SKY, MIST, CLOUD, ROSE] = S.PAL.map((_, i) => i);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const dist = ([r1, g1, b1], [r2, g2, b2]) => { const rm = (r1 + r2) / 2; return (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2; };
  const nearest = (c, pal) => pal.reduce((best, p) => (dist(c, p) < dist(c, best) ? p : best), pal[0]);
  const BASE = S.PAL.map(hex);
  const ROLE_LUM = BASE.map(lum), LMIN = Math.min(...ROLE_LUM), LMAX = Math.max(...ROLE_LUM);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // How a style turns roles into its own colors.
  const byNearest = (pal) => BASE.map((c) => nearest(c, pal.map(hex)));
  const byLum = (pal, bias = 0) => BASE.map((c) => { // pal ordered dark to light
    const t = (lum(c) - LMIN) / (LMAX - LMIN);
    return hex(pal[Math.max(0, Math.min(pal.length - 1, Math.round(t * (pal.length - 1) + bias)))]);
  });
  const byRoles = (pal) => pal.map((c) => (Array.isArray(c) ? c.map(hex) : hex(c))); // [a, b] means a checker of two colors
  const byShade = (pal, levels) => levels.map((l) => (Array.isArray(l) ? l.map((k) => hex(pal[k])) : hex(pal[l])));
  //               deep pine leaf grass lime glow sage bark soil clay stone pale sky mist cloud rose
  const SHADE4 = [0, 0, 1, 2, 3, 3, 2, 0, 1, 2, 1, 2, 2, 3, 3, 2];

  const STYLES = [
    { id: 'verdant', name: 'Verdant 16', era: 'This project', bg: '#a9d5f0',
      rules: ['16 colors', 'hue-shifted ramps', 'soft + hard outline'],
      blurb: 'The house style from Verdant Isle: teal shadows, warm lime highlights, a soft outline on lit edges and a hard one in shade.',
      map: byRoles(S.PAL) },
    { id: 'snes', name: '16-bit JRPG', era: 'SNES, early 90s', bg: '#78b8f0', silhouette: '#1b1a2e', hard: '#1b1a2e',
      rules: ['16 colors per scene', 'saturated, warm light', 'dark plum outline'],
      blurb: 'Richer saturation and warmer light, with a near-black plum outline wrapped around the whole tile the way 16-bit sprites sat on busy maps.',
      map: byRoles(['#1b2238', '#1f4a3a', '#2a7a3c', '#4fae3a', '#a6d83a', '#fff07a', '#88c0a0', '#4a2a22', '#8a5432', '#c98a4a', '#6a7088', '#b0bccc', '#5aa0e8', '#a8dcf8', '#ffffff', '#f05080']) },
    { id: 'gameboy', name: 'Game Boy', era: 'DMG-01, 1989', bg: '#9bbc0f', silhouette: '#0f380f', hard: '#0f380f', soft: '#306230',
      rules: ['4 greens', 'fits the 160×144 screen', 'value only'],
      blurb: 'Four shades of pea green. Every role collapses to one of four values, so the grove reads only through light, shadow and the dark outline.',
      map: byShade(['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], SHADE4) },
    { id: 'virtualboy', name: 'Virtual Boy', era: 'Nintendo, 1995', bg: '#000000', hard: '#000000', soft: '#550000',
      rules: ['4 reds on black', 'no hue at all', 'black ground'],
      blurb: 'Red LEDs on black. Only luminance survives, so the bright crowns glow and the shaded floor sinks into the dark.',
      map: byShade(['#2a0000', '#6a0000', '#b00000', '#ff2a2a'], SHADE4) },
    { id: 'nes', name: 'NES', era: 'Famicom, 1983', bg: '#3cbcfc', hard: '#000000', soft: '#000000', silhouette: '#000000',
      rules: ['fixed 54-color hardware palette', 'black outlines', 'flat fills'],
      blurb: 'Every role snaps to the nearest color in the NES hardware palette, and every outline goes pure black, like Zelda-era overworld tiles.',
      map: byNearest(['#000000', '#fcfcfc', '#bcbcbc', '#7c7c7c', '#00a800', '#00b800', '#58d854', '#b8f818', '#d8f878', '#005800', '#007800', '#ac7c00', '#503000', '#f8b800', '#fca044', '#e40058', '#f878f8', '#3cbcfc', '#0078f8', '#a4e4fc', '#881400', '#c84c0c']) },
    { id: 'pico8', name: 'PICO-8', era: 'Fantasy console, 2015', bg: '#29adff', hard: '#1d2b53', soft: '#1d2b53', silhouette: '#1d2b53',
      rules: ['fixed 16 colors', 'only two greens', 'navy outline'],
      blurb: 'The PICO-8 palette has exactly two greens, so each crown is dark green in shade and bright green in light, with yellow glints and navy outlines.',
      map: byRoles(['#1d2b53', '#008751', '#008751', ['#00e436', '#008751'], '#00e436', '#ffec27', '#83769c', '#5f574f', '#ab5236', '#ffccaa', '#5f574f', '#c2c3c7', '#29adff', '#c2c3c7', '#fff1e8', '#ff77a8']) },
    { id: 'onebit', name: '1-bit Mac', era: 'Macintosh, 1984', bg: '#ffffff', dither: true, hard: '#000000', silhouette: '#000000',
      rules: ['black and white', '4×4 ordered dither', 'black outlines'],
      blurb: 'Two colors only. Each role gets one of five gray levels, and a Bayer dither turns each level into its own fixed black-and-white pattern.',
      //                deep pine leaf grass lime glow sage bark soil clay stone pale sky mist cloud rose
      map: byShade(['#000000', '#3c3c3c', '#7a7a7a', '#b4b4b4', '#ffffff'], [0, 0, 1, 2, 3, 4, 2, 0, 1, 3, 1, 3, 2, 3, 4, 2]) },
    { id: 'cga', name: 'CGA', era: 'IBM PC, 1981', bg: '#000000', hard: '#000000', soft: '#000000',
      rules: ['black, cyan, magenta, white', 'checker dither for mid tones', 'no green exists'],
      blurb: 'The infamous CGA palette has no green. Foliage goes cyan, shade goes black, bark turns magenta, and checker dithers fake the tones in between, like early PC adventure games.',
      map: (() => { const K = '#000000', C = '#55ffff', M = '#ff55ff', Wt = '#ffffff';
        return byRoles([K, K, [C, K], C, [C, Wt], Wt, C, [M, K], M, [M, Wt], K, [Wt, K], C, [C, Wt], Wt, M]); })() },
    { id: 'c64', name: 'Commodore 64', era: 'C64 multicolor, 1982', bg: '#6c5eb5', wide: true, hard: '#000000',
      rules: ['fixed 16 colors', 'double-wide pixels', 'muted, earthy'],
      blurb: 'Multicolor mode doubles every pixel horizontally, and the muted C64 palette turns the greens olive and the sky lavender.',
      map: byNearest(['#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f', '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595']) },
    { id: 'zx', name: 'ZX Spectrum', era: 'Sinclair, 1982', bg: '#000000', clash: 8, hard: '#000000', soft: '#000000',
      rules: ['15 bright colors', '2 colors per 8×8 cell', 'attribute clash'],
      blurb: 'Each 8×8 cell can hold only two colors, so the blocky color clash shows up wherever a crown meets the floor or the bark.',
      map: byRoles(['#000000', '#000000', ['#00d800', '#000000'], '#00d800', '#00ff00', '#ffff00', '#00d8d8', '#000000', '#d80000', '#d8d800', '#0000d8', '#d8d8d8', '#00d8d8', '#00ffff', '#ffffff', '#ff00ff']) },
    { id: 'sweetie', name: 'Sweetie 16', era: 'Modern indie', bg: '#94b0c2', hard: '#1a1c2c', silhouette: '#1a1c2c',
      rules: ['Sweetie 16 palette', 'teal shade, mint light', 'ink outline'],
      blurb: 'A favorite modern indie palette: the crowns split between deep teal and mint, the bark turns warm orange, and a dark ink line wraps it all.',
      map: byNearest(['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57']) },
    { id: 'pastel', name: 'Cozy Pastel', era: 'Farming sim', bg: '#cfe9fb', hard: '#6a7a8c', soft: '#8fb8a6', silhouette: '#6a7a8c',
      rules: ['raised values', 'no true darks', 'soft slate outline'],
      blurb: 'Every value is lifted and the darkest tone is a soft slate instead of black, for the gentle look of cozy farming games.',
      map: byRoles(['#5e7a8a', '#6fa58f', '#8cc49a', '#a8dba0', '#d2efad', '#fff6c2', '#bfe0d0', '#8a6a6a', '#b8907a', '#e0b892', '#9ea8c4', '#d8dfec', '#9ccbf0', '#cfe9fb', '#fffdf6', '#f6a6b8']) },
    { id: 'night', name: 'Moonlit', era: 'Night palette swap', bg: '#0b1530', silhouette: '#04060f', fireflies: true,
      rules: ['blue-shifted ramps', 'cool moon rim light', 'fireflies'],
      blurb: 'The same ramps swapped for night: blues replace greens, the lit edges become cool moonlight, and fireflies drift between the trunks.',
      map: byRoles(['#070b1c', '#0f1f33', '#173049', '#22465e', '#4a7a94', '#c8e0f0', '#2a4058', '#120e1a', '#20202e', '#3a3a52', '#2c3450', '#5a6a8a', '#1a2a4a', '#30486a', '#a8c0e0', '#8a5a9a']) },
    { id: 'neon', name: 'Neon Wire', era: 'Synthwave', bg: '#0d0221', hard: '#05d9e8', soft: '#ff2a6d', silhouette: '#05d9e8',
      rules: ['dark violet fills', 'cyan and magenta outlines', 'glowing highlights'],
      blurb: 'Fills drop to violet darkness, and the outlines light up cyan on the shade side and magenta on the lit side.',
      map: byRoles(['#0d0221', '#1a0b3b', '#261447', '#2e1a5c', '#05d9e8', '#d1f7ff', '#241040', '#140626', '#1e0a33', '#2b1250', '#1a0f3a', '#3a2a6a', '#05d9e8', '#0b6e8a', '#d1f7ff', '#ff2a6d']) },
    { id: 'sepia', name: 'Sepia Storybook', era: 'Old print', bg: '#ead3a8', silhouette: '#2b1d14', hard: '#2b1d14',
      rules: ['8 browns', 'value ramp only', 'ink outline'],
      blurb: 'One ramp of eight browns, like a faded storybook plate. With no hue, the shapes and shading have to carry the grove.',
      map: byLum(['#2b1d14', '#4a3322', '#6b4c31', '#8f6a45', '#b38d5f', '#d1af80', '#ead3a8', '#f7ecd2'], 0.1) },
  ];

  function paint(style) {
    const buf = S.renderTile(0, 7, 3.3), mark = S.outMark, box = S.tileBox(0);
    let w = box.w, h = box.h;
    let img = new Array(w * h).fill(null);
    const hard = style.hard && hex(style.hard), soft = style.soft && hex(style.soft);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = box.x + x, sy = box.y + y;
      if (sx < 0 || sy < 0 || sx >= S.W || sy >= S.H) continue;
      const i = sy * S.W + sx, v = buf[i];
      if (v === 255) continue;
      let c = style.map[v];
      if (Array.isArray(c[0])) c = c[(x + y) % 2];
      if (mark[i] === 2 && hard) c = hard;
      else if (mark[i] === 1 && soft) c = soft;
      img[y * w + x] = c;
    }
    if (style.silhouette) { // wrap the whole tile in one outline
      const sc = hex(style.silhouette), out = img.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (img[y * w + x]) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && img[yy * w + xx];
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out[y * w + x] = sc;
      }
      img = out;
    }
    if (style.down || style.wide) { // fewer, bigger pixels: the most common color in each block, darker wins ties
      const fx = 2, fy = style.wide ? 1 : 2, nw = Math.ceil(w / fx), nh = Math.ceil(h / fy), out = new Array(nw * nh).fill(null);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        const count = new Map();
        for (let j = 0; j < fy; j++) for (let k = 0; k < fx; k++) {
          const c = img[(y * fy + j) * w + x * fx + k];
          if (c === undefined) continue;
          const key = c ? c.join() : 'bg';
          count.set(key, { c, n: (count.get(key)?.n || 0) + 1 });
        }
        let best = null;
        for (const e of count.values()) if (!best || e.n > best.n || (e.n === best.n && e.c && (!best.c || lum(e.c) < lum(best.c)))) best = e;
        out[y * nw + x] = best ? best.c : null;
      }
      img = out; w = nw; h = nh;
    }
    if (style.dither) { // 1-bit: gray level against a 4x4 Bayer threshold
      const K = [0, 0, 0], Wt = [255, 255, 255];
      img = img.map((c, i) => {
        if (!c) return null;
        if (c[0] === 0 && c[1] === 0 && c[2] === 0) return K;
        const t = (BAYER[((i / w | 0) % 4) * 4 + (i % w) % 4] + 0.5) / 16;
        return Math.min(1, lum(c) * 1.15) > t ? Wt : K;
      });
    }
    if (style.clash) { // attribute clash: two colors per cell
      const n = style.clash;
      for (let cy = 0; cy < h; cy += n) for (let cx = 0; cx < w; cx += n) {
        const count = new Map();
        for (let y = cy; y < Math.min(h, cy + n); y++) for (let x = cx; x < Math.min(w, cx + n); x++) {
          const c = img[y * w + x]; if (!c) continue;
          const key = c.join(); count.set(key, { c, n: (count.get(key)?.n || 0) + 1 });
        }
        const two = [...count.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((e) => e.c);
        if (two.length < 2) continue;
        for (let y = cy; y < Math.min(h, cy + n); y++) for (let x = cx; x < Math.min(w, cx + n); x++) {
          const c = img[y * w + x]; if (c) img[y * w + x] = nearest(c, two);
        }
      }
    }
    if (style.fireflies) {
      const glow = hex('#f6f08a'), halo = hex('#5a6a3a');
      for (const [x, y] of [[12, 70], [30, 58], [55, 64], [66, 80], [22, 88], [44, 50], [60, 40], [8, 52]]) {
        if (x >= w || y >= h) continue;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (img[(y + dy) * w + x + dx] !== undefined && x + dx >= 0) img[(y + dy) * w + x + dx] = img[(y + dy) * w + x + dx] ? halo : img[(y + dy) * w + x + dx];
        img[y * w + x] = glow;
      }
    }
    return { w, h, rgb: img };
  }

  return STYLES.map((s) => { const image = paint(s); return { ...s, image, colors: new Set(image.rgb.filter(Boolean).map((c) => c.join())).size }; });
}
