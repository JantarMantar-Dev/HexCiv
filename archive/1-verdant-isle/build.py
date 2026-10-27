# Inline scene.js into the page template -> verdant-isle.html (a single self-contained file).
import pathlib
d = pathlib.Path(__file__).parent
t = (d / 'page.template.html').read_text().replace('/*SCENE*/', (d / 'scene.js').read_text())
(d / 'verdant-isle.html').write_text(t)
print(len(t))
