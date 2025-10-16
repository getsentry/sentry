import {replaceCommaSeparatedValue} from 'sentry/components/searchQueryBuilder/tokens/filter/replaceCommaSeparatedValue';

describe('replaceCommaSeparatedValue', () => {
  it('replaces a value without commas', () => {
    expect(replaceCommaSeparatedValue('foo', 3, 'bar')).toBe('bar');
  });

  it('replaces an empty value at end', () => {
    expect(replaceCommaSeparatedValue('foo,', 4, 'bar')).toBe('foo,bar');
  });

  it('replaces an empty value at start', () => {
    expect(replaceCommaSeparatedValue(',foo', 0, 'bar')).toBe('bar,foo');
  });

  it('replaces an empty value in middle', () => {
    expect(replaceCommaSeparatedValue('foo,,baz', 4, 'bar')).toBe('foo,bar,baz');
  });

  it('replaces an non-empty value at end', () => {
    expect(replaceCommaSeparatedValue('foo,abc', 4, 'bar')).toBe('foo,bar');
  });

  it('replaces an non-empty value at start', () => {
    expect(replaceCommaSeparatedValue('abc,foo', 0, 'bar')).toBe('bar,foo');
  });

  it('replaces an non-empty value in middle', () => {
    expect(replaceCommaSeparatedValue('foo,abc,baz', 4, 'bar')).toBe('foo,bar,baz');
  });
});
