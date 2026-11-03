import {getMenuWidthForLabels} from './utils';

describe('getMenuWidthForLabels', () => {
  it('returns the minimum width when there are no labels', () => {
    expect(getMenuWidthForLabels([])).toBe('16em');
  });

  it('grows with the longest label', () => {
    // 20 * 0.6 + 6 = 18
    expect(getMenuWidthForLabels(['short', 'a'.repeat(20)])).toBe('18em');
  });

  it('caps the width at the maximum', () => {
    expect(getMenuWidthForLabels(['a'.repeat(100)])).toBe('24em');
  });

  it('reserves room for trailing actions', () => {
    const options = {hasTrailingActions: true};
    expect(getMenuWidthForLabels([], options)).toBe('22em');
    // 20 * 0.6 + 12 = 24
    expect(getMenuWidthForLabels(['a'.repeat(20)], options)).toBe('24em');
    expect(getMenuWidthForLabels(['a'.repeat(100)], options)).toBe('28em');
  });
});
