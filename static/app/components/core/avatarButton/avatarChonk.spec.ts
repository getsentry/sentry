import {getAvatarChonk, MIN_EDGE_STEP} from './avatarChonk';
import {hexToOklch} from './oklch';

describe('getAvatarChonk', () => {
  it('steps the color darker in light mode, keeping the hue', () => {
    expect(getAvatarChonk('#635bff', 'light')).toBe('#452bd1');
  });

  it('uses a deep shade of the same hue in dark mode', () => {
    expect(getAvatarChonk('#635bff', 'dark')).toBe('#0e093a');
  });

  it('keeps dark-mode oranges orange-brown instead of clipping to red', () => {
    // Orange at L 0.19 can't hold chroma 0.09 in sRGB. Browser clipping would
    // give #300000; lowering chroma keeps the hue, like the warning chonk.
    expect(getAvatarChonk('#e66000', 'dark')).toBe('#270900');
    expect(getAvatarChonk('#ff9500', 'dark')).toBe('#210e00');
  });

  it('stays darker than the bottom edge of a full-bleed image', () => {
    // A purple gradient that darkens toward the bottom, like the Sentry logo.
    const chonk = getAvatarChonk('#53289b', 'light', '#33196f')!;
    expect(hexToOklch(chonk).l).toBeLessThanOrEqual(
      hexToOklch('#33196f').l - MIN_EDGE_STEP + 0.01
    );
    expect(hexToOklch(chonk).h).toBeCloseTo(hexToOklch('#53289b').h, -1);
  });

  it('ignores an edge that is already lighter than the chonk', () => {
    expect(getAvatarChonk('#635bff', 'light', '#ffffff')).toBe(
      getAvatarChonk('#635bff', 'light')
    );
  });

  it('keeps the default chonk for neutral colors', () => {
    expect(getAvatarChonk('#000000', 'light')).toBeUndefined();
    expect(getAvatarChonk('#ffffff', 'dark')).toBeUndefined();
  });
});
