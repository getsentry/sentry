import {CheckInStatus} from 'sentry/views/monitors/types';

import {getAggregateStatus} from './getAggregateStatus';

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

describe('getAggregateStatus', function () {
  it('aggregates correctly across multiple envs', function () {
    const envData = {
      ...generateEnvMapping('prod', [0, 1, 2, 0, 1, 0]),
      ...generateEnvMapping('dev', [0, 1, 0, 1, 0, 0]),
    };
    expect(getAggregateStatus(envData)).toEqual(CheckInStatus.ERROR);
  });
});
