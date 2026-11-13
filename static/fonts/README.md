# Fonts

Rubik and Roboto Mono are built from the [google/fonts](https://github.com/google/fonts) variable fonts with fontTools (not on our internal PyPI, use a throwaway venv). Keep these modifications when rebuilding:

| Font        | Upstream (google/fonts commit)                           | `wght` axis |
| ----------- | -------------------------------------------------------- | ----------- |
| Rubik       | `ofl/rubik/Rubik[wght].ttf` 2.300 (`765b99f8`)           | 400–500     |
| Roboto Mono | `ofl/robotomono/RobotoMono[wght].ttf` 3.001 (`b0108645`) | 425–600     |

- **Axis:** limit with `fonttools varLib.instancer`. Rubik's `@font-face` declares `400 600` so 600 renders at 500, not a synthesized bold.
- **Vertical metrics:** kept from older Rubik releases to preserve the current layout (#30946). Rubik (1000 UPM): win 840/250, typo 840/-250, hhea 935/-230, line gaps 0, `USE_TYPO_METRICS` on. Roboto Mono gets the same values in em (2048 UPM: win 1720/512, typo 1720/-512, hhea 1915/-471) so mono text centers and sizes like Rubik. Chrome and Firefox use `typo`, Safari likely uses `hhea`, so Safari's line box differs slightly. Upstream metrics are consistent across browsers but change layout.
- **Rubik missing characters:** upstream lacks typographic spaces and hyphen variants. Map U+2010–2012 to the hyphen glyph and U+000D to space. Add empty glyphs for U+2000–200A, U+202F and U+205F at their Unicode widths (figure space = digit width, punctuation space = period width). They need `gvar` entries and `HVAR` advance mappings to an empty delta set.
- **Subsets:** one WOFF2 per unicode range. Use `fonttools subset --no-hinting --flavor=woff2`, with `--layout-features='*'` for Rubik (tabular numbers etc.).
- **References:** `static/css/fonts.css` (`@font-face` rules and unicode ranges) and `tests/js/sentry-test/snapshots/snapshot.ts` (visual snapshot fonts) both point at these files.
- **Verify:** no characters lost per range, and advances/kerning match the previous files (e.g. shape with HarfBuzz).

`sentry-simple.woff2` is the legacy icon font, not built this way. Its `.eot`, `.svg`, `.ttf` and `.woff` versions aren't loaded and are kept for reference.
