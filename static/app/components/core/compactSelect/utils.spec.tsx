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
});
