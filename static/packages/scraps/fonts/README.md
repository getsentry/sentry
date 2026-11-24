# Web fonts

Sentry ships variable WOFF2 subsets of [Rubik and Roboto Mono from Google Fonts](https://github.com/google/fonts) under the [SIL Open Font License](OFL.txt).

| Family      | Source at the pinned Google Fonts commit                   | Shipped weight axis |
| ----------- | ---------------------------------------------------------- | ------------------- |
| Rubik       | `ofl/rubik/Rubik[wght].ttf` v2.300 at `765b99f8`           | 400–500             |
| Roboto Mono | `ofl/robotomono/RobotoMono[wght].ttf` v3.001 at `b0108645` | 425–600             |

## Browser layout and fallbacks

[The shared font stylesheet](../fonts.css) defines the Unicode subsets and uses `font-display: swap` for both families. The [visual snapshot renderer](../../../../tests/js/sentry-test/snapshots/snapshot.ts) loads these same rules and embeds the local WOFF2 files.

Both families use a 0.935em ascent, a 0.23em descent, and a zero line gap. Roboto Mono is scaled to Rubik’s 0.7em cap height, which brings the x-heights within 0.0002em. When changing `size-adjust`, divide the target ascent and descent by the scale factor to compute the overrides.

Keep the calibrated fallback names ahead of the raw system fonts in [the Scraps theme](../src/theme/theme.tsx) and [legacy stacks](../../../css/variables.css). Adjusted Andale Mono and Courier New match Roboto Mono’s line metrics and cell advance. Adjusted Arial matches Rubik’s line metrics and approximates the width of representative Latin UI text. Individual glyph shapes still change at swap. Proportional widths and wrapping can also change.

## Rebuilding the assets

1. Use `fonttools varLib.instancer` to restrict the weight axes to the ranges above. Keep Rubik’s CSS range at `400 600` so a request for 600 uses the heaviest available instance without synthetic bold.
2. Preserve the vertical metrics below for browsers that read them from the font. Set the line gaps to zero and enable `USE_TYPO_METRICS`.

   | Family      | Units per em | Windows ascent / descent | Typographic ascent / descent | Horizontal header ascent / descent |
   | ----------- | -----------: | -----------------------: | ---------------------------: | ---------------------------------: |
   | Rubik       |         1000 |                840 / 250 |                   840 / −250 |                         935 / −230 |
   | Roboto Mono |         2048 |               1720 / 512 |                  1720 / −512 |                        1915 / −471 |

3. In Rubik, map U+2010–U+2012 to hyphen and U+000D to space. Add blank glyphs for U+2000–U+200A, U+202F, and U+205F at their intended advances. The figure space matches a digit and the punctuation space matches a period. Give the blank glyphs `gvar` entries and map their `HVAR` advances to an empty delta set.
4. Build one WOFF2 per Unicode range with `fonttools subset --no-hinting --flavor=woff2`. Keep Rubik’s layout features with `--layout-features='*'`.
5. Check that each subset retains its characters and that shaping, advances, and kerning match the previous build. Use the same text in both builds when comparing with HarfBuzz.
