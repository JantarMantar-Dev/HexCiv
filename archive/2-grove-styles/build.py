# Inline scene.js and styles.js into the page template -> grove-styles.html.
import pathlib
d = pathlib.Path(__file__).parent
t = (d / 'page.template.html').read_text().replace('/*SCENE*/', (d.parent / '1-verdant-isle' / 'scene.js').read_text()).replace('/*STYLES*/', (d / 'styles.js').read_text())
(d / 'grove-styles.html').write_text(t)
print(len(t))
