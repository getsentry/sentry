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

- Vertical metrics: no adjustment
- Opentype features: keep all features
