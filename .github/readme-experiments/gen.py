import re, pathlib
ICONS = pathlib.Path('/tmp/platformicons/svg')
RAW = 'https://raw.githubusercontent.com/getsentry/platformicons/master/svg'
SDKS = [
 ('JavaScript','javascript','sentry-javascript'),('Electron','electron','sentry-electron'),
 ('React Native','react-native','sentry-react-native'),('Python','python','sentry-python'),
 ('Ruby','ruby','sentry-ruby'),('PHP','php','sentry-php'),('Laravel','laravel','sentry-laravel'),
 ('Go','go','sentry-go'),('Rust','rust','sentry-rust'),('Java / Kotlin','java','sentry-java'),
 ('Apple','apple','sentry-cocoa'),('.NET','dotnet','sentry-dotnet'),('C / C++','cpp','sentry-native'),
 ('Dart / Flutter','flutter','sentry-dart'),('Perl','perl','perl-raven'),('Clojure','clojure','sentry-clj'),
 ('Elixir','elixir','sentry-elixir'),('Unity','unity','sentry-unity'),('Unreal','unreal','sentry-unreal'),
 ('Godot','godot','sentry-godot'),('PowerShell','powershell','sentry-powershell'),
]
gh = lambda r: f'https://github.com/getsentry/{r}'

def inline_icon(icon, x, y, size, prefix):
    s = (ICONS/f'{icon}.svg').read_text()
    s = re.sub(r'<\?xml[^>]*>\s*', '', s)
    s = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}-{m.group(1)}"', s)
    s = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{prefix}-{m.group(1)})', s)
    s = re.sub(r'href="#([^"]+)"', lambda m: f'href="#{prefix}-{m.group(1)}"', s)
    return s.replace('<svg ', f'<svg x="{x}" y="{y}" width="{size}" height="{size}" ', 1)

# 1. inline flow — "flex-wrap" for free
links = '\n'.join(f'  <a href="{gh(r)}"><img src="{RAW}/{i}.svg" width="48" height="48" alt="{n}" title="{n}" /></a>' for n,i,r in SDKS)
pathlib.Path('1-inline-flow.md').write_text(f'''## Official Sentry SDKs

<!-- Inline images wrap like flex-wrap. Zero CSS, works everywhere GitHub renders markdown. -->
<p align="center">
{links}
</p>
''')

# 2. html table
cols = 7
rows = [SDKS[i:i+cols] for i in range(0,len(SDKS),cols)]
tr = '\n'.join('  <tr>\n' + '\n'.join(
    f'    <td align="center" width="110"><a href="{gh(r)}"><img src="{RAW}/{i}.svg" width="40" height="40" alt="" /><br /><sub><b>{n}</b></sub></a></td>'
    for n,i,r in row) + '\n  </tr>' for row in rows)
pathlib.Path('2-table.md').write_text(f'''## Official Sentry SDKs

<!-- Classic table grid. Fixed columns (no wrapping on narrow screens), but labels + links per cell. -->
<table align="center">
{tr}
</table>
''')

# 3. per-SDK SVG tiles with embedded CSS (dark mode), each wrapped in a link
TILE_CSS = '''
  .card { fill: #FFFFFF; stroke: #E0DCE5; }
  .label { fill: #2B2233; font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  @media (prefers-color-scheme: dark) {
    .card { fill: #181225; stroke: #3E3446; }
    .label { fill: #EBE6EF; }
  }
'''
for idx,(n,i,r) in enumerate(SDKS):
    icon = inline_icon(i, 40, 16, 40, i)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100" viewBox="0 0 120 100">
<style>{TILE_CSS}</style>
<rect class="card" x="1" y="1" width="118" height="98" rx="10" />
<defs><clipPath id="r"><rect x="40" y="16" width="40" height="40" rx="8" /></clipPath></defs>
<g class="icon" clip-path="url(#r)">{icon}</g>
<text class="label" x="60" y="80" text-anchor="middle">{n}</text>
</svg>
'''
    pathlib.Path(f'tiles/{i}.svg').write_text(svg)
TILEBASE = 'https://raw.githubusercontent.com/getsentry/sentry/master/.github/sdk-tiles'
tl = '\n'.join(f'  <a href="{gh(r)}"><img src="{TILEBASE}/{i}.svg" width="120" height="100" alt="{n}" /></a>' for n,i,r in SDKS)
pathlib.Path('3-svg-tiles.md').write_text(f'''## Official Sentry SDKs

<!-- One SVG per SDK, committed to .github/sdk-tiles/. Each SVG carries its own <style>:
     prefers-color-scheme swaps the card colors.
     Still wraps like flex-wrap because they're inline <img>s, and every tile is a real link. -->
<p align="center">
{tl}
</p>
''')

# 4. the insane one: a single SVG with <foreignObject> + real CSS flexbox
def inner(i):
    return re.sub(r"^<svg[^>]*>|</svg>\s*$", "", inline_icon(i,0,0,20,"g"+i).strip())
items = '\n'.join('      <div class="sdk"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="ico">%s</svg><span>%s</span></div>' % (inner(i), n) for k,(n,i,r) in enumerate(SDKS))
grid = f'''<svg xmlns="http://www.w3.org/2000/svg" width="880" height="220" viewBox="0 0 880 220">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" class="root">
      <style>
        .root {{ --bg:#FFFFFF; --fg:#2B2233; --muted:#71637E; --line:#E0DCE5; --accent:#6C5FC7;
          box-sizing:border-box; width:880px; height:220px; padding:20px; border-radius:16px;
          background:var(--bg); border:1px solid var(--line);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
          display:flex; flex-wrap:wrap; gap:10px; justify-content:center; align-content:center; }}
        @media (prefers-color-scheme: dark) {{
          .root {{ --bg:#181225; --fg:#EBE6EF; --muted:#A398AE; --line:#3E3446; --accent:#A796F0; }}
        }}
        .sdk {{ display:flex; align-items:center; gap:8px; padding:8px 12px 8px 8px; border-radius:999px;
          border:1px solid var(--line); color:var(--fg); font-size:13px; font-weight:600; }}
        .ico {{ width:24px; height:24px; border-radius:6px; overflow:hidden; flex:none; }}
      </style>
{items}
    </div>
  </foreignObject>
</svg>
'''
pathlib.Path('4-foreignobject-grid.svg').write_text(grid)
pathlib.Path('4-foreignobject-grid.md').write_text('''## Official Sentry SDKs

<!-- One SVG. Inside it: <foreignObject> -> HTML -> real CSS flexbox, custom properties,
     prefers-color-scheme. GitHub can't strip it because it's "just an image".
     Catches: it's an <img>, so no per-SDK links (use an image map? GitHub strips those),
     no text selection, and the layout is fixed-size (scales, doesn't reflow). -->
<p align="center">
  <a href="https://docs.sentry.io/platforms/"><img src="https://raw.githubusercontent.com/getsentry/sentry/master/.github/sdk-grid.svg" width="880" alt="Official Sentry SDKs" /></a>
</p>
''')
