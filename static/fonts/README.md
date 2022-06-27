# Notes

The fonts in this folder have been optimized for web rendering. There are two notable modifications: vertical metrics and file size. Before making any changes to these files, ensure that the metrics are correct and the files are properly minimized.

## Vertical metrics

For historical reasons, font files include three different sets of metrics (`win`, `typo`, and `hhea`). These metrics have been modified to standardize rendering across operating systems and browsers.

The modified metrics are:

- `win` ascent: 840
- `win` descent: 250
- `typo` ascent: 840
- `typo` descent: -250
- `hhea` ascent: 935
- `hhea` descent: -230

## File size

These files have been reprocessed using [FontSquirrel's Webfont Generator](https://www.fontsquirrel.com/tools/webfont-generator) to reduce their size. Note that the default Optimal option will remove certain useful font features and settings. Before processing, select the Expert option, and change the following:

- **Vertical metrics:** no adjustment
- **Opentype features:** keep all features
- **Subsetting:** custom subsetting – read more below

### Subsetting

Subsetting narrows the list of glyphs (characters) included in the exported font files. We split our fonts into files with different glyph sets, each defined by a [unicode range](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range). This way, we can serve only the files with the glyphs that the user needs. If the page contains only latin characters, then the browser will only download the file with latin glyphs (e.g. `/rubik-regular-latin.woff2`). But if the page also has cyrillic text, then the browser will additionally download the file with cyrillic glyphs (e.g. `/rubik-regular-cyrillic.woff2`). This split reduces the total font loading time, since only the relevant glyph sets are downloaded.

We support four glyph sets: `latin`, `latin-ext`, `cyrillic`, and `cyrillic-ext`. The unicode ranges for each of these sets can be found in [Google Fonts' Rubik stylesheet](https://fonts.googleapis.com/css2?family=Rubik&display=swap). In FontSquirrel's Webfont Generator, copy and paste these ranges into Subsetting -> Custom Subsetting -> Unicode Ranges. Once everything has been exported, check that each file contains the correct glyphs using [FontDrop](https://fontdrop.info/).
