import {CheckInStatus} from 'sentry/views/monitors/types';

import {
  getAggregateStatus,
  getAggregateStatusFromStatsBucket,
} from './getAggregateStatus';

type StatusCounts = [
  in_progress: number,
  ok: number,
  missed: number,
  timeout: number,
  error: number,
  unknown: number,
];

function generateEnvMapping(name: string, counts: StatusCounts) {
  const [in_progress, ok, missed, timeout, error, unknown] = counts;
  return {
    [name]: {in_progress, ok, missed, timeout, error, unknown},
  };
}

function generateStats(counts: StatusCounts) {
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

describe('getAggregateStatus', function () {
  it('aggregates correctly across multiple envs', function () {
    const envData = {
      ...generateEnvMapping('prod', [0, 1, 2, 0, 1, 0]),
      ...generateEnvMapping('dev', [0, 1, 0, 1, 0, 0]),
    };
    expect(getAggregateStatus(envData)).toEqual(CheckInStatus.ERROR);
  });
});

describe('getAggregateStatusFromStatsBucket', function () {
  it('aggregates correctly', function () {
    const stats = generateStats([0, 1, 2, 0, 1, 0]);
    expect(getAggregateStatusFromStatsBucket(stats)).toEqual(CheckInStatus.ERROR);
  });
});
