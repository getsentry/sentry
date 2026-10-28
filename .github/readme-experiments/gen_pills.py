import pathlib, re
from PIL import ImageFont
exec(open('gen.py').read().split('# 1. inline flow')[0])  # SDKS, inline_icon, gh
f = ImageFont.truetype('/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf', 13)
try: f.set_variation_by_axes([600])
except Exception as e: print('var', e)
CSS = '''
  .pill { fill: #FFFFFF; stroke: #E0DCE5; }
  .label { fill: #2B2233; font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  @media (prefers-color-scheme: dark) {
    .pill { fill: #181225; stroke: #3E3446; }
    .label { fill: #EBE6EF; }
  }
'''
H = 40
for n, i, r in SDKS:
    tw = f.getlength(n) * 1.06
    w = round(8 + 24 + 8 + tw + 14)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{H}" viewBox="0 0 {w} {H}">
<style>{CSS}</style>
<rect class="pill" x="0.5" y="0.5" width="{w-1}" height="{H-1}" rx="{(H-1)/2}" />
<defs><clipPath id="r"><rect x="8" y="8" width="24" height="24" rx="6" /></clipPath></defs>
<g clip-path="url(#r)">{inline_icon(i, 8, 8, 24, i)}</g>
<text class="label" x="40" y="24.5">{n}</text>
</svg>
'''
    pathlib.Path(f'pills/{i}.svg').write_text(svg)
links = '\n'.join(f'  <a href="{gh(r)}"><img src="pills/{i}.svg" height="40" alt="{n}" /></a>' for n, i, r in SDKS)
pathlib.Path('5-pills.md').write_text(f'''## 5. Option 4's look, sliced into one SVG per pill (real links, reflows)

<p align="center">
{links}
</p>
''')
