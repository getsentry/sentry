import {getMenuWidthForLabels} from './utils';

describe('getMenuWidthForLabels', () => {
  it('returns the minimum width when there are no labels', () => {
    expect(getMenuWidthForLabels([])).toBe('22em');
  });

  it('returns the minimum width for short labels', () => {
    expect(getMenuWidthForLabels(['app', 'web'])).toBe('22em');
  });

  it('grows with the longest label', () => {
    // 20 * 0.6 + 12 = 24
    expect(getMenuWidthForLabels(['short', 'a'.repeat(20)])).toBe('24em');
  });

  it('caps the width at the maximum', () => {
    expect(getMenuWidthForLabels(['a'.repeat(100)])).toBe('28em');
  });

  it('accepts custom bounds and extra width', () => {
    const options = {minWidth: 16, maxWidth: 24, extraWidth: 6};
    expect(getMenuWidthForLabels([], options)).toBe('16em');
    // 20 * 0.6 + 6 = 18
    expect(getMenuWidthForLabels(['a'.repeat(20)], options)).toBe('18em');
    expect(getMenuWidthForLabels(['a'.repeat(100)], options)).toBe('24em');
  });
});
