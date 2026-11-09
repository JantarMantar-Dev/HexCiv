// Export the tile art to PNG.
//   node tools/export.js
// Writes art/tiles/<terrain>.png (32x48, 1x), art/tilesheet.png (all tiles in one row, 1x),
// art/maps/<map>.png (1x) and docs/images/<map>@3x.png (previews for the docs).
const fs = require('fs'), path = require('path');
const { buildHexTiles } = require('../src/tiles.js');
const { encodePNG } = require('./png.js');
const X = buildHexTiles(), root = path.join(__dirname, '..');
const out = (p, buf) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), buf); console.log('wrote', p); };
const ruins = Object.keys(X.BIOMES).filter((id) => X.BIOMES[id].ruin);
const ids = Object.keys(X.BIOMES).filter((id) => !X.BIOMES[id].ruin), sheet = new Array(ids.length * X.CW * X.CH).fill(null), SW = ids.length * X.CW;
ids.forEach((id, k) => {
  const cv = X.cloverTile(id).cv;
  out(`art/tiles/${id}.png`, encodePNG(cv.w, cv.h, cv.px));
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) sheet[y * SW + k * X.CW + x] = cv.px[y * cv.w + x];
});
out('art/tilesheet.png', encodePNG(SW, X.CH, sheet));
fs.writeFileSync(path.join(root, 'art/tilesheet.json'), JSON.stringify({ tileWidth: X.CW, tileHeight: X.CH, faceTop: X.FY, faceWidth: X.FW, faceHeight: X.FH, order: ids }, null, 2) + '\n');
for (const id of Object.keys(X.MAPS)) {
  const m = X.renderMap(id);
  out(`art/maps/${id}.png`, encodePNG(m.w, m.h, m.px));
  out(`docs/images/${id}@3x.png`, encodePNG(m.w, m.h, m.px, 3, '#a9d5f0'));
}
out('docs/images/tilesheet@4x.png', encodePNG(SW, X.CH, sheet, 4, '#1c2430'));
// the ruins the game swaps in until a hex is healed, both variants side by side
const RW = ruins.length * 2 * X.CW, rs = new Array(RW * X.CH).fill(null);
ruins.forEach((id, k) => [0, 1].forEach((v) => { const cv = X.cloverTile(id, v).cv; out(v ? `art/ruins/${id}-b.png` : `art/ruins/${id}.png`, encodePNG(cv.w, cv.h, cv.px));
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) rs[y * RW + (k * 2 + v) * X.CW + x] = cv.px[y * cv.w + x]; }));
out('docs/images/ruins@4x.png', encodePNG(RW, X.CH, rs, 4, '#1c2430'));
