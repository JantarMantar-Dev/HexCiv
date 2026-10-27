# HexCiv: game concept (draft)

**Pitch:** a factory game where you build with terrain and water, and the land remembers what you did.

## Why it is different

Most automation games put machines and belts on top of a map. HexCiv makes three core rules different.

1. **The land is the factory.** Production changes the tiles themselves. Cutting a forest turns it into grassland,
   irrigating desert turns it into meadow, and damming the river floods tiles into a lake. Your factory is the shape
   of the landscape, so every choice is visible and permanent.
2. **Water is the only conveyor.** Goods float downstream. You dig channels hex by hex to route them, and because
   water only runs downhill from the peaks, the mountains are your power and logistics source. The river layout is
   the puzzle.
3. **Push too hard and the land pushes back.** Clear too much forest and the soil dries, so desert spreads. Drain the
   swamp and the river floods downstream. Tundra freezes the river in winter. The goal is a valley that sustains
   itself, not maximum output.

## What each terrain is for

| Terrain | Role |
|---|---|
| Forest, oak grove, pine stand | Lumber: softwood from pines, hardwood from oaks |
| Mountains, boulder field | Stone, ore and coal; river sources |
| River | Watermills power adjacent buildings; barges carry goods downstream for free |
| Meadow, grassland | Farms, beehives, flax for cloth |
| Swamp | Peat for fuel, herbs for dyes; costly to build on |
| Desert | Sand for glass, kilns |
| Tundra | Furs, ice for cold storage |
| Beach, lake | Fishing, salt pans, the port that exports finished goods |

## Core loop

1. Place an extractor on a matching tile.
2. Link tiles with roads, cart tracks or channels.
3. Chain production (log → plank → furniture, sand + coal → glass).
4. Ship to the port to fill orders, which reveals new land.

## First prototype

Water as the only conveyor, on the Verdant Reach map: dig channels from the river, float logs from a lumber camp
to a sawmill, and fill one order at the port.

Move costs and defense values in `src/tiles.js` are placeholders from the map viewer and will become build costs.
