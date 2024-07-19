import {uniq} from 'sentry/utils/array/uniq';

describe('uniq', () => {
  it('should return unique elements', () => {
    expect(uniq([1, 3, 5, 3])).toStrictEqual([1, 3, 5]);
  });

  it('should return empty array for undefined input', () => {
    expect(uniq(undefined)).toStrictEqual([]);
  });
});
