import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';

describe('utils/replaceAtArrayIndex', function() {
  it('replaces simple value at index', function() {
    const arr = [1, 2, 3];

    expect(replaceAtArrayIndex(arr, 1, 40)).toEqual([1, 40, 3]);
  });

  it('does not mutate array', function() {
    const arr = [1, 2, 3];
    expect(replaceAtArrayIndex(arr, 0, 40)).toEqual([40, 2, 3]);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('replaces at boundaries of array', function() {
    const arr = [1, 2, 3];
    expect(replaceAtArrayIndex(arr, 0, 40)).toEqual([40, 2, 3]);

    const arr2 = [1, 2, 3];
    expect(replaceAtArrayIndex(arr2, 2, 40)).toEqual([1, 2, 40]);
  });
});
