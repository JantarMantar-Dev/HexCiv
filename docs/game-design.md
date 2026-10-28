# HexCiv: game concept (draft)

**Pitch:** a management game that grows into a factory. You place workers on hex tiles, they walk the land to
chop, fish and haul, and you end with a valley that runs itself, while the land remembers what you did to it.

## Pillars

1. **You manage, workers do.** The player never gathers by hand. Tap a tile, assign workers to it, and they do the
   work. Gold buys more workers, and tech makes them better at it. The game is about placing and planning.
2. **The land is the factory.** Production changes the tiles themselves. Chopping a forest wears it down to
   grassland, and quarrying a boulder field leaves bare ground. Every choice is visible and permanent.
3. **Distance is the cost.** Workers walk, and terrain move costs decide how long each trip takes. Where you put a
   building matters more than how many you build. Later, the river carries goods for free.
4. **Seasons set the rhythm.** The year is the clock. Each season changes how fast workers walk and how the river
   flows, so play has a yearly plan: grow, stock up, survive winter.

## Where play starts

The map is covered in fog except for the river valley. The player has a dock on the lake at the river mouth, a
little gold, and nothing else. Pines stand near the river's upper bend.

1. One worker waits at the dock. Tap a pine tile and assign them as a lumberjack.
2. The lumberjack walks there, chops, and carries each log to the dock, where it sells. That earns the first gold.
3. Gold hires more workers. Assign them to more forests, or to a beach to fish for food.

## Core loop

1. **Make:** assign workers to a tile: lumberjacks on forests, fishers on beaches and ponds.
2. **Move:** workers carry goods along the hexes; later, logs float down the river.
3. **Sell:** goods sold at the dock earn gold.
4. **Spend:** gold buys workers, buildings and tech.
5. **Reveal:** dock contracts pay a bonus and lift the fog, showing new land and terrains.

## Workers

- Hired with gold at the dock. Each worker is assigned to one tile, and the tile decides the job: chop, fish,
  later quarry, mine or farm. Each tile has a few slots (3 lumberjacks, 2 fishers). Unassigned workers wait at the
  dock. When a forest is cut out, its lumberjacks move to standing forest nearby, or go idle.
- Workers walk tile to tile. A tile's move cost is the time it takes to cross it (grass 1, forest 2, swamp 3,
  mountains 4). Lakes are impassable.
- A worker carries one item at a time until carrying tech upgrades it.
- **Upkeep:** every worker costs gold and food each season. A worker who is not paid or fed works at half speed until
  they are, so the valley slows down instead of locking up. Upkeep caps how fast the player can grow, and food
  is what makes fishers, and later farms, matter.
- The player starts with one worker, so the first thing they do is give someone a job.

## Tech tree

Tech is bought with gold, idle-game style. Each branch starts with a manual step, then a worker, then an upgrade
that automates it.

| Branch | Unlocks (in order) |
|---|---|
| Lumber | Chop by click, haulers, axes (workers chop), sawmill (log → plank), log rafting |
| Stone | Quarry boulder fields by click, pickaxes, stonecutter (stone → block), roads |
| Mining | Mines on mountains, ore and coal, smelter (ore + coal → metal), tools that speed every worker |
| Food | Fishing at the beach, berries and mushrooms from groves, smokehouse for winter stock |
| Farms | Fields on grassland and meadow, wheat, mill, bakery, beehives |

Lumber comes first. Stone, mining, food and farms follow, in the order the fog reveals their terrains. Food and
farms become urgent as soon as workers need feeding.

**Log rafting** is the first big automation step. Logs dropped into the river float to the dock for free, so a
camp on the river replaces a long walk. It keeps the old core idea, water as a conveyor, as an upgrade rather than
a rule.

## Seasons

| Season | Effect |
|---|---|
| Spring | Melt speeds up the river; rafting is fastest. Upkeep is due. |
| Summer | Normal speed. Farms grow. |
| Autumn | Harvest. Food stock is filled for winter. |
| Winter | The river freezes, so rafting stops. Snow slows walking. Farms produce nothing, so workers eat from stock. |

The yearly puzzle is to stock enough food and gold before winter to keep every worker paid and fed.

## What each terrain is for

| Terrain | Role |
|---|---|
| Pine stand, deep forest | Softwood logs |
| Oak grove | Hardwood logs; berries and mushrooms for food |
| Boulder field, hills | Stone |
| Mountains | Ore and coal; the river's source |
| River | Log rafting; watermills later |
| Grassland, meadow | Farms, beehives |
| Pond, beach | Fishing; the dock |
| Swamp | Peat for fuel; slow to cross |
| Desert | Sand for glass, later |
| Tundra | Furs; freezes first in winter |
| Lake | Impassable; holds the dock |

## The land remembers

- Chopping wears a forest down: deep forest → pine stand → grassland. Left alone outside winter, cut land grows
  back one stage at a time; the Forestry tech doubles the speed.
- Quarrying wears a boulder field down to grassland.
- Too much clearing near the river dries the soil, and desert spreads. This is a late-game pressure, not part of the
  first prototype.

## Prototype version 2: Restore the Valley

`play.html` now plays the ruined Verdant Reach. The valley starts grey: stump fields, deadwood, dust fields, a dirty
river behind an old dam, a dry riverbed, a drained marsh, and rot creeping down from a leaking mine. Only the dock
and a few tiles around it are alive.

- **No goal text.** The map shows what is wrong. Living tiles are in colour and move (glints, birds, smoke from the
  hut); ruined tiles are faded and still. Notices only report what already happened.
- **Land costs gold.** You own the dock and six hexes. Tap a hex next to your border to buy it; ruined land is
  cheap and living land is dear. You see two hexes past your border.
- **Workers can die** of hunger, cold (no logs in winter), rot sickness, or the spring flood around the marsh. Each
  death leaves a grave and a notice saying who and why. The run ends when the last one dies.
- **Jobs heal the land:** clear deadwood for logs, plant saplings, compost dust, burn rot, filter the river, fish and
  farm. Cut a living forest to its last log and it turns to stumps.
- **Rot** spreads one tile a season outside winter, from the mine through every rot tile still joined to it. A living
  forest or a clean river holds it for a season.
- **Tech:** Fishing nets, Axes, Saplings, Compost, Reed filters, Forestry and Farms. Dam breaking, Quarrying,
  Re-wetting, Log rafting and Mine sealing are on the tree as coming later.

## First prototype (version 1)

Frozen in `archive/5-prototype-v1/`. The design has since moved to *Restore the Valley*: the valley starts ruined,
there is no goal text, the run ends when the crew dies, and gold buys land. Version 2 gets a new ruined map.


The Verdant Reach map with fog, played full screen with a game HUD: resources on the left, menu, tech tree and hiring
on the right, and a main menu that resumes a saved game. Tap a tile to open its panel and assign lumberjacks or
fishers, pay upkeep in gold and food, and buy Axes, Fishing nets, Baskets, Sawmill, Forestry and Log rafting from
the tech tree. Win by filling one dock contract before the first winter. Stone, Mining and Farms show on the tree as coming
later.

Move costs in `src/tiles.js` become walking times. Defense values are left over from the map viewer and will be
removed or reused.
