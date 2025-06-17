import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';

describe('segmentSequentialBy', function () {
  it('handles empty array', function () {
    expect(segmentSequentialBy([], () => true)).toEqual([]);
  });

  it('handles single item', function () {
    const data = [42];

    const result = segmentSequentialBy(data, isEven);

    expect(result).toEqual([{predicateValue: true, data: [42]}]);
  });

  it('groups varying items into partitions', function () {
    const data = [1, 3, 5, 2, 4, 6, 7, 9, 11, 8, 10];

    const result = segmentSequentialBy(data, isEven);

    expect(result).toEqual([
      {predicateValue: false, data: [1, 3, 5]},
      {predicateValue: true, data: [2, 4, 6]},
      {predicateValue: false, data: [7, 9, 11]},
      {predicateValue: true, data: [8, 10]},
    ]);
  });

  it('handles all items evaluating to the same value', function () {
    const data = [2, 4, 6, 8, 10];

    const result = segmentSequentialBy(data, isEven);

    expect(result).toEqual([{predicateValue: true, data: [2, 4, 6, 8, 10]}]);
  });
});

const isEven = (n: number) => n % 2 === 0;
