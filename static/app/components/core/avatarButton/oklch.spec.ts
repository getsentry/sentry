import {hexToOklch, oklchToHex} from './oklch';

describe('oklch', () => {
  it('round-trips sRGB colors', () => {
    for (const hex of ['#635bff', '#e66000', '#2b9a3e', '#000000', '#ffffff']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('lowers chroma for out-of-gamut colors instead of clipping channels', () => {
    // Clipping each channel would turn this dark orange into #300000.
    expect(oklchToHex({l: 0.19, c: 0.09, h: 45})).toBe('#270900');
  });
});
