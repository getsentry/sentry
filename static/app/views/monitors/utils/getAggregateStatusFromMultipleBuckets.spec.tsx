import {CheckInStatus} from 'sentry/views/monitors/types';

import {getAggregateStatusFromMultipleBuckets} from './getAggregateStatusFromMultipleBuckets';

type StatusCounts = [ok: number, missed: number, timeout: number, error: number];

export function generateEnvMapping(name: string, counts: StatusCounts) {
  const [ok, missed, timeout, error] = counts;
  return {
    [name]: {ok, timeout, error, missed},
  };
}
describe('getAggregateStatusFromMultipleBuckets', function () {
  it('aggregates correctly across multiple envs', function () {
    const envData1 = generateEnvMapping('prod', [1, 2, 1, 0]);
    const envData2 = generateEnvMapping('dev', [2, 0, 0, 0]);
    const envData3 = generateEnvMapping('prod', [1, 1, 3, 0]);

    const status = getAggregateStatusFromMultipleBuckets([envData1, envData2, envData3]);

    expect(status).toEqual(CheckInStatus.TIMEOUT);
  });
});
