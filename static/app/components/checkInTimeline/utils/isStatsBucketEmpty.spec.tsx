import {isStatsBucketEmpty} from './isStatsBucketEmpty';

describe('isStatsBucketEmpty', () => {
  it('returns true for an empty env', () => {
    const stats = {ok: 0, missed: 0, timeout: 0, error: 0, in_progress: 0, unknown: 0};
    expect(isStatsBucketEmpty(stats)).toBe(true);
  });

  it('returns false for a filled env', () => {
    const stats = {ok: 1, missed: 0, timeout: 0, error: 0, in_progress: 0, unknown: 0};
    expect(isStatsBucketEmpty(stats)).toBe(false);
  });
});
