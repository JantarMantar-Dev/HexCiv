// HexCiv tile viewer: map with hover tooltip, the tile set, the five-tile isle and the art checks.
(() => {
  const X = buildHexTiles();
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const BG = '#a9d5f0'; // sky behind the map
  function paint(canvas, w, h, px, scale, bg) {
    canvas.width = w * scale; canvas.height = h * scale;
    const cx = canvas.getContext('2d'), im = cx.createImageData(canvas.width, canvas.height), b = bg ? hex(bg) : null;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const c = px[((y / scale) | 0) * w + ((x / scale) | 0)], o = (y * canvas.width + x) * 4;
      if (!c && !b) continue;
      const v = c ? hex(c) : b; im.data[o] = v[0]; im.data[o + 1] = v[1]; im.data[o + 2] = v[2]; im.data[o + 3] = 255;
    }
    cx.putImageData(im, 0, 0);
  }
  const N = X.BIOMES;
  const cost = (b) => (N[b].move === 0 ? 'impassable' : `${N[b].move}`);

  // ---- map viewer ----
  let R = null;
  const canvas = document.getElementById('map'), stage = document.getElementById('stage'), tip = document.getElementById('tip');
  function draw() {
    R = X.renderMap('world');
    const room = stage.clientWidth - 22, scale = Math.max(1, Math.min(4, Math.floor(room / R.w)));
    paint(canvas, R.w, R.h, R.px, scale, BG);
    canvas.style.width = `${scale === 1 && room > R.w * 1.15 ? room : R.w * scale}px`; // small screens: stretch rather than leave the map tiny
    document.getElementById('side-h').textContent = 'Verdant Reach';
    document.getElementById('side-p').textContent = 'Frozen peaks to the north-west, desert past the ridge to the north-east, swamp to the south-west, and a river down to the southern lake. Hover a tile to read it.';
    document.getElementById('sel').textContent = `${X.MAPS.world.cells.length} tiles, ${new Set(X.MAPS.world.cells.map((q) => q.b)).size} terrains.`;
  }
  function cellAt(e) {
    const r = canvas.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * R.w), y = Math.floor(((e.clientY - r.top) / r.height) * R.h);
    const o = x >= 0 && y >= 0 && x < R.w && y < R.h ? R.owner[y * R.w + x] : -1;
    return o >= 0 ? R.cells[o] : null;
  }
  canvas.addEventListener('mousemove', (e) => {
    const t = cellAt(e); if (!t) { tip.style.display = 'none'; return; }
    tip.innerHTML = `<b>${N[t.b].name}</b><span>move cost ${cost(t.b)}</span><span>defense +${N[t.b].def}</span>`;
    const sr = stage.getBoundingClientRect();
    let lx = e.clientX - sr.left + 14, ly = e.clientY - sr.top + 14;
    tip.style.display = 'block';
    if (lx + tip.offsetWidth > sr.width - 4) lx = e.clientX - sr.left - tip.offsetWidth - 10;
    if (ly + tip.offsetHeight > sr.height - 4) ly = e.clientY - sr.top - tip.offsetHeight - 10;
    tip.style.left = `${lx}px`; tip.style.top = `${ly}px`;
  });
  canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 120); });
  draw();

  // ---- tile set ----
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = Object.keys(N).map((id) => `<li><div class="pair"><canvas aria-label="${N[id].name}"></canvas></div><b>${N[id].name}</b><small>move ${cost(id)} · defense +${N[id].def}</small></li>`).join('');
  sheet.querySelectorAll('li').forEach((li, k) => {
    const id = Object.keys(N)[k], c = X.cloverTile(id).cv;
    paint(li.querySelector('canvas'), c.w, c.h, c.px, 4, null);
  });

  // ---- isle ----
  const isle = document.getElementById('isle');
  isle.innerHTML = '<figure><canvas aria-label="Verdant Isle"></canvas><figcaption>Grove, Pines and Rocks across the top, Pond and Meadow below.</figcaption></figure>';
  const m = X.renderMap('isle'); paint(isle.querySelector('canvas'), m.w, m.h, m.px, 5, BG);

  // ---- checks ----
  const K = X.checks();
  document.getElementById('chk-p').textContent = `Tessellation over a 6×6 block: ${K.gaps} gaps and ${K.overlaps} overlapping pixels. River: ${K.riverBreaks} breaks between source and mouth. Spill counts sprite pixels that stick out past the side of the hex in its lower half, where the tile in front would cut them off. Lone pixels are pixels that share a color with none of their eight neighbours, not counting deliberate one-pixel accents like flower centers. Where a sprite's outline clipped another sprite, the leftover pixel is merged into its neighbours; the count before that pass is shown in brackets.`;
  document.getElementById('chk').innerHTML = K.tiles.map((t) => `<tr><td>${N[t.id].name}</td><td class="num">${t.items}</td><td class="num"><span class="ok">${t.stray}</span> (${t.loneBefore})</td><td class="num">${t.minMargin === null ? 'none' : `${t.minMargin} px`}</td><td class="num"><span class="ok">${t.overhang} px</span></td><td class="num">${cost(t.id)}</td><td class="num">+${N[t.id].def}</td></tr>`).join('');
})();
