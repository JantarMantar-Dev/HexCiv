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

## Prototype version 3: Healing the Land

`play.html` now plays the staged healing and management design from the "Healing the Land" doc. v2 is frozen in
`archive/6-prototype-v2`.

- **Tile values.** Every land tile has soil (Hard, Firm, Loose), food (Dead, Poor, Fed, Rich), water (Dry, Damp, Wet)
  and a cover (bare, seedlings, young wood, pines, forest, grove, clover, grass, meadow). The art shows them: cracks on
  hard soil, furrows on loose soil, mulch spots once the soil is fed, yellowing leaves when a tile dries out.
- **Plans, not postings.** The player gives a tile a plan (Forest, Field, Rest; Heal marsh and Clean river on water
  tiles) and a priority. The tile panel shows the plan's steps as chips; the current one is outlined, and a stuck tile
  says why: wrong season, missing tech, no stock at the dock, or no one in the crew. Drag from a planned tile to paint
  the same plan.
- **Crews.** Workers join one of four crews: land, water carriers, woodcutters, fishers and farmers. Each crew picks its
  own work by priority and distance. Water carriers help the land crew outside summer; the land crew cuts firewood in
  winter. Workers get a star of skill for every 150 seconds in a crew, up to three.
- **Seasons gate the steps.** Planting and sowing happen in spring and autumn, nothing grows in winter, and summer dries
  the land one level every 45 seconds. Plants left dry for 40 seconds die, so a forest plan needs water carriers.
  Seedlings take 450 growing seconds to become young wood and 900 more to become a pine stand of 20 logs.
- **Forests last, and run out.** Old forest holds 120 logs, pines 60, a grove 50, and a deadwood field 30. Woodcutters
  can be told to cut to the last log, leave a third, or take only deadwood. Wood near the dock runs out in a few years
  unless the player buys more land or plants.
- **The dock.** Keep lines for logs and food: the dock sells everything above them when the trader's boat is in (the
  first 60 seconds of spring, summer and autumn). The boat also sells logs (5g) and food (4g). With the Trade post, the
  dock sells surplus and buys back up to the keep lines on its own. In autumn a notice warns when the woodpile is short
  of what winter will burn.
- **Rot.** The land crew burns rot in spring, summer and autumn. Workers walk around rot where they can, a burning fire
  halves the sickness, and the dock's hearth keeps the crew safe at home.
- **Tech tree.** 21 upgrades in six branches: Soil, Water, Plants, Forest, Clean-up, Food and trade. Dam breaking,
  Quarrying and Mine sealing are shown as coming later.
- **Lenses and the ribbon.** Soil, Food and Water lenses tint the map by that value. The season ribbon shows what each
  season allows, with a marker for now. Space pauses.

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
- **Seasons gate the work:** nothing is planted or composted in frozen winter ground, saplings go in only in spring
  or autumn, and rot burns only in summer and autumn. Growth runs ×1.5 in spring, ×1 in summer, ×0.5 in autumn and
  stops in winter. Saplings take about three growing seasons to become a pine stand.
- **Forests last:** a pine stand holds 60 logs, old forest 120, deadwood 30. A rested stand regrows 5 logs a season,
  old forest cut below a third thins to a pine stand, and a stand cut to its last log becomes stumps.
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
