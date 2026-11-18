import {getAvatarChonk, MIN_DARK_CHONK, MIN_EDGE_STEP} from './avatarChonk';
import {hexToOklch} from './color';

describe('getAvatarChonk', () => {
  it('steps the color darker in light mode, keeping the hue', () => {
    expect(getAvatarChonk('#635bff', 'light', null)).toBe('#452bd1');
  });

  it('uses a deep shade of the same hue in dark mode', () => {
    expect(getAvatarChonk('#635bff', 'dark', null)).toBe('#0e093a');
  });

  it('keeps dark-mode oranges orange-brown instead of clipping to red', () => {
    // Orange at L 0.19 can't hold chroma 0.09 in sRGB. Browser clipping would
    // give #300000; lowering chroma keeps the hue, like the warning chonk.
    expect(getAvatarChonk('#e66000', 'dark', null)).toBe('#270900');
    expect(getAvatarChonk('#ff9500', 'dark', null)).toBe('#210e00');
  });

  it('stays darker than the bottom edge of a full-bleed image', () => {
    const chonk = getAvatarChonk('#635bff', 'light', '#5048e0');
    expect(hexToOklch(chonk).l).toBeLessThanOrEqual(
      hexToOklch('#5048e0').l - MIN_EDGE_STEP + 0.01
    );
    expect(hexToOklch(chonk).h).toBeCloseTo(hexToOklch('#635bff').h, -1);
  });

  it('uses a lighter tint of the hue for dark avatars in light mode', () => {
    // A purple gradient that darkens toward the bottom, like the Sentry logo.
    // Stepping darker would land near black, so the chonk goes lavender.
    const chonk = hexToOklch(getAvatarChonk('#53289b', 'light', '#33196f'));
    expect(chonk.l).toBeGreaterThan(MIN_DARK_CHONK);
    expect(chonk.l).toBeGreaterThanOrEqual(hexToOklch('#53289b').l + MIN_EDGE_STEP);
    expect(chonk.h).toBeCloseTo(hexToOklch('#53289b').h, -1);
  });

  it('ignores an edge that is already lighter than the chonk', () => {
    expect(getAvatarChonk('#635bff', 'light', '#ffffff')).toBe(
      getAvatarChonk('#635bff', 'light', null)
    );
  });
});
