import {replaceCommaSeparatedValue} from 'sentry/components/searchQueryBuilder/tokens/filter/replaceCommaSeparatedValue';

describe('replaceCommaSeparatedValue', function () {
  it('replaces a value without commas', function () {
    expect(replaceCommaSeparatedValue('foo', 3, 'bar')).toBe('bar');
  });

  it('replaces an empty value at end', function () {
    expect(replaceCommaSeparatedValue('foo,', 4, 'bar')).toBe('foo,bar');
  });

  it('replaces an empty value at start', function () {
    expect(replaceCommaSeparatedValue(',foo', 0, 'bar')).toBe('bar,foo');
  });

  it('replaces an empty value in middle', function () {
    expect(replaceCommaSeparatedValue('foo,,baz', 4, 'bar')).toBe('foo,bar,baz');
  });

  it('replaces an non-empty value at end', function () {
    expect(replaceCommaSeparatedValue('foo,abc', 4, 'bar')).toBe('foo,bar');
  });

  it('replaces an non-empty value at start', function () {
    expect(replaceCommaSeparatedValue('abc,foo', 0, 'bar')).toBe('bar,foo');
  });

  it('replaces an non-empty value in middle', function () {
    expect(replaceCommaSeparatedValue('foo,abc,baz', 4, 'bar')).toBe('foo,bar,baz');
  });
});
