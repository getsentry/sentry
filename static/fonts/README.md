# Fonts

Rubik and Roboto Mono are built from the [google/fonts](https://github.com/google/fonts) variable fonts with fontTools. Keep these modifications when rebuilding:

| Font        | Upstream                                    | `wght` axis |
| ----------- | ------------------------------------------- | ----------- |
| Rubik       | `ofl/rubik/Rubik[wght].ttf` 2.300           | 400–500     |
| Roboto Mono | `ofl/robotomono/RobotoMono[wght].ttf` 3.001 | 425–600     |

- **Axis:** limit with `fonttools varLib.instancer`. Rubik's `@font-face` declares `400 600` so 600 renders at 500, not a synthesized bold.
- **Rubik vertical metrics:** win 840/250, typo 840/-250, hhea 935/-230, line gaps 0, `USE_TYPO_METRICS` on. Roboto Mono keeps upstream metrics.
- **Rubik missing characters:** upstream lacks typographic spaces and hyphen variants. Map U+2010–2012 to the hyphen glyph and U+000D to space. Add empty glyphs for U+2000–200A, U+202F and U+205F at their Unicode widths (figure space = digit width, punctuation space = period width). They need `gvar` entries and `HVAR` advance mappings to an empty delta set.
- **Subsets:** one WOFF2 per unicode range, matching the `@font-face` rules in `static/less/fonts.less`. Use `fonttools subset --no-hinting --flavor=woff2`, with `--layout-features='*'` for Rubik (tabular numbers etc.).
- **Verify:** no characters lost per range, and advances/kerning match the previous files (e.g. shape with HarfBuzz).

`sentry-simple.woff2` is the legacy icon font, not built this way.
