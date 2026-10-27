# Inline scene.js and redraw.js into the page template -> grove-redraw.html.
import pathlib
d = pathlib.Path(__file__).parent
t = (d / 'page.template.html').read_text().replace('/*SCENE*/', (d.parent / '1-verdant-isle' / 'scene.js').read_text()).replace('/*REDRAW*/', (d / 'redraw.js').read_text())
(d / 'grove-redraw.html').write_text(t)
print(len(t))
