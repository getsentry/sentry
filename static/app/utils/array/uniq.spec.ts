import {uniq} from 'sentry/utils/array/uniq';

describe('uniq', () => {
  it('should return unique elements', () => {
    expect(uniq([1, 3, 5, 3])).toStrictEqual([1, 3, 5]);
  });

  it('should return empty array for undefined input', () => {
    expect(uniq(undefined)).toStrictEqual([]);
  });

  it('should return empty array for null input', () => {
    expect(uniq(null)).toStrictEqual([]);
  });

  it('should return empty array for empty object input', () => {
    expect(uniq({} as any)).toStrictEqual([]);
  });

  it('should return empty array for non-array objects', () => {
    expect(uniq({key: 'value'} as any)).toStrictEqual([]);
  });

  it('should return empty array for string input', () => {
    expect(uniq('string' as any)).toStrictEqual([]);
  });

  it('should return empty array for number input', () => {
    expect(uniq(123 as any)).toStrictEqual([]);
  });
});
