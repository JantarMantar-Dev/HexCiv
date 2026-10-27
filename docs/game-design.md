# HexCiv: game concept (draft)

**Pitch:** an idle game that grows into a factory. You start by clicking trees, hire workers who walk the hexes,
and end with a valley that runs itself, while the land remembers what you did to it.

## Pillars

1. **Click, then hire, then automate.** Every job starts as a click. Gold buys workers who take that job over, and
   tech makes them better at it. The player moves from doing to placing and planning.
2. **The land is the factory.** Production changes the tiles themselves. Chopping a forest wears it down to
   grassland, and quarrying a boulder field leaves bare ground. Every choice is visible and permanent.
3. **Distance is the cost.** Workers walk, and terrain move costs decide how long each trip takes. Where you put a
   building matters more than how many you build. Later, the river carries goods for free.
4. **Seasons set the rhythm.** The year is the clock. Each season changes how fast workers walk and how the river
   flows, so play has a yearly plan: grow, stock up, survive winter.

## Where play starts

The map is covered in fog except for the river valley. The player has a dock on the lake at the river mouth, a
little gold, and nothing else. Pines stand near the river's upper bend.

1. Click a pine tile to chop. A log drops on that tile.
2. Click the log to carry it to the dock and sell it. That earns the first gold.
3. The first gold hires a hauler, who walks to logs you chopped and carries them to the dock.

From that point the player only clicks to chop, and the first tech (axes) takes that job over too.

## Core loop

1. **Make:** click or assign workers to gather on a tile.
2. **Move:** workers carry goods along the hexes; later, logs float down the river.
3. **Sell:** goods sold at the dock earn gold.
4. **Spend:** gold buys workers, buildings and tech.
5. **Reveal:** dock contracts pay a bonus and lift the fog, showing new land and terrains.

## Workers

- Hired with gold at the dock. Each worker has one job: haul, chop, quarry, mine, farm.
- Workers walk tile to tile. A tile's move cost is the time it takes to cross it (grass 1, forest 2, swamp 3,
  mountains 4). Lakes are impassable.
- A worker carries one item at a time until carrying tech upgrades it.
- **Upkeep:** every worker costs gold and food each season. A worker who is not paid or fed stops working until
  they are. Upkeep caps how fast the player can grow, and food is what makes Fishing, and later Farms, matter.
- The player starts with one worker, so hauling is visible from the first click.

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

## First prototype

The Verdant Reach map with fog, played full screen with a game HUD: resources on the left, menu, tech tree and hiring
on the right, and a main menu that resumes a saved game. Click to chop, let the starting worker haul logs to the
dock, pay upkeep in gold and food, and buy Axes, Fishing, Baskets, Sawmill, Forestry and Log rafting from the tech
tree. Win by filling one dock contract before the first winter. Stone, Mining and Farms show on the tree as coming
later.

Move costs in `src/tiles.js` become walking times. Defense values are left over from the map viewer and will be
removed or reused.
