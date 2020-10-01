import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';

describe('utils/removeAtArrayIndex', function () {
  it('removes simple value at index', function () {
    const arr = [1, 2, 3];

    expect(removeAtArrayIndex(arr, 1)).toEqual([1, 3]);
  });

  it('does not mutate array', function () {
    const arr = [1, 2, 3];
    expect(removeAtArrayIndex(arr, 0)).toEqual([2, 3]);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('removes at boundaries of array', function () {
    const arr = [1, 2, 3];
    expect(removeAtArrayIndex(arr, 0)).toEqual([2, 3]);

    const arr2 = [1, 2, 3];
    expect(removeAtArrayIndex(arr2, 2)).toEqual([1, 2]);
  });
});
