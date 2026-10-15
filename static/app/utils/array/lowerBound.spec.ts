import {lowerBound} from 'sentry/utils/array/lowerBound';
import {Rect} from 'sentry/utils/profiling/speedscope';

describe('lowerBound', () => {
  it.each([
    [[], 5, 0],
    [[1, 2, 3], 1, 0],
    [[-3, -2, -1], -1, 1],
    [[1, 2, 3], 10, 3],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 3],
  ])('inserts %p', (args, target, insert) => {
    expect(
      lowerBound(
        target,
        args.map(x => ({start: x, end: x + 1}))
      )
    ).toBe(insert);
  });

  it('finds the lower bound frame outside of view', () => {
    const frames = Array.from({length: 10})
      .fill(1)
      .map((_, i) => ({start: i, end: i + 1}));
    const view = new Rect(4, 0, 2, 0);

    expect(lowerBound(view.left, frames)).toBe(3);
    expect(frames[3]!.start).toBeLessThanOrEqual(view.left);
    expect(frames[3]!.end).toBeLessThanOrEqual(view.left);
  });
});
