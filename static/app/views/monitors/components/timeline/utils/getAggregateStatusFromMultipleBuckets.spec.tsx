import {CheckInStatus} from 'sentry/views/monitors/types';

import {
  getAggregateStatusFromMultipleBuckets,
  getAggregateStatusFromMultipleStatsBuckets,
} from './getAggregateStatusFromMultipleBuckets';

type StatusCounts = [
  in_progress: number,
  ok: number,
  missed: number,
  timeout: number,
  error: number,
  unknown: number,
];

export function generateEnvMapping(name: string, counts: StatusCounts) {
  const [in_progress, ok, missed, timeout, error, unknown] = counts;
  return {
    [name]: {in_progress, ok, missed, timeout, error, unknown},
  };
}

export function generateStats(counts: StatusCounts) {
  const [in_progress, ok, missed, timeout, error, unknown] = counts;
  return {
    in_progress,
    ok,
    missed,
    timeout,
    error,
    unknown,
  };
}

describe('getAggregateStatusFromMultipleBuckets', function () {
  it('aggregates correctly across multiple envs', function () {
    const envData1 = generateEnvMapping('prod', [2, 1, 2, 1, 0, 0]);
    const envData2 = generateEnvMapping('dev', [1, 2, 0, 0, 0, 0]);
    const envData3 = generateEnvMapping('prod', [1, 1, 1, 3, 0, 0]);

    const status = getAggregateStatusFromMultipleBuckets([envData1, envData2, envData3]);

    expect(status).toEqual(CheckInStatus.TIMEOUT);
  });
});

describe('getAggregateStatusFromMultipleStatsBuckets', function () {
  it('aggregates correctly across multiple envs', function () {
    const stats1 = generateStats([2, 1, 2, 1, 0, 0]);
    const stats2 = generateStats([1, 2, 0, 0, 0, 0]);
    const stats3 = generateStats([1, 1, 1, 3, 0, 0]);

    const status = getAggregateStatusFromMultipleStatsBuckets([stats1, stats2, stats3]);

    expect(status).toEqual(CheckInStatus.TIMEOUT);
  });
});
