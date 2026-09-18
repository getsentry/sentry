import {
  CHART_PALETTE_OPTIONS,
  getCustomPalette,
} from 'sentry/views/dashboards/utils/chartPalettes';

describe('getCustomPalette', () => {
  it('returns nothing for the default palette so the theme palette is used', () => {
    expect(getCustomPalette(undefined)).toBeUndefined();
    expect(getCustomPalette('default')).toBeUndefined();
  });

  it('falls back to the theme palette for an unknown id', () => {
    expect(getCustomPalette('not-a-palette')).toBeUndefined();
  });

  it('resolves every selectable palette', () => {
    for (const option of CHART_PALETTE_OPTIONS) {
      if (option.id === 'default') {
        continue;
      }
      expect(getCustomPalette(option.id)).toEqual(option.colors);
    }
  });
});
