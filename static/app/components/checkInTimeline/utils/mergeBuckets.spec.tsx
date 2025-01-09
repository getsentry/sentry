import type {CheckInBucket} from '../types';

import {mergeBuckets} from './mergeBuckets';
import {generateTestStats, type TestStatusCounts, testStatusPrecedent} from './testUtils';

function generateJobRunWithStats(jobStatus: string) {
  const sortedStatuses = ['in_progress', 'ok', 'missed', 'timeout', 'error'];
  const counts: TestStatusCounts = [0, 0, 0, 0, 0];
  counts[sortedStatuses.indexOf(jobStatus)] = 1;
  return generateTestStats(counts);
}

describe('mergeBucketsWithStats', function () {
  it('does not generate ticks less than 3px width', function () {
    const bucketData: CheckInBucket<string>[] = [
      [1, generateJobRunWithStats('ok')],
      [2, generateJobRunWithStats('ok')],
      [3, generateJobRunWithStats('ok')],
      [4, generateTestStats([0, 0, 0, 0, 0])],
      [5, generateJobRunWithStats('ok')],
      [6, generateJobRunWithStats('ok')],
      [7, generateJobRunWithStats('ok')],
      [8, generateJobRunWithStats('ok')],
    ];
    const mergedData = mergeBuckets(testStatusPrecedent, bucketData);
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 8,
        width: 8,
        roundedLeft: true,
        roundedRight: true,
        stats: generateTestStats([0, 7, 0, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('generates adjacent ticks without border radius', function () {
    const bucketData: CheckInBucket<string>[] = [
      [1, generateJobRunWithStats('ok')],
      [2, generateJobRunWithStats('ok')],
      [3, generateJobRunWithStats('ok')],
      [4, generateJobRunWithStats('ok')],
      [5, generateJobRunWithStats('missed')],
      [6, generateJobRunWithStats('timeout')],
      [7, generateJobRunWithStats('missed')],
      [8, generateJobRunWithStats('missed')],
    ];
    const mergedData = mergeBuckets(testStatusPrecedent, bucketData);
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 4,
        width: 4,
        roundedLeft: true,
        roundedRight: false,
        stats: generateTestStats([0, 4, 0, 0, 0]),
      },
      {
        startTs: 5,
        endTs: 8,
        width: 4,
        roundedLeft: false,
        roundedRight: true,
        stats: generateTestStats([0, 0, 3, 1, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('does not generate a separate tick if the next generated tick would be the same status', function () {
    const bucketData: CheckInBucket<string>[] = [
      [1, generateJobRunWithStats('timeout')],
      [2, generateJobRunWithStats('timeout')],
      [3, generateJobRunWithStats('timeout')],
      [4, generateJobRunWithStats('timeout')],
      [5, generateJobRunWithStats('missed')],
      [6, generateJobRunWithStats('ok')],
      [7, generateJobRunWithStats('missed')],
      [8, generateJobRunWithStats('timeout')],
    ];
    const mergedData = mergeBuckets(testStatusPrecedent, bucketData);
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 8,
        width: 8,
        roundedLeft: true,
        roundedRight: true,
        stats: generateTestStats([0, 1, 2, 5, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });
});
