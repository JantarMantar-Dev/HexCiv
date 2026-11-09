// HexCiv tile engine: flat-top 32x28 hex tiles that tessellate like The Clover Patch's Fantasy Hex Tiles
// (Tiled: hex, stagger X, 32x28, side 16, 24px column step, odd columns 14px lower). Each tile lives in a
// 32x48 cell: art may rise 16px above the face and a 3px side band shows below it.
// Style: "bright tiles" (3/4 view, colored borders, hand-drawn sprites). See docs/art-style.md for the rules.
// Nothing is random. Every sprite is drawn by hand below and every placement is listed.
function buildHexTiles() {
  const C = {
    ink: '#141d26', deep: '#1a3445', pine: '#23584c', leaf: '#2f7d46', grass: '#56a43c', lime: '#9bcb3e', glow: '#e6e773',
    sage: '#7fb39a', bark: '#3f2b31', soil: '#77513c', clay: '#b57f52', stone: '#5f6e8a', pale: '#a3b5c4',
    sky: '#5f9edd', mist: '#a9d5f0', cloud: '#f4f6ea', rose: '#e8587d',
    // biome ramps added for the expanded map
    sand0: '#f3dca0', sand1: '#e2bd78', snow1: '#dce7ee', snowsh: '#c3d3e0', olive: '#5d7d3a', olive2: '#45612f', murk: '#3f6662', murk2: '#2c4a4f',
    // ruin ramps: tilled loam, weathered dead wood, the rot, and dried marsh
    loam0: '#c08a5a', loam1: '#9a6844', ash: '#a39385', ash2: '#6e5d58',
    rot0: '#a58bbd', rot1: '#6c5580', rot2: '#46365a', rot3: '#2a1f37', dun0: '#c2ad73', dun1: '#97844f', dun2: '#6a5c3a', scum: '#9fae62',
  };
  const INSET = [8, 7, 7, 6, 5, 5, 4, 4, 3, 3, 2, 1, 1, 0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 7, 7, 8];
  const FW = 32, FH = 28, CW = 32, CH = 48, FY = 16, BAND = 3;
  const inFace = (x, y) => y >= 0 && y < FH && x >= INSET[y] && x < FW - INSET[y];
  const ring = (x, y) => inFace(x, y) && (!inFace(x - 1, y) || !inFace(x + 1, y) || !inFace(x, y - 1) || !inFace(x, y + 1));
  const margin = (x, y) => (inFace(x, y) ? Math.min(x - INSET[y], FW - 1 - INSET[y] - x, y, FH - 1 - y) : -1);

  class Cv {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
    set(x, y, c) { if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; this.px[y * this.w + x] = c; }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]; }
    // Draw a hand sprite, then outline exactly what it drew: `hard` on bottom/right, `soft` on top/left.
    sprite(x0, y0, rows, legend, soft, hard, clip) {
      const m = new Set();
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (legend[ch] && (!clip || clip(x0 + x, y0 + y))) { this.set(x0 + x, y0 + y, legend[ch]); m.add((y0 + y) * 1000 + x0 + x); } }));
      if (!hard) return;
      const marks = [];
      const at = (x, y) => m.has(y * 1000 + x);
      for (let y = y0 - 1; y <= y0 + rows.length; y++) for (let x = x0 - 1; x <= x0 + rows[0].length + 1; x++) {
        if (at(x, y) || (clip && !clip(x, y))) continue;
        if (at(x, y - 1) || at(x - 1, y)) marks.push([x, y, hard]);
        else if (at(x, y + 1) || at(x + 1, y)) marks.push([x, y, soft]);
      }
      marks.forEach(([x, y, c]) => this.set(x, y, c));
    }
  }

  // ---------- hand-drawn sprites (side view). H highlight, L light, M mid, D dark, T/B trunk lit/dark ----------
  // Each sprite has a base point (bx, by): the pixel that touches the ground.
  const SPR = {
    oak: { bx: 6, by: 13, rows: [
      '....LLL......',
      '..LLHHLM.....',
      '.LHHLLMMLL...',
      '.LLLLMMLHHLM.',
      'LLLMMMDLLLMMM',
      'LMMMMDMLMMMMD',
      '.MMMDDMMMMMDD',
      '.DMDDLLMMMDDD',
      '..DDLHHLMMDD.',
      '...DLLMMMDD..',
      '....DMMDDD...',
      '.....DDDD....',
      '......TB.....',
      '......TB.....'] },
    oakS: { bx: 4, by: 9, rows: [
      '...LLL...',
      '.LLHHLM..',
      'LLHLLMMM.',
      'LLLMMMMMD',
      'LMMMDMMDD',
      '.MMDLLMDD',
      '..DDMMDD.',
      '...DDDD..',
      '....TB...',
      '....TB...'] },
    pine: { bx: 4, by: 16, rows: [
      '....L....',
      '...LMD...',
      '...LMD...',
      '..LLMDD..',
      '..DDMDD..',
      '..LLMMD..',
      '.LLMMMDD.',
      '.DDDMDDD.',
      '.LLMMMMD.',
      'LLMMMMMDD',
      'DDDDMDDDD',
      '.LLMMMDD.',
      'LLMMMMMDD',
      'LMMMMMDDD',
      'DDDDDDDDD',
      '....B....',
      '....B....'] },
    bush: { bx: 3, by: 4, rows: [
      '.LHHL..',
      'LLLLMM.',
      'LLMMMMD',
      'MMMDMDD',
      '.DDDDD.'] },
    rock: { bx: 4, by: 6, rows: [
      '...LLL...',
      '.LLHLLM..',
      'LLHLLMMM.',
      'LLLLMMMMD',
      'LLMMMMMDD',
      '.MMMMMDDD',
      '..DDDDDD.'] },
    rockS: { bx: 2, by: 2, rows: ['.LLM.', 'LLMMD', '.MDD.'] },
    hill: { bx: 6, by: 6, rows: [
      '.....LLL.....',
      '...LLHHLLM...',
      '..LHHLLLLMM..',
      '.LLLLLLLMMMM.',
      'LLLLLLLMMMMMD',
      'LLLLLLMMMMMDD',
      'MMMMMMMMMDDDD'] },
    log: { bx: 3, by: 2, rows: ['TTTTTTH', 'BBBBBBH', '.DDDDD.'] },
    reed: { bx: 1, by: 5, rows: ['.T.', '.T.', 'LM.', 'LM.', '.MD', '.MD'] },
    flower: { bx: 1, by: 2, rows: ['.P.', 'PCP', '.DD'] },
    bud: { bx: 0, by: 1, rows: ['P.', 'DD'] },
    tuft: { bx: 1, by: 1, rows: ['L.L', 'L.L'] },
    mush: { bx: 1, by: 2, rows: ['PPP', 'PCP', '.C.'] },
    lily: { bx: 1, by: 1, rows: ['LLM', '.MM'] },
    cactus: { bx: 2, by: 6, rows: ['..LM..', '..LM..', 'L.LM.M', 'L.LM.M', 'LLLMMM', '..LM..', '..LM..'] },
    dune: { bx: 6, by: 3, rows: ['.....HHL.....', '...HHHHLLMM..', '.HHHHHHLLMMMM', 'HHHHHHHLMMMMM'] },
    ripple: { bx: 1, by: 1, rows: ['.LLL', 'L...'] },
    shell: { bx: 0, by: 0, rows: ['HL'] },
    stump: { bx: 2, by: 3, rows: ['.HHL.', 'HLCLM', 'TTTBB', 'TTBBB'] },
    stumpL: { bx: 3, by: 6, rows: [
      '.HHHHL.',
      'HLLCLLM',
      'HLCHCLM',
      'TLLLLMB',
      'TTTTBBB',
      'TTTBBBB',
      'TT.B.BB'] },
    snag: { bx: 4, by: 11, rows: [
      'B.......B.',
      '.B..B..B..',
      '.B..B.B...',
      '..B.TB....',
      'B..TB...B.',
      '.B.TB..B..',
      '..TTBBB...',
      '...TB.....',
      '...TB.....',
      '...TBB....',
      '..TTBB....',
      '.TTTBBB...'] },
    ruin: { bx: 6, by: 8, rows: [
      '...RR.........',
      '..RRrr........',
      '.RRrrrr...P...',
      'RRrrrrrrr.PS..',
      'PPPPPPPPPPPS.P',
      'PSSPKKPPSPPSPS',
      'PSSPKKPSKKPSSS',
      'PPPPKKPPKKPSS.',
      'SSSSKKSSSSSSS.'] },
    portal: { bx: 4, by: 7, rows: [
      'HHHHHHHHH',
      'BBBBBBBBB',
      'TBKKKKKTB',
      'TBKKKKKTB',
      'TBKKKKKTB',
      'TBKKKKKTB',
      'TBKKKKKTB',
      'TB.....TB'] },
    bubble: { bx: 1, by: 1, rows: ['.H.', 'HDH', '.H.'] },
    damWall: { bx: 9, by: 6, rows: [
      '.T...T...T...T...T.',
      'HHHHHHHHHHHHHHHHHHH',
      'TTTTTTTTTTTTTTTTTTT',
      'BBBBBBBBBBBBBBBBBBB',
      'HHHHHHHHHHHHHHHHHHH',
      'TTTTTTTTTTTTTTTTTTT',
      'SSPSSPSSPSSPSSPSSPS'] },
    deadTree: { bx: 3, by: 6, rows: ['B....B.', '.B..B..', '.B.BB.B', '..BBBB.', '...BB..', '...BB..', '..BBBB.'] },
    mtn: { bx: 10, by: 13, rows: [
      '.........W..........',
      '........WWw.........',
      '.......WWWww........',
      '......WWWWwwM.......',
      '.....LWWLWwMMM......',
      '....LLLWLLMwMMM.....',
      '....LLLLLLMMMMMD....',
      '...LLMLLLLMMMMDDD...',
      '...LLLLMLLLMMMMDD...',
      '..LLLLLLLLLMMMMDDDD.',
      '..LLMLLLLLLMMDMMDDD.',
      '.LLLLLLLLLLLMMMMDDDD',
      '.LLLLLMLLLLLMMMMMDDD',
      'LLLLLLLLLLLLMMMMMDDD'] },
    mtnS: { bx: 6, by: 8, rows: [
      '......W......',
      '.....WWw.....',
      '....WWwwM....',
      '...LWLwMMM...',
      '..LLLLMMMMD..',
      '..LLMLLMMDD..',
      '.LLLLLLMMMDD.',
      '.LLLLLLMMMMDD',
      'LLLLLLLMMMMDD'] },
  };
  const LEG = {
    oak: { H: C.lime, L: C.grass, M: C.leaf, D: C.pine, T: C.soil, B: C.bark },
    pine: { L: C.leaf, M: C.pine, D: C.deep, B: C.bark },
    bush: { H: C.lime, L: C.grass, M: C.leaf, D: C.pine },
    rock: { H: C.cloud, L: C.pale, M: C.stone, D: C.deep },
    hill: { H: C.glow, L: C.lime, M: C.grass, D: C.leaf },
    log: { T: C.soil, B: C.bark, H: C.clay, M: C.soil, D: C.pine },
    reed: { T: C.bark, M: C.leaf, L: C.grass, D: C.pine },
    tuft: { L: C.lime },
    lily: { L: C.lime, M: C.grass, D: C.leaf },
    flower: (p) => ({ P: p, C: C.glow, D: C.leaf }),
    mush: { P: C.rose, C: C.cloud },
    cactus: { L: C.grass, M: C.leaf },
    dune: { H: C.sand0, L: C.sand1, M: C.clay },
    drift: { H: C.cloud, L: C.snow1, M: C.snowsh },
    shell: { H: C.cloud, L: C.pale },
    deadTree: { B: C.bark },
    stump: { H: C.sand0, L: C.sand1, C: C.clay, M: C.clay, T: C.soil, B: C.bark },
    snag: { T: C.ash, B: C.ash2 },
    deadLog: { T: C.ash, B: C.ash2, H: C.sand1, D: C.bark },
    deadReed: { T: C.clay, M: C.sand1, L: C.sand0, D: C.soil },
    ruin: { R: C.clay, r: C.soil, S: C.stone, P: C.pale, K: C.ink },
    portal: { H: C.clay, B: C.bark, T: C.soil, K: C.ink },
    bubble: { H: C.rot0, D: C.rot2 },
    damWall: { H: C.clay, T: C.soil, B: C.bark, S: C.stone, P: C.pale },
    pebble: { H: C.cloud, L: C.pale, M: C.stone, D: C.stone },
    rotTuft: { L: C.rot1 },
    snowPine: { L: C.cloud, M: C.pine, D: C.deep, B: C.bark },
    snowRock: { H: C.cloud, L: C.pale, M: C.stone, D: C.deep },
    driftwood: { T: C.clay, B: C.soil, H: C.sand0, M: C.clay, D: C.sand1 },
    rockD: { H: C.sand0, L: C.clay, M: C.soil, D: C.bark },
    mtn: { W: C.cloud, w: C.snowsh, L: C.pale, M: C.stone, D: C.deep },
  };
  const OUT = { // [soft (top/left), hard (bottom/right)]
    oak: [C.pine, C.deep], pine: [C.deep, C.ink], bush: [C.leaf, C.pine], rock: [C.stone, C.ink],
    hill: [C.leaf, C.pine], log: [C.bark, C.ink], mush: [C.bark, C.bark],
    stump: [C.bark, C.ink], snag: [null, C.bark], deadLog: [C.ash2, C.ink], ruin: [C.stone, C.ink], portal: [C.bark, C.ink], damWall: [C.bark, C.ink],
    pebble: [null, C.stone], deadReed: [null, null],
    cactus: [C.leaf, C.pine], snowPine: [C.deep, C.ink], snowRock: [C.stone, C.ink], dune: [null, C.clay], drift: [null, C.pale], driftwood: [C.clay, C.soil], rockD: [C.soil, C.bark], mtn: [C.stone, C.ink],
  };
  // sprite name -> [shape, legend family]; families share a legend and outline
  const SHAPE = { deadLog: 'log', deadReed: 'reed', pebble: 'rockS', stumpL: 'stumpL', driftwood: 'log', oakS: 'oakS', snowPine: 'pine', snowRock: 'rock', rockD: 'rock', drift: 'dune', tuftB: 'tuft', mtnS: 'mtnS' };
  const FAMILY = { stumpL: 'stump', oakS: 'oak', rockS: 'rock', tuftB: 'tuftB', mtnS: 'mtn' };

  // ---------- layouts: what stands on each tile, by base point in face coordinates ----------
  const TUFTS = [[7, 9], [13, 5], [20, 6], [25, 11], [9, 15], [16, 13], [24, 18], [5, 14], [12, 22], [19, 24], [27, 15], [15, 19]];
  const BIOMES = {
    grass:  { name: 'Grassland', move: 1, def: 0, items: [['rockS', 20, 16], ['flower', 10, 18, 'rose']], tufts: 'all' },
    meadow: { name: 'Flower meadow', move: 1, def: 0, tufts: [0, 1, 3, 7, 10, 11], items: [
      ['flower', 9, 8, 'rose'], ['flower', 16, 7, 'cloud'], ['flower', 22, 9, 'rose'], ['bud', 13, 11, 'glow'], ['bud', 26, 13, 'cloud'],
      ['flower', 7, 14, 'glow'], ['flower', 13, 16, 'rose'], ['bush', 21, 16], ['bud', 18, 13, 'rose'], ['flower', 10, 21, 'cloud'],
      ['flower', 17, 22, 'glow'], ['bud', 24, 21, 'rose'], ['bud', 6, 18, 'cloud']] },
    grove:  { name: 'Oak grove', move: 2, def: 2, tufts: [7, 8, 10, 11], items: [
      ['oak', 11, 11], ['oak', 22, 13], ['mush', 17, 15], ['log', 7, 18], ['oakS', 15, 21], ['bush', 23, 22], ['flower', 10, 22, 'rose']] },
    pines:  { name: 'Pine stand', move: 2, def: 2, tufts: [8, 9, 6], items: [
      ['pine', 17, 7], ['pine', 9, 10], ['pine', 24, 12], ['pine', 13, 17], ['pine', 21, 20], ['rockS', 8, 21]] },
    forest: { name: 'Deep forest', move: 3, def: 3, tufts: [], items: [
      ['pine', 9, 8], ['oakS', 16, 7], ['pine', 23, 9], ['oak', 12, 15], ['pine', 20, 15], ['oakS', 26, 17], ['pine', 7, 20], ['oakS', 17, 22], ['pine', 23, 23]] },
    pond:   { name: 'Pond', move: 2, def: 0, water: 'pond', tufts: [1, 2, 8, 9, 11], items: [
      ['reed', 7, 14], ['reed', 9, 17], ['lily', 18, 13], ['reed', 25, 18], ['rockS', 23, 9], ['flower', 7, 22, 'cloud'], ['bud', 22, 23, 'rose']] },
    lake:   { name: 'Lake', move: 0, def: 0, water: 'lake', tufts: [], items: [] },
    rocks:  { name: 'Boulder field', move: 2, def: 1, ground: 'rocky', tufts: [0, 4, 8, 9, 11], items: [
      ['rockS', 23, 7], ['rock', 12, 11], ['rock', 21, 16], ['rockS', 8, 19], ['tuftB', 16, 19], ['rockS', 17, 23]] },
    hills:  { name: 'Rolling hills', move: 2, def: 1, tufts: [8, 9, 0], items: [
      ['hill', 11, 11], ['oakS', 24, 10], ['hill', 18, 19], ['flower', 8, 21, 'glow'], ['bud', 26, 17, 'rose']] },
    desert: { name: 'Desert', move: 2, def: 0, ground: 'desert', tufts: [0, 2, 4, 6, 8, 10, 11], items: [
      ['dune', 11, 10], ['cactus', 21, 11], ['rockD', 8, 18], ['dune', 19, 21], ['cactus', 11, 22]] },
    tundra: { name: 'Tundra', move: 2, def: 0, ground: 'tundra', tufts: [1, 3, 5, 9, 11], items: [
      ['snowPine', 10, 10], ['snowPine', 22, 12], ['snowRock', 16, 19], ['drift', 11, 22], ['snowPine', 23, 21]] },
    swamp: { name: 'Swamp', move: 3, def: 1, ground: 'swamp', tufts: [0, 6, 11], items: [
      ['deadTree', 22, 9], ['reed', 6, 12], ['reed', 15, 18], ['lily', 20, 15], ['mush', 25, 20], ['reed', 9, 22], ['deadTree', 6, 19]] },
    river: { name: 'River', move: 3, def: 0, river: true, tufts: 'all', items: [
      ['bush', 8, 9], ['flower', 23, 8, 'rose'], ['rockS', 9, 20], ['reed', 22, 19], ['bud', 25, 15, 'cloud'], ['flower', 6, 15, 'glow'], ['bud', 20, 23, 'rose']] },
    mountains: { name: 'Mountains', move: 4, def: 3, ground: 'rocky', tufts: [9, 10], items: [
      ['mtn', 12, 15], ['mtnS', 21, 21], ['rockS', 7, 21], ['rockS', 24, 11]] },
    beach: { name: 'Beach', move: 1, def: 0, ground: 'beach', shore: true, tufts: [1, 4, 6, 0], items: [
      ['driftwood', 14, 11], ['shell', 9, 9], ['shell', 21, 16], ['rockS', 23, 8], ['shell', 7, 16], ['tuftB', 18, 6]] },
    // ---- ruins: what the settlers left. The game swaps a hex to one of these until it is healed. ----
    dust: { name: 'Dust', ruin: true, ground: 'dust', tufts: [0, 3, 6, 9], items: [['pebble', 21, 9], ['pebble', 9, 20]] },
    bare: { name: 'Bare soil', ruin: true, ground: 'bare', tufts: [1, 4, 7, 10, 11], items: [['pebble', 22, 21]] },
    stumps: { name: 'Stump field', ruin: true, ground: 'bare', tufts: [2, 5, 10], items: [
      ['stumpL', 10, 10], ['stump', 21, 8], ['stumpL', 19, 18], ['stump', 8, 20], ['deadLog', 22, 21]] },
    deadwood: { name: 'Dead trees', ruin: true, ground: 'bare', tufts: [4, 10], items: [
      ['snag', 9, 11], ['snag', 22, 9], ['deadLog', 15, 15], ['stump', 25, 18], ['deadLog', 9, 21], ['snag', 19, 22]] },
    farmruin: { name: 'Old farmhouse', ruin: true, ground: 'dust', tufts: [0, 9, 11], items: [['ruin', 15, 14], ['pebble', 24, 18], ['pebble', 8, 20]] },
    rot: { name: 'Rot', ruin: true, ground: 'rot', tufts: [0, 2, 4, 6, 8, 10, 11], items: [['bubble', 24, 9], ['bubble', 8, 20]] },
    rotRiver: { name: 'Rotten river', ruin: true, ground: 'rot', river: true, riverTone: 'rot', tufts: [1, 5, 9], items: [['bubble', 7, 9], ['bubble', 24, 19]] },
    riverDirty: { name: 'Dirty river', ruin: true, ground: 'sick', river: true, riverTone: 'dirty', tufts: 'all', items: [
      ['deadReed', 8, 9], ['pebble', 9, 20], ['deadReed', 22, 19], ['stump', 24, 8]] },
    riverDry: { name: 'Dry riverbed', ruin: true, ground: 'dust', river: true, riverTone: 'dry', tufts: [0, 3, 7, 11], items: [['pebble', 8, 10], ['deadReed', 22, 19], ['pebble', 24, 9]] },
    dam: { name: 'Old dam', ruin: true, ground: 'dust', river: true, riverTone: 'dam', tufts: [3, 11], items: [['damWall', 15, 15]] },
    marshDry: { name: 'Drained marsh', ruin: true, ground: 'dryswamp', tufts: [0, 6, 11], items: [
      ['deadTree', 22, 9], ['deadReed', 6, 12], ['deadReed', 15, 18], ['deadReed', 9, 22], ['stump', 25, 20], ['deadTree', 6, 19]] },
    mine: { name: 'Leaking mine', ruin: true, ground: 'scree', tufts: [9, 10], items: [['mtn', 12, 14], ['portal', 21, 20], ['pebble', 7, 21]] },
  };
  // Edges of the flat-top hex, by the neighbour they face. Rivers run between edge midpoints; beaches flood the edges that face water.
  const DIRS = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
  const VERT = [[8, 0], [24, 0], [32, 14], [24, 28], [8, 28], [0, 14]];
  const EDGE = { N: [0, 1], NE: [1, 2], SE: [2, 3], S: [3, 4], SW: [4, 5], NW: [5, 0] };
  const MID = Object.fromEntries(DIRS.map((d) => { const [a, b] = EDGE[d]; return [d, [(VERT[a][0] + VERT[b][0]) / 2, (VERT[a][1] + VERT[b][1]) / 2]]; }));
  const segDist = (px, py, [ax, ay], [bx, by]) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - t * vx, py - ay - t * vy); };
  const edgeDist = (x, y, d) => segDist(x + 0.5, y + 0.5, VERT[EDGE[d][0]], VERT[EDGE[d][1]]);
  // River centre line: a curve from one edge midpoint to another, bending through the tile centre.
  function riverDist(dirs) {
    const pts = [], cx = 16, cy = 14;
    const curve = (a, b) => { for (let t = 0; t <= 1.0001; t += 0.02) { const u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]); } };
    const out = (d) => { const [mx, my] = MID[d]; return [mx + (mx - cx) * 0.08, my + (my - cy) * 0.08]; }; // overshoot a little past the edge
    if (dirs.length === 1) curve(out(dirs[0]), [cx, cy]);
    else for (let i = 1; i < dirs.length; i++) curve(out(dirs[0]), out(dirs[i]));
    return (x, y) => Math.min(...pts.map(([px, py]) => Math.hypot(x + 0.5 - px, y + 0.5 - py)));
  }
  const GROUND = {
    grass: { base: C.grass, tuft: { L: C.lime }, shade: C.leaf, band: [C.soil, C.bark, C.bark] },
    rocky: { base: C.lime, fleck: C.grass, tuft: { L: C.grass }, shade: C.grass, band: [C.soil, C.bark, C.bark] },
    desert: { base: C.sand1, tuft: { L: C.clay }, tuftShape: 'ripple', shade: C.clay, band: [C.clay, C.soil, C.bark] },
    beach: { base: C.sand0, tuft: { L: C.grass }, shade: C.sand1, band: [C.clay, C.soil, C.bark] },
    tundra: { base: C.snow1, tuft: { L: C.sage }, shade: C.snowsh, band: [C.pale, C.stone, C.deep] },
    swamp: { base: C.olive, fleck: C.olive2, tuft: { L: C.grass }, shade: C.olive2, band: [C.soil, C.bark, C.bark] },
    dust: { base: C.sand1, plates: true, tuft: { L: C.clay }, shade: C.clay, band: [C.clay, C.soil, C.bark] },
    bare: { base: C.loam1, furrows: true, tuft: { L: C.sand1 }, shade: C.soil, band: [C.soil, C.bark, C.bark] },
    rot: { base: C.rot2, ooze: true, tuft: { L: C.rot1 }, shade: C.rot3, band: [C.rot3, C.ink, C.ink] },
    sick: { base: C.olive, fleck: C.olive2, tuft: { L: C.dun0 }, shade: C.olive2, band: [C.soil, C.bark, C.bark] },
    dryswamp: { base: C.dun1, fleck: C.dun2, mudPools: true, tuft: { L: C.dun0 }, shade: C.dun2, band: [C.soil, C.bark, C.bark] },
    scree: { base: C.ash, fleck: C.ash2, tuft: { L: C.pale }, shade: C.stone, band: [C.stone, C.deep, C.ink] },
  };
  // Dried mud: plates around hand-placed seeds. A crack runs where two plates meet; each plate catches light on its
  // upper-left rim and sinks into shade on its lower-right one.
  const PLATES = [[5, 5], [13, 2], [21, 6], [28, 10], [3, 14], [11, 11], [19, 14], [26, 19], [8, 20], [16, 22], [22, 27], [12, 28], [4, 26]];
  const plateOf = (x, y) => { let best = 0, bd = 1e9; PLATES.forEach(([px, py], i) => { const d = (x - px) ** 2 + (y - py) ** 2 + ((x * 7 + y * 3) % 5) * 0.8; if (d < bd) { bd = d; best = i; } }); return best; };
  const crackAt = (x, y) => plateOf(x, y) !== plateOf(x + 1, y) || plateOf(x, y) !== plateOf(x, y + 1);
  const WET = new Set(['damWall']); // sprites built in the water on purpose
  const OOZE = [[12, 10, 5.6, 2.5], [21, 19, 4.2, 1.9]];
  const RIVER_TONE = { // [deep, water, highlight, lit bank, shaded bank]
    clean: [null, null, null, null, null],
    dirty: [C.murk2, C.murk, C.scum, C.dun0, C.olive2],
    dry: [C.bark, C.soil, C.pale, C.sand0, C.clay],
    dam: [C.bark, C.soil, C.pale, C.sand0, C.clay],
    rot: [C.rot3, C.rot2, C.rot0, C.rot1, C.rot3],
  };
  const SWAMP_POOLS = [[10, 9, 4.6, 2.2], [20, 15.5, 5.2, 2.6], [13, 21, 3.6, 1.8]];
  const poolD = (x, y, [px, py, rx, ry]) => ((x + 0.5 - px) / rx) ** 2 + ((y + 0.5 - py) / ry) ** 2;

  // ---------- bright tiles: one tile in a 32x48 cell ----------
  const BORDER = { // [outer line, inner bevel on the lit edges]
    grass: [C.leaf, C.lime], meadow: [C.leaf, C.glow], grove: [C.pine, C.lime], pines: [C.deep, C.grass], forest: [C.deep, C.grass],
    pond: [C.leaf, C.lime], lake: [C.deep, C.mist], rocks: [C.stone, C.pale], hills: [C.leaf, C.glow],
    desert: [C.clay, C.sand0], tundra: [C.pale, C.cloud], swamp: [C.pine, C.sage], river: [C.leaf, C.lime], mountains: [C.stone, C.pale], beach: [C.clay, C.cloud],
    dust: [C.clay, C.sand0], bare: [C.soil, C.loam0], stumps: [C.soil, C.loam0], deadwood: [C.soil, C.loam0], farmruin: [C.clay, C.sand0],
    rot: [C.rot3, C.rot1], rotRiver: [C.rot3, C.rot1], riverDirty: [C.olive2, C.dun0], riverDry: [C.clay, C.sand0], dam: [C.clay, C.sand0],
    marshDry: [C.dun2, C.dun0], mine: [C.stone, C.cloud],
  };
  const DEFAULT_CTX = { river: { river: ['N', 'SE'] }, riverDirty: { river: ['N', 'SE'] }, riverDry: { river: ['N', 'SE'] }, dam: { river: ['N', 'SE'] }, rotRiver: { river: ['N', 'SE'] }, beach: { shore: ['SE', 'S'] } };
  const WATER2 = '#4b86c9'; // the one extra tone: deep water
  function pondShape(x, y) { const dx = (x + 0.5 - 16.5) / 9.5, dy = (y + 0.5 - 13.5) / 5.6; return dx * dx + dy * dy; }
  // Variant 1 mirrors every base point left to right so neighbouring tiles of one biome do not repeat.
  const mirror = (b) => ({ ...b, items: b.items.map(([k, x, y, p]) => [k, FW - 1 - x, y, p]), tuftsAt: true });
  const pick = (id, v) => (v % 2 ? mirror(BIOMES[id]) : BIOMES[id]);
  const tuftXY = (b, i) => (b.tuftsAt ? [FW - 1 - TUFTS[i][0], TUFTS[i][1]] : TUFTS[i]);
  // ctx carries what the neighbours decide: ctx.river lists the edges a river leaves by, ctx.shore the edges that face open water.
  // waterAt(x, y) says whether a face pixel is river or sea, so ground details and sprites stay out of it.
  function waterAt(b, ctx) {
    const rd = b.river && ctx.river && ctx.river.length ? riverDist(ctx.river) : null;
    const sh = b.shore ? ctx.shore || [] : [];
    return {
      river: (x, y) => (rd ? rd(x, y) : 99),
      shore: (x, y) => Math.min(99, ...sh.map((d) => edgeDist(x, y, d))),
      keepOut: (x, y) => (rd && rd(x, y) < 5) || (sh.length && Math.min(...sh.map((d) => edgeDist(x, y, d))) < 9),
    };
  }
  function cloverTile(id, v = 0, ctx = DEFAULT_CTX[id] || {}) {
    const b = pick(id, v), cv = new Cv(CW, CH), [edge, bevel] = BORDER[id];
    const G = GROUND[b.ground || 'grass'], W = waterAt(b, ctx);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (!inFace(x, y)) continue;
      let c = b.water === 'lake' ? C.sky : G.base;
      if (G.fleck && margin(x, y) > 2 && [0, 3].includes((x * 3 + y * 5) % 11)) c = G.fleck; // scattered darker flecks in pairs
      const mx = b.tuftsAt ? FW - 1 - x : x;
      if (G.plates) { // dried mud plates: dark crack, lit rim below/right of it, shaded rim above/left of it
        if (crackAt(mx, y)) c = C.clay;
        else if (crackAt(mx, y - 1)) c = C.sand0;
      }
      if (G.furrows) { // ploughed rows that bow gently across the hex
        const k = (y + Math.round(Math.sin(mx / 5.5) * 1.2) + 40) % 4;
        c = k === 0 ? C.soil : k === 1 ? C.loam0 : C.loam1;
      }
      if (G.ooze || G.mudPools) {
        const d = Math.min(...OOZE.map((p) => poolD(mx, y, p)));
        if (G.ooze) { if (d <= 1) c = OOZE.some(([px, py]) => (mx === px - 2 || mx === px - 1) && y === py - 1) ? C.rot0 : C.rot3; else if (d <= 1.5) c = C.rot1; }
        else if (d <= 1) c = crackAt(mx, y) ? C.bark : d < 0.6 ? C.soil : C.clay;
        else if (d <= 1.35) c = C.dun2;
      }
      cv.set(x, y + FY, c);
    }
    if (b.water === 'lake') {
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (inFace(x, y) && ((x + 0.5 - 16) / 10) ** 2 + ((y + 0.5 - 14) / 7) ** 2 < 1) cv.set(x, y + FY, WATER2);
      for (const [x, y, n] of [[9, 7, 3], [19, 9, 2], [6, 15, 2], [22, 17, 3], [13, 21, 3], [15, 12, 2]]) for (let k = 0; k < n; k++) cv.set(x + k, y + FY, C.mist);
    }
    if (b.water === 'pond') {
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const d = pondShape(x, y);
        if (d <= 1) cv.set(x, y + FY, d < 0.45 ? WATER2 : y < 10 ? WATER2 : C.sky);
        else if (d <= 1.3) cv.set(x, y + FY, y < 13 ? C.leaf : C.sage); // bank: shaded far rim, pale near rim
      }
      for (const [x, y, n] of [[11, 10, 3], [17, 15, 2], [20, 11, 2]]) for (let k = 0; k < n; k++) cv.set(x + k, y + FY, C.mist);
    }
    if (b.ground === 'swamp') for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const d = Math.min(...SWAMP_POOLS.map((p) => poolD(x, y, p)));
      if (inFace(x, y) && d <= 1) cv.set(x, y + FY, d < 0.4 ? C.murk2 : C.murk);
      else if (inFace(x, y) && d <= 1.45) cv.set(x, y + FY, C.olive2);
    }
    if (b.ground === 'swamp') for (const [x, y] of [[8, 8], [18, 14], [12, 21]]) { cv.set(x, y + FY, C.sage); cv.set(x + 1, y + FY, C.sage); }
    const inPool = (x, y) => b.ground === 'swamp' && SWAMP_POOLS.some((p) => poolD(x, y, p) <= 1.5);
    // ground details, skipped where a sprite, pool or water will be
    const tl = b.tufts === 'all' ? TUFTS.map((_, i) => i) : b.tufts;
    const clear = (x, y) => b.items.every(([, ix, iy]) => Math.abs(ix - x) > 3 || Math.abs(iy - y) > 3);
    tl.forEach((i) => {
      const [x, y] = tuftXY(b, i);
      const mx = b.tuftsAt ? FW - 1 - x : x, inOoze = (G.ooze || G.mudPools) && OOZE.some((p) => poolD(mx, y, p) <= 1.7);
      if ((b.water === 'pond' && pondShape(x, y) <= 1.5) || inPool(x, y) || inOoze || W.keepOut(x, y) || !clear(x, y)) return;
      cv.sprite(x - 1, y - 1 + FY, SPR[G.tuftShape || 'tuft'].rows, G.tuft);
    });
    // border: outer line all round, a bevel line inside the upper-left edges, a shade line inside the lower-right edges
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (!inFace(x, y)) continue;
      if (ring(x, y)) { cv.set(x, y + FY, edge); continue; }
      const nearRing = ring(x - 1, y) || ring(x, y - 1) || ring(x + 1, y) || ring(x, y + 1);
      if (!nearRing) continue;
      const lit = y < 14 && x < 20 || (y < 3);
      if (b.water === 'lake') cv.set(x, y + FY, lit ? C.mist : WATER2);
      else if (lit) cv.set(x, y + FY, bevel);
      else if (y >= 14) cv.set(x, y + FY, G.shade);
    }
    // sea on a beach's water-facing edges: water, a foam line, then wet sand. Drawn over the border so it joins the lake.
    if (b.shore) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (!inFace(x, y)) continue;
      const d = W.shore(x, y);
      if (d < 4.5) cv.set(x, y + FY, d < 2.5 ? WATER2 : C.sky);
      else if (d < 5.6) cv.set(x, y + FY, (x + y) % 4 ? C.cloud : C.mist);
      else if (d < 6.6) cv.set(x, y + FY, C.sand1);
    }
    // river: banks, water, a deeper centre and a few highlight strokes. Drawn over the border so neighbours join up.
    if (b.river) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (!inFace(x, y)) continue;
      const d = W.river(x, y), [tD, tW, tH, tL, tS] = RIVER_TONE[b.riverTone || 'clean'];
      if (d < 2.7) cv.set(x, y + FY, d < 1.2 ? tD || WATER2 : tW || C.sky);
      else if (d < 3.7) cv.set(x, y + FY, ring(x, y) ? edge : x + y < 30 ? tL || C.lime : tS || C.leaf);
      if (d < 2 && d >= 1.2 && (x * 2 + y) % 9 === 0) { cv.set(x, y + FY, tH || C.mist); }
      if (b.riverTone === 'dry' && d < 2.7 && crackAt(x, y)) cv.set(x, y + FY, C.bark); // the bed has cracked as it dried
      if (b.riverTone === 'dirty' && d < 2.7 && (x * 5 + y * 3) % 17 === 0) { cv.set(x, y + FY, C.scum); cv.set(x + 1, y + FY, C.scum); } // scum
      if (b.riverTone === 'dam' && d < 2.7 && y < 14) cv.set(x, y + FY, d < 1.2 ? C.murk2 : C.murk); // stale water held behind the wall
    }
    // side band under the near edges
    for (let x = 0; x < FW; x++) {
      let yb = -1; for (let y = 0; y < FH; y++) if (inFace(x, y)) yb = y;
      if (yb < 0) continue;
      const wet = (b.river && W.river(x, yb) < 2.7) || (b.shore && W.shore(x, yb) < 4.5);
      const cols = b.water === 'lake' || wet ? [C.deep, C.stone, C.deep] : G.band;
      for (let k = 1; k <= BAND; k++) if (!inFace(x, yb + k)) cv.set(x, yb + k + FY, x === INSET[FH - 1] && k === 1 ? cols[1] : cols[k - 1]);
    }
    // sprites, back to front; anything that would stand in water is left out
    const items = b.items.filter(([k, x, y]) => WET.has(k) || !W.keepOut(x, y)).sort((a, c) => a[2] - c[2]);
    const placed = [];
    let overhang = 0;
    items.forEach(([k, x, y, p]) => {
      const fam = FAMILY[k] || k;
      const s = SPR[SHAPE[k] || k];
      let leg = typeof LEG[fam] === 'function' ? LEG[fam](C[p]) : LEG[fam];
      if (k === 'bud') leg = { P: C[p], D: C.leaf };
      if (k === 'tuftB') leg = { L: C.grass };
      const o = OUT[fam] || [];
      const x0 = x - s.bx, y0 = y - s.by;
      // overhang: sprite pixels past the side of the hex in its lower half, where the tiles in front would cut them off
      s.rows.forEach((r, yy) => [...r].forEach((ch, xx) => { const X = x0 + xx, Y = y0 + yy; if (ch !== '.' && (X < 0 || X >= FW || (Y >= 14 && !inFace(X, Y)))) overhang++; }));
      cv.sprite(x0, y0 + FY, s.rows, leg, o[0], o[1]);
      placed.push({ k, x, y, margin: margin(x, y) });
      if (k === 'bush' && id === 'grove') [[x - 1, y - 2], [x + 2, y - 1]].forEach(([bx, by]) => cv.set(bx, by + FY, C.rose)); // berries
    });
    if (id === 'mine') { // rot seeps out of the adit and down the slope
      const px0 = b.tuftsAt ? FW - 1 - 21 : 21;
      for (let y = 20; y < FH; y++) { const w = y < 23 ? 3 : 2, x0 = px0 - 1 + Math.round(Math.sin(y / 2) * 0.8); for (let i = 0; i < w; i++) if (inFace(x0 + i, y) && !ring(x0 + i, y)) cv.set(x0 + i, y + FY, i === 0 ? C.rot0 : C.rot1); }
    }
    const loneBefore = orphans(cv, ACCENTS);
    cleanup(cv, ACCENTS);
    return { cv, placed, loneBefore, overhang };
  }

  // Where one sprite's outline clips another, a lone pixel can be left behind. Merge it into its most common neighbour.
  const ACCENTS = new Set([C.glow, C.rose, C.cloud, C.mist]);
  function cleanup(cv, keep) {
    const src = cv.px.slice();
    for (let y = 1; y < cv.h - 1; y++) for (let x = 1; x < cv.w - 1; x++) {
      const c = src[y * cv.w + x]; if (!c || keep.has(c)) continue;
      const nb = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) nb.push(src[(y + dy) * cv.w + x + dx]);
      if (nb.includes(c) || nb.some((v) => !v)) continue;
      const n4 = [src[(y - 1) * cv.w + x], src[(y + 1) * cv.w + x], src[y * cv.w + x - 1], src[y * cv.w + x + 1]], count = new Map();
      n4.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
      cv.px[y * cv.w + x] = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  // ---------- maps ----------
  const KEY = { g: 'grass', m: 'meadow', o: 'grove', p: 'pines', f: 'forest', w: 'pond', l: 'lake', r: 'rocks', h: 'hills',
    d: 'desert', t: 'tundra', s: 'swamp', v: 'river', n: 'mountains', b: 'beach' };
  // Zones: frozen peaks in the north-west, desert behind a ridge in the north-east, swamp in the south-west, and a
  // river that runs from the north-west peaks through the farmland into the southern lake.
  const WORLD = [
    'nntntppghnndddnd',
    'nttvtpfghhnddddd',
    'ttpvpffoggrddndd',
    'tpgvgofogmgrdddn',
    'pogmvgmmgoghrddd',
    'ggogvvmgwgmghrdd',
    'sggomvgggmgoghrd',
    'sssgmgvmgofpgghg',
    'ssssgmvvgmgbbbgb',
    'sssgbbbgvbblllbl',
    'sssbllllllllllll',
  ];
  const RIVER = [[3, 1], [3, 2], [3, 3], [4, 4], [4, 5], [5, 5], [5, 6], [6, 7], [6, 8], [7, 8], [8, 9]]; // source to mouth
  const MAPS = {
    world: { name: 'Verdant Reach', cells: WORLD.flatMap((row, r) => [...row].map((ch, c) => ({ c, r, b: KEY[ch] }))),
      fog: ['15,0', '15,1', '14,0', '15,2', '14,1', '0,10', '1,10', '0,9'], select: '7,5', river: RIVER },
    isle: { name: 'Verdant Isle', cells: [{ c: 0, r: 0, b: 'grove' }, { c: 1, r: 0, b: 'pines' }, { c: 2, r: 0, b: 'rocks' }, { c: 0, r: 1, b: 'pond' }, { c: 1, r: 1, b: 'meadow' }],
      fog: [], select: null },
  };
  const dirTo = (c, r, nc, nr) => DIRS.find((d, i) => { const [x, y] = NB(c, r)[NB_ORDER[i]]; return x === nc && y === nr; });
  const at = (c, r) => ({ x: c * 24, y: r * 28 + (c & 1) * 14 });
  const NB = (c, r) => (c & 1 ? [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [1, -1], [-1, 0], [1, 0]]).map(([dc, dr]) => [c + dc, r + dr]);

  const NB_ORDER = [0, 3, 5, 1, 4, 2]; // DIRS order (N NE SE S SW NW) as indexes into NB's list, fixed per column parity below
  // Edges each river and beach tile must open, worked out from its neighbours.
  function contexts(map) {
    const byKey = new Map(map.cells.map((t) => [`${t.c},${t.r}`, t])), ctx = new Map();
    const P = map.river || [];
    P.forEach(([c, r], i) => {
      const dirs = [];
      if (i > 0) dirs.push(dirTo(c, r, ...P[i - 1]));
      else { const src = NB(c, r).find(([x, y]) => ['mountains', 'mine'].includes(byKey.get(`${x},${y}`)?.b)); if (src) dirs.push(dirTo(c, r, ...src)); }
      if (i < P.length - 1) dirs.push(dirTo(c, r, ...P[i + 1]));
      else { const m = NB(c, r).find(([x, y]) => byKey.get(`${x},${y}`)?.b === 'lake'); if (m) dirs.push(dirTo(c, r, ...m)); }
      ctx.set(`${c},${r}`, { river: dirs.filter(Boolean) });
    });
    map.cells.forEach((t) => {
      if (t.b !== 'beach') return;
      ctx.set(`${t.c},${t.r}`, { shore: NB(t.c, t.r).map(([x, y]) => [x, y]).filter(([x, y]) => byKey.get(`${x},${y}`)?.b === 'lake').map(([x, y]) => dirTo(t.c, t.r, x, y)) });
    });
    return ctx;
  }
  function reach(map, from, steps) { // tiles a unit can reach, spending each tile's move cost
    const byKey = new Map(map.cells.map((t) => [`${t.c},${t.r}`, t])), fog = new Set(map.fog);
    const cost = new Map([[from, 0]]), q = [from];
    while (q.length) {
      const k = q.shift(), [c, r] = k.split(',').map(Number);
      for (const [nc, nr] of NB(c, r)) {
        const nk = `${nc},${nr}`, t = byKey.get(nk);
        if (!t || fog.has(nk) || BIOMES[t.b].move === 0) continue;
        const v = cost.get(k) + BIOMES[t.b].move;
        if (v <= steps && (!cost.has(nk) || cost.get(nk) > v)) { cost.set(nk, v); q.push(nk); }
      }
    }
    return cost;
  }

  // Compose a map: tiles drawn top to bottom so each tile's tall art overlaps the tile behind it.
  // owner[] maps every face pixel to its cell index, for hit-testing.
  function renderMap(mapId) {
    const map = MAPS[mapId];
    const cols = Math.max(...map.cells.map((t) => t.c)) + 1, rows = Math.max(...map.cells.map((t) => t.r)) + 1;
    const W = 24 * (cols - 1) + 32, H = FY + 28 * rows + (cols > 1 ? 14 : 0) + BAND;
    const out = new Cv(W, H), owner = new Int16Array(W * H).fill(-1);
    const ctxs = contexts(map);
    const order = map.cells.map((t, i) => ({ ...t, i, ...at(t.c, t.r) })).sort((a, b) => a.y - b.y || a.c - b.c);
    order.forEach((t) => {
      const v = (t.c * 5 + t.r * 3) % 2, img = cloverTile(t.b, v, ctxs.get(`${t.c},${t.r}`)).cv;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = img.px[y * img.w + x]; if (c) out.set(t.x + x, t.y + y, c); }
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (inFace(x, y)) owner[(t.y + FY + y) * W + t.x + x] = t.i;
    });
    return { w: W, h: H, px: out.px, owner, cells: map.cells, top: FY };
  }

  // ---------- checks ----------
  function orphans(cv, accents, list) {
    let n = 0;
    for (let y = 1; y < cv.h - 1; y++) for (let x = 1; x < cv.w - 1; x++) {
      const c = cv.px[y * cv.w + x]; if (!c || accents.has(c)) continue;
      // a lone pixel shares its color with none of its 8 neighbours (1px lines still join corner to corner)
      const nb = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) nb.push(cv.px[(y + dy) * cv.w + x + dx]);
      if (!nb.includes(c) && !nb.some((v) => !v)) { n++; if (list) list.push([x, y - (cv.h === CH ? FY : 0), c]); }
    }
    return n;
  }
  function checks() {
    // tessellation: lay a 6x6 block of faces and count gaps and overlaps inside the inner tiles
    const W = 24 * 6 + 8, H = 28 * 6 + 14, hit = new Uint8Array(W * H);
    for (let c = 0; c < 6; c++) for (let r = 0; r < 6; r++) { const p = at(c, r); for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (inFace(x, y)) hit[(p.y + y) * W + p.x + x]++; }
    let gaps = 0, overlaps = 0;
    for (let y = 28; y < H - 28; y++) for (let x = 32; x < W - 32; x++) { const v = hit[y * W + x]; if (v === 0) gaps++; if (v > 1) overlaps++; }
    const accents = new Set([C.glow, C.rose, C.cloud, C.mist]);
    const tiles = Object.keys(BIOMES).map((id) => {
      const { cv, placed, loneBefore, overhang } = cloverTile(id), lone = [];
      return { id, loneBefore, overhang, stray: orphans(cv, accents, lone), lone, minMargin: placed.length ? Math.min(...placed.map((p) => p.margin)) : null, items: placed.length };
    });
    // every river tile must touch the next one, and the ends must reach the peaks and the lake
    const wm = MAPS.world, byKey = new Map(wm.cells.map((t) => [`${t.c},${t.r}`, t]));
    let riverBreaks = 0; wm.river.forEach(([c, r], i) => { if (byKey.get(`${c},${r}`).b !== 'river') riverBreaks++; if (i && !dirTo(c, r, ...wm.river[i - 1])) riverBreaks++; });
    const ends = contexts(wm); if (ends.get(wm.river[0].join()).river.length < 2 || ends.get(wm.river.at(-1).join()).river.length < 2) riverBreaks++;
    return { gaps, overlaps, tiles, riverBreaks };
  }

  return { C, BIOMES, MAPS, INSET, FW, FH, CW, CH, FY, DIRS, NB, inFace, cloverTile, renderMap, reach, contexts, checks, at };
}
if (typeof module !== 'undefined') module.exports = { buildHexTiles };
