import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {severityColor, withAlpha} from './severityColor';

describe('severityColor', () => {
  const opaque = (color: string) => `${color}FF`.toUpperCase();

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('colors drop ratios with the %s magma scale', (_, theme) => {
    const scale = theme.tokens.dataviz.sequential.magma.series5;

    expect(severityColor(0, theme)).toBe(opaque(theme.tokens.background.secondary));
    expect(severityColor(0.001, theme)).toBe(opaque(scale[0]));
    expect(severityColor(0.049, theme)).toBe(opaque(scale[0]));
    expect(severityColor(0.05, theme)).toBe(opaque(scale[1]));
    expect(severityColor(0.1, theme)).toBe(opaque(scale[2]));
    expect(severityColor(0.25, theme)).toBe(opaque(scale[3]));
    expect(severityColor(0.5, theme)).toBe(opaque(scale[4]));
    expect(severityColor(1, theme)).toBe(opaque(scale[4]));
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('returns #RRGGBBAA colors in the %s theme', (_, themeVariant) => {
    for (const ratio of [0, 0.05, 0.1, 0.25, 0.5]) {
      expect(severityColor(ratio, themeVariant)).toMatch(/^#[0-9A-F]{8}$/);
    }
  });
});

describe('withAlpha', () => {
  it('appends an alpha channel to a #RRGGBB color', () => {
    expect(withAlpha('#ff9500', 0.5)).toBe('#FF950080');
  });

  it('replaces the alpha channel of a #RRGGBBAA color', () => {
    expect(withAlpha('#FF9500FF', 0)).toBe('#FF950000');
  });
});
