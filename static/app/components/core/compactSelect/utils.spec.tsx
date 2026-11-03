import {getMenuWidthForLabels} from './utils';

describe('getMenuWidthForLabels', () => {
  const options = {extraEm: 12, minEm: 22, maxEm: 28};

  it('returns the minimum width when there are no labels', () => {
    expect(getMenuWidthForLabels([], options)).toBe('22em');
  });

  it('returns the minimum width for short labels', () => {
    expect(getMenuWidthForLabels(['app', 'web'], options)).toBe('22em');
  });

  it('grows with the longest label', () => {
    // 20 * 0.6 + 12 = 24
    expect(getMenuWidthForLabels(['short', 'a'.repeat(20)], options)).toBe('24em');
  });

  it('caps the width at the maximum', () => {
    expect(getMenuWidthForLabels(['a'.repeat(100)], options)).toBe('28em');
  });

  it('respects the extra width', () => {
    // 30 * 0.6 + 8 = 26
    expect(getMenuWidthForLabels(['a'.repeat(30)], {...options, extraEm: 8})).toBe(
      '26em'
    );
  });
});
