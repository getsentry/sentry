import {getMenuWidthForOptions} from './utils';

function makeOptions(labels: string[], extra: {trailingItems?: React.ReactNode} = {}) {
  return labels.map(label => ({value: label, label, ...extra}));
}

describe('getMenuWidthForOptions', () => {
  it('returns the minimum width when there are no options', () => {
    expect(getMenuWidthForOptions([])).toBe('16em');
  });

  it('grows with the longest label', () => {
    // 20 * 0.6 + 6 = 18
    expect(getMenuWidthForOptions(makeOptions(['short', 'a'.repeat(20)]))).toBe('18em');
  });

  it('caps the width at the maximum', () => {
    expect(getMenuWidthForOptions(makeOptions(['a'.repeat(100)]))).toBe('24em');
  });

  it('prefers textValue over the label', () => {
    expect(
      getMenuWidthForOptions([{value: 'a', label: <span />, textValue: 'a'.repeat(20)}])
    ).toBe('18em');
  });

  it('reserves room for trailing items', () => {
    const trailing = {trailingItems: <span />};
    expect(getMenuWidthForOptions(makeOptions(['short'], trailing))).toBe('22em');
    // 20 * 0.6 + 12 = 24
    expect(getMenuWidthForOptions(makeOptions(['a'.repeat(20)], trailing))).toBe('24em');
    expect(getMenuWidthForOptions(makeOptions(['a'.repeat(100)], trailing))).toBe('28em');
  });
});
