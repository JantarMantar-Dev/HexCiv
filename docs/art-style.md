# HexCiv art style: bright tiles

This is the rulebook for every tile. Everything is drawn by code in `src/tiles.js`, but nothing is random:
each sprite is a hand-drawn character grid and each tile lists exactly where its sprites stand.
`node tools/check.js` enforces the measurable rules below.

## Grid

| Property | Value |
|---|---|
| Orientation | Flat-top hex |
| Face size | 32 px wide, 28 px tall, side length 16 |
| Face rows | Inset per row from the left/right edge: `8 7 7 6 5 5 4 4 3 3 2 1 1 0`, then mirrored |
| Layout | Columns step 24 px; odd columns sit 14 px lower (Tiled: hex, stagger axis X, stagger index odd) |
| Cell | 32×48. The face occupies rows 16–43; rows 0–15 are headroom for tall art; a 3 px side band shows below |
| Draw order | Top to bottom, then left to right, so tall art always overlaps the tile behind it |

## Palette

The base is **Verdant 16** plus `ink` for the hardest outlines, one deep-water tone, and short ramps added for the
new biomes. Shadows always shift toward blue or teal, never toward black or grey.

| Name | Hex | Used for |
|---|---|---|
| `ink` | `#141d26` | Hardest outline (pines, rocks, logs) |
| `deep` | `#1a3445` | Darkest shade, oak and pine outlines |
| `pine` | `#23584c` | Oak shadow, soft outlines |
| `leaf` | `#2f7d46` | Mid foliage, grass shade line |
| `grass` | `#56a43c` | Grass ground, lit foliage |
| `lime` | `#9bcb3e` | Highlights, tufts, rocky ground |
| `glow` | `#e6e773` | Brightest highlight, flower centres |
| `sage` | `#7fb39a` | Near bank of ponds, tundra grass |
| `bark` | `#3f2b31` | Trunks, dead trees, soil band |
| `soil` | `#77513c` | Lit trunks, soil band |
| `clay` | `#b57f52` | Desert shade, sand border |
| `stone` | `#5f6e8a` | Rock mid, mountain shade |
| `pale` | `#a3b5c4` | Rock light, tundra border |
| `sky` | `#5f9edd` | Water |
| `mist` | `#a9d5f0` | Water highlights, lake bevel |
| `cloud` | `#f4f6ea` | Snow, foam, white flowers |
| `rose` | `#e8587d` | Flowers, berries, mushrooms |
| deep water | `#4b86c9` | Water depth |
| `sand0` / `sand1` | `#f3dca0` / `#e2bd78` | Beach and desert ground, dune light |
| `snow1` / `snowsh` | `#dce7ee` / `#c3d3e0` | Tundra ground, snow shade |
| `olive` / `olive2` | `#5d7d3a` / `#45612f` | Swamp ground and shade |
| `murk` / `murk2` | `#3f6662` / `#2c4a4f` | Swamp water |

## Light and shading

- One light from the **upper left**, on every sprite and every tile border.
- Four tones per material: highlight, light, mid, dark. Highlights appear only as small 2 px strokes, never as a blob.
- Foliage is built from **clumps**. Each clump is shaded on its own (lit upper-left, dark lower-right), so crowns read
  as leaf clusters rather than one smooth ball and never band diagonally across.

## Outlines

- **Selective outline:** every sprite gets a 1 px outline that is darker on the bottom and right (`hard`) and softer
  on the top and left (`soft`). For example, oaks use `pine` / `deep`, pines `deep` / `ink`, rocks `stone` / `ink`.
- Thin-line sprites (dead trees, reeds, flowers) have no outline.
- 1 px lines join corner to corner, so a staircase outline is correct and not a stray pixel.

## Tile anatomy

1. **Ground:** the terrain's base color, plus small hand-placed details (2 px tufts, sand ripples, flecks) at fixed spots.
2. **Water features:** ponds, swamp pools, rivers and beach shores are drawn from shapes, not noise.
3. **Border:** a dark outer line all round, a light bevel inside the upper-left edges, and a shade line inside the
   lower-right edges. Each terrain has its own border pair.
4. **Side band:** 3 px of soil (or stone under water) under the open lower edges.
5. **Sprites:** sorted back to front by their base point.
6. **Cleanup:** where one sprite's outline clips another, any leftover lone pixel is merged into its neighbours.

## Variants and connections

- Neighbouring tiles of one terrain alternate a **mirrored layout** (variant 1), so fields never repeat.
- **Rivers** open exactly the edges their neighbours need. The channel is a curve from edge midpoint to edge
  midpoint through the tile centre, so channels meet their neighbours pixel for pixel. The river overwrites the
  border where it crosses an edge.
- **Beaches** flood only the edges that face the lake: water, a foam line, then wet sand.
- Sprites and tufts never stand in water. They are dropped if their base is within reach of a river or shore.

## Terrains

| Terrain | Id | Move | Defense | Sprites |
|---|---|---|---|---|
| Grassland | `grass` | 1 | +0 | small rock, flower |
| Flower meadow | `meadow` | 1 | +0 | flowers ×7, buds ×5, bush |
| Oak grove | `grove` | 2 | +2 | oaks ×2, small oak, berry bush, log, mushroom, flower |
| Pine stand | `pines` | 2 | +2 | pines ×5, small rock |
| Deep forest | `forest` | 3 | +3 | pines ×5, oak, small oaks ×3 |
| Pond | `pond` | 2 | +0 | reeds ×3, lily pad, small rock, flower, bud |
| Lake | `lake` | impassable | +0 | (water only) |
| Boulder field | `rocks` | 2 | +1 | boulders ×2, small rocks ×3, tuft |
| Rolling hills | `hills` | 2 | +1 | hill mounds ×2, small oak, flower, bud |
| Desert | `desert` | 2 | +0 | dunes ×2, cacti ×2, sandstone rock |
| Tundra | `tundra` | 2 | +0 | snowy pines ×3, snowy rock, snow drift |
| Swamp | `swamp` | 3 | +1 | dead trees ×2, reeds ×3, lily pad, mushroom, murky pools |
| River | `river` | 3 | +0 | river channel, bush, flowers, rock, reed, buds |
| Mountains | `mountains` | 4 | +3 | snow-capped peak, small peak, rocks ×2 |
| Beach | `beach` | 1 | +0 | shore water, driftwood, shells ×3, rock, tuft |

## Checks (`node tools/check.js`)

| Check | Rule |
|---|---|
| Tessellation | A 6×6 block of faces has 0 gaps and 0 overlapping pixels |
| Lone pixels | 0 pixels that share a color with none of their 8 neighbours (flower centres, berries and other deliberate 1 px accents excluded) |
| Edge margin | Every sprite base sits at least 2 px inside the face |
| Spill | 0 sprite pixels past the hex side in its lower half, where the tile in front would cut them off |
| River | The world river is continuous from the mountain source to the lake mouth |

## Adding a terrain

1. Add any new sprite as a character grid in `SPR`, with its base point `bx, by`, plus a legend in `LEG` and an
   outline pair in `OUT`.
2. Add the terrain to `BIOMES` with its name, move cost, defense, ground type and sprite placements (base points
   in face coordinates, x 0–31, y 0–27). Add a `BORDER` pair.
3. Run `node tools/check.js`. Fix anything it reports, then run `node tools/export.js`.
