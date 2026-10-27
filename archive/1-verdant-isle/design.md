# Verdant Isle: 5-hex lush green scene (design plan)

Built from the techniques in Slynyrd's *Pixelblog 62: Landscape Backgrounds*.

## Tutorial takeaways we apply
| Tutorial rule | How it shows up here |
|---|---|
| Fix a console-friendly 4:3 canvas first | 256x192 px (4:3, fits a 256x224 console screen), shown at integer scale |
| Hard 16-color cap, reuse colors across layers | Exactly 16 colors. Sky top = water, sky mist = haze = far mountain body, far mountain shadow = sky top |
| Start with flat horizon bars, then split into bands | Build step 1 is flat bars; step 2 splits sky and valley into bands joined by linear streak texture |
| Depth through color: near = saturated + contrasty, far = lighter, bluer, flatter | Island greens are the warmest and most contrasty; valley planes use sage and blue-green; mountains go blue |
| Hue shift toward the sky with distance | Grass ramp runs teal shadow → green → lime → warm yellow; the far planes take sage and mist |
| Two mountain layers, near one darker/bluer than grass, haze band at its foot | Far range in mist/sky blue, near range in dense blue-green with tree bumps, mist band blending into the valley |
| Grass = 1px vertical streaks; scale by distance | Front-row hexes get 3-4px blades, back row 1-2px clusters, the valley gets no blades |
| Consistency in clustering and scale | Value-noise patches drive every texture, so streaks clump the same way everywhere |
| Clouds in layers, nearest has most contrast; far clouds baked into the gradient | One puffy near layer among the mountains (drifts), far clouds as horizontal streaks in the sky bands |
| Shadows are a darker, bluer shift of the local hue | Every ramp darkens into teal-navy, never black; rock shadows lean blue |
| Each pixel should read clearly | No outlines except selective dark rims on the shadow side of props |
| CRT filter at 4x | Optional CRT toggle (scanlines + slight chromatic fringe) |

## Palette (16)
`deep #1a3445` · `pine #23584c` · `leaf #2f7d46` · `grass #56a43c` · `lime #9bcb3e` · `glow #e6e773` · `sage #7fb39a` · `bark #3f2b31` · `soil #77513c` · `clay #b57f52` · `stone #5f6e8a` · `pale #a3b5c4` · `sky #5f9edd` · `mist #a9d5f0` · `cloud #f4f6ea` · `rose #e8587d`

Light comes from the upper left. Lit sides step up the green ramp toward glow; shadow sides step down toward deep.

## Composition
A floating island of 5 pointy-top hexes, 2 in the back row and 3 in front, over a valley backdrop.

```
      [A Grove] [B Pines]
  [C Pond] [D Meadow] [E Rocks]
```

| Hex | Theme | Props |
|---|---|---|
| A Grove (back left) | Broadleaf trees | 2 round-canopy oaks made of leaf clumps, cast shadows to lower right, fallen-leaf flecks |
| B Pines (back right) | Conifer stand | 3 pines of different heights, ferns at their feet |
| C Pond (front left) | Water | Sky-reflecting pond, lily pads with one bloom, cattails, a waterfall spilling off the island edge |
| D Meadow (front middle) | Wildflowers | Dense rose/white/yellow flower clusters, a dirt path leading to the back row, a butterfly |
| E Rocks (front right) | Mossy boulders | 3 boulders with moss caps, a berry bush, red-cap mushrooms |

Island sides: grass lip overhang, dark topsoil, soil strata with clay on the sunlit faces, pebbles, roots and hanging vines, a rocky underside tapering to a point.

## Layers (back to front), also the build steps in the page
1. Horizon bars
2. Sky and valley bands with streak blending (far clouds baked in)
3. Far mountain range
4. Near forested range + haze band
5. Near clouds (drift)
6. Valley texture and distant tree clumps
7. Island body (walls, underside, vines, waterfall)
8. Hex tops with grass streaks and seams
9. Props sorted by depth
10. Ambient: water shimmer, butterfly, birds

## v2 critique pass (each tile reviewed on its own)
| Tile | Question | Before | Fix |
|---|---|---|---|
| A Grove | Is it a grove? | Fail: 2 trees on a lawn | 5 oaks of varied size, shared shaded floor, undergrowth, fallen log |
| A Grove | Do trees look like trees? | Partial: cloned crowns | per-tree crown width/lean, branch forks and gaps, outlines |
| B Pines | Pines read as pines? | Partial: thin, no trunks | fuller drooping tiers, trunks, outlines |
| B Pines | A stand? | Fail: 4 trees + shrub | 6 conifers on a needle-dark floor |
| B Pines | Ferns readable? | Fail: squiggles | arched fronds with leaflets |
| C Pond | Cattails visible? | Fail | taller, 4px heads, blade, outline; bank stones added |
| D Meadow | Flowers read as flowers? | Fail: confetti | poppy, daisy, buttercup, lupine on stems; one kind per clump |
| D Meadow | Path reads? | Partial | wider, clay center, smoother edge |
| E Rocks | Boulders read as rock? | Fail: eggs | angular polygon, flat facets, top plane, crack |
| E Rocks | Mushrooms/berries? | Fail: specks | 7px caps with spots, berry pairs with glints |
| All | Layers match final? | Partial | front tiles keep their real underside slice in every step |
| All | Grass competes with props? | Fail | patch-clumped streaks, 1px prop outlines |
