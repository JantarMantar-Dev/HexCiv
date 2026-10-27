// Art checks for the tile set. Exits non-zero if any rule fails, so it can run in CI.
//   node tools/check.js
const { buildHexTiles } = require('../src/tiles.js');
const X = buildHexTiles(), K = X.checks();
const fails = [];
if (K.gaps || K.overlaps) fails.push(`tessellation: ${K.gaps} gaps, ${K.overlaps} overlaps`);
if (K.riverBreaks) fails.push(`river: ${K.riverBreaks} breaks between source and mouth`);
for (const t of K.tiles) {
  const row = `${X.BIOMES[t.id].name.padEnd(14)} sprites ${String(t.items).padStart(2)}  lone ${t.stray} (before cleanup ${t.loneBefore})  edge margin ${t.minMargin ?? '-'}  spill ${t.overhang}`;
  console.log(row);
  if (t.stray) fails.push(`${t.id}: ${t.stray} lone pixels`);
  if (t.overhang) fails.push(`${t.id}: ${t.overhang} px of sprite spill past the hex side`);
  if (t.minMargin !== null && t.minMargin < 2) fails.push(`${t.id}: a sprite base sits ${t.minMargin}px from the edge (min 2)`);
}
console.log(`tessellation gaps ${K.gaps}, overlaps ${K.overlaps}; river breaks ${K.riverBreaks}`);
if (fails.length) { console.error('\nFAILED\n' + fails.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
console.log('\nAll art checks pass.');
