import {CheckInStatus} from 'sentry/views/monitors/types';

import {getAggregateStatus} from './getAggregateStatus';

type StatusCounts = [ok: number, missed: number, timeout: number, error: number];

export function generateEnvMapping(name: string, counts: StatusCounts) {
  const [ok, missed, timeout, error] = counts;
  return {
    [name]: {ok, timeout, error, missed},
  };
}
describe('getAggregateStatus', function () {
  it('aggregates correctly across multiple envs', function () {
    const envData = {
      ...generateEnvMapping('prod', [1, 2, 0, 1]),
      ...generateEnvMapping('dev', [1, 0, 1, 0]),
    };
    expect(getAggregateStatus(envData)).toEqual(CheckInStatus.ERROR);
  });
});
