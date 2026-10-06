import {upperBound} from 'sentry/utils/array/upperBound';
import {Rect} from 'sentry/utils/profiling/speedscope';

describe('upperBound', () => {
  it.each([
    [[], 5, 0],
    [[1, 2, 3], 2, 1],
    [[-3, -2, -1], -2, 1],
    [[1, 2, 3], 10, 3],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 4],
  ])('inserts %p', (args, target, insert) => {
    expect(
      upperBound(
        target,
        args.map(x => ({start: x, end: x + 1}))
      )
    ).toBe(insert);
  });

  it('finds the upper bound frame outside of view', () => {
    const frames = Array.from({length: 10})
      .fill(1)
      .map((_, i) => ({start: i, end: i + 1}));
    const view = new Rect(4, 0, 2, 0);

    expect(upperBound(view.right, frames)).toBe(6);
    expect(frames[6]!.start).toBeGreaterThanOrEqual(view.right);
    expect(frames[6]!.end).toBeGreaterThanOrEqual(view.right);
  });
});
