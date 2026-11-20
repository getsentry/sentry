import {hexToOklch, hexToRgb, isNeutral, oklchToHex} from './color';

describe('oklch', () => {
  it('round-trips sRGB colors', () => {
    for (const hex of ['#635bff', '#e66000', '#2b9a3e', '#000000', '#ffffff']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('reads three-digit hex colors as their six-digit form', () => {
    expect(hexToOklch('#fff')).toEqual(hexToOklch('#ffffff'));
    expect(hexToOklch('#63f')).toEqual(hexToOklch('#6633ff'));
  });

  it('lowers chroma for out-of-gamut colors instead of clipping channels', () => {
    // Clipping each channel would turn this dark orange into #300000.
    expect(oklchToHex({l: 0.19, c: 0.09, h: 45})).toBe('#270900');
  });
});

describe('hexToRgb', () => {
  it('expands three-digit hex colors', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#63f')).toEqual([102, 51, 255]);
  });
});

describe('isNeutral', () => {
  it('treats grays, black and white as neutral', () => {
    expect(isNeutral([0, 0, 0])).toBe(true);
    expect(isNeutral([255, 255, 255])).toBe(true);
    expect(isNeutral([128, 128, 128])).toBe(true);
  });

  it('treats saturated colors as colored', () => {
    expect(isNeutral([99, 91, 255])).toBe(false);
  });
});
