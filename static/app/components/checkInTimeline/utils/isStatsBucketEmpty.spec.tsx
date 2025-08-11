import {isStatsBucketEmpty} from './isStatsBucketEmpty';

describe('isStatsBucketEmpty', function () {
  it('returns true for an empty env', function () {
    const stats = {ok: 0, missed: 0, timeout: 0, error: 0, in_progress: 0, unknown: 0};
    expect(isStatsBucketEmpty(stats)).toBe(true);
  });

  it('returns false for a filled env', function () {
    const stats = {ok: 1, missed: 0, timeout: 0, error: 0, in_progress: 0, unknown: 0};
    expect(isStatsBucketEmpty(stats)).toBe(false);
  });
});
