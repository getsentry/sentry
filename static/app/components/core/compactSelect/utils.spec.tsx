import {getMenuWidthForLabels} from './utils';

describe('getMenuWidthForLabels', () => {
  const options = {minWidth: 16, maxWidth: 24, extraWidth: 6};

  it('returns the minimum width when there are no labels', () => {
    expect(getMenuWidthForLabels([], options)).toBe('16em');
  });

  it('returns the minimum width for short labels', () => {
    expect(getMenuWidthForLabels(['app', 'web'], options)).toBe('16em');
  });

  it('grows with the longest label', () => {
    // 20 * 0.6 + 6 = 18
    expect(getMenuWidthForLabels(['short', 'a'.repeat(20)], options)).toBe('18em');
  });

  it('caps the width at the maximum', () => {
    expect(getMenuWidthForLabels(['a'.repeat(100)], options)).toBe('24em');
  });
});
