import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';

describe('segmentSequentialBy', () => {
  it('handles empty array', () => {
    expect(segmentSequentialBy([], () => true)).toEqual([]);
  });

  it('handles single item', () => {
    const data = [42];

    const result = segmentSequentialBy(data, isEven);

    expect(result).toEqual([{predicateValue: true, data: [42]}]);
  });

  it('groups varying items into partitions', () => {
    const data = [1, 3, 5, 2, 4, 6, 7, 9, 11, 8, 10];

    const result = segmentSequentialBy(data, isEven);

    expect(result).toEqual([
      {predicateValue: false, data: [1, 3, 5]},
      {predicateValue: true, data: [2, 4, 6]},
      {predicateValue: false, data: [7, 9, 11]},
      {predicateValue: true, data: [8, 10]},
    ]);
  });

  it('handles all items evaluating to the same value', () => {
    const data = [2, 4, 6, 8, 10];

    const result = segmentSequentialBy(data, isEven);

    expect(result).toEqual([{predicateValue: true, data: [2, 4, 6, 8, 10]}]);
  });
});

const isEven = (n: number) => n % 2 === 0;
