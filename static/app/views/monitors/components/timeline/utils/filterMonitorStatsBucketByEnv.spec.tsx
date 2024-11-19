import type {MonitorBucket} from '../types';

import {filterMonitorStatsBucketByEnv} from './filterMonitorStatsBucketByEnv';

describe('filterMonitorStatsBucketByEnvs', function () {
  it('filters away environments', function () {
    const bucket = [
      1,
      {
        prod: {in_progress: 0, ok: 0, missed: 0, timeout: 1, error: 0, unknown: 0},
        dev: {in_progress: 0, ok: 1, missed: 0, timeout: 0, error: 0, unknown: 0},
      },
    ] as MonitorBucket;
    const filteredBucket = filterMonitorStatsBucketByEnv(bucket, 'prod');
    expect(filteredBucket).toEqual([
      1,
      {
        prod: {in_progress: 0, ok: 0, missed: 0, timeout: 1, error: 0, unknown: 0},
      },
    ]);
  });

  it('filters on an empty bucket', function () {
    const bucket = [1, {}] as MonitorBucket;
    const filteredBucket = filterMonitorStatsBucketByEnv(bucket, 'prod');
    expect(filteredBucket).toEqual([1, {}]);
  });
});
