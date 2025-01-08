import {mergeStats} from './mergeStats';
import {generateTestStats, testStatusPrecedent} from './testUtils';

describe('mergeStats', function () {
  it('merges two filled mappings', function () {
    const statsA = generateTestStats([0, 0, 1, 2, 1]);
    const statsB = generateTestStats([2, 1, 1, 0, 2]);
    const expectedMerged = generateTestStats([2, 1, 2, 2, 3]);
    const mergedStats = mergeStats(testStatusPrecedent, statsA, statsB);

    expect(mergedStats).toEqual(expectedMerged);
  });
});
