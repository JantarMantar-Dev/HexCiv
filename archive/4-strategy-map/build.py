import pathlib
d = pathlib.Path(__file__).parent
t = (d / 'page.template.html').read_text()
(d / 'verdant-hex-tiles.html').write_text(t.replace('/*TILES*/', (d / 'hextiles.js').read_text()))
print('built')
