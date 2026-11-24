import {mergeTimeRanges} from './mergeTimeRanges';

describe('mergeTimeRanges', () => {
  it('merges ranges that overlap or touch, in any order', () => {
    expect(
      mergeTimeRanges([
        {start: 50, end: 60},
        {start: 10, end: 20},
        {start: 20, end: 30},
        {start: 25, end: 28},
      ])
    ).toEqual([
      {start: 10, end: 30},
      {start: 50, end: 60},
    ]);
  });

  it('keeps ranges with a gap between them apart', () => {
    expect(
      mergeTimeRanges([
        {start: 0, end: 10},
        {start: 11, end: 20},
      ])
    ).toEqual([
      {start: 0, end: 10},
      {start: 11, end: 20},
    ]);
  });

  it('does not change the ranges it was given', () => {
    const ranges = [
      {start: 0, end: 10},
      {start: 5, end: 20},
    ];

    mergeTimeRanges(ranges);

    expect(ranges).toEqual([
      {start: 0, end: 10},
      {start: 5, end: 20},
    ]);
  });
});
