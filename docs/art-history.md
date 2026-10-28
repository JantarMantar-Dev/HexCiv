# How the HexCiv art style was found

Each step is kept runnable in `archive/`. Rebuild any page with `python3 archive/<step>/build.py`, then open its
`.html` file.

## 1. Verdant Isle (`archive/1-verdant-isle`)

Five pointy-top hexes on a floating island over a valley, built from Slynyrd's *Pixelblog 62: Landscape
Backgrounds*: a 16-color palette, depth through color (near is saturated, far is lighter and bluer), two mountain
layers with a haze band, and grass as 1 px vertical streaks. The page shows the scene build step by step, a per-tile
"how it was built" view with eight layers, and a critique of each tile ("is the grove a grove?"). `design.md` is
the original plan.

**Learned:** the palette and light direction worked. Procedural noise in the foliage did not: crowns looked
speckled and details landed in the wrong places.

## 2. Fifteen styles (`archive/2-grove-styles`)

The Grove tile re-read under fifteen rule sets: hardware palettes (Game Boy, NES, PICO-8, C64, ZX Spectrum, CGA),
1-bit, and genre looks.

**Learned:** palette swaps don't fix drawing errors. The problems were in the shapes, not the colors.

## 3. Grove redraw (`archive/3-grove-redraw`)

The Grove drawn six ways with different techniques, scored by automatic metrics (stray pixels, sprites off the
tile, details covering trees, visible rim). **Leafy Cluster** won and became the house style: clumped crowns each
shaded on their own, 2 px leaf highlights, a selective outline, hand-placed details, and zero stray pixels.

## 4. Clover Patch grid (`archive/4-strategy-map`)

The tiles were moved onto The Clover Patch's flat-top 32×28 grid with colored borders and hand-drawn sprites. A
second style, a dark top-down strategy map with fog of war and a move range, was built from a reference
screenshot. The map then grew to 176 tiles and 15 terrains.

**Decision:** HexCiv uses the **bright tiles** only for now. The strategy-map renderer is kept in the archive.

## 5. HexCiv (`src/`)

The bright-tile engine with the strategy style removed, plus PNG export, CI art checks and this documentation.

## 6. Prototype v1 (`archive/5-prototype-v1`)

The first playable game on the clean Verdant Reach map: worker assignment, upkeep, seasons, contracts and the tech
tree. Frozen as version 1 when the design moved to a ruined valley, where the map and art have to show the damage
and the healing on their own.
