import type {
  MonitorBucketEnvMapping,
  StatsBucket,
} from 'sentry/views/monitors/components/timeline/types';

import {mergeEnvMappings, mergeStats} from './mergeEnvMappings';

type StatusCounts = [
  in_progress: number,
  ok: number,
  missed: number,
  timeout: number,
  error: number,
  unknown: number,
];

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

describe('mergeEnvMappings', function () {
  it('merges two empty mappings', function () {
    const envMappingA: MonitorBucketEnvMapping = {};
    const envMappingB: MonitorBucketEnvMapping = {};
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual({});
  });

  it('merges one empty mapping with one filled mapping', function () {
    const envMappingA: MonitorBucketEnvMapping = {};
    const envMappingB: MonitorBucketEnvMapping = {
      prod: {in_progress: 0, ok: 1, missed: 0, timeout: 0, error: 0, unknown: 0},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(envMappingB);
  });

  it('merges two filled mappings', function () {
    const envMappingA: MonitorBucketEnvMapping = {
      prod: {in_progress: 0, ok: 0, missed: 1, timeout: 2, error: 1, unknown: 0},
    };
    const envMappingB: MonitorBucketEnvMapping = {
      prod: {in_progress: 2, ok: 1, missed: 1, timeout: 0, error: 2, unknown: 0},
    };
    const expectedMerged: MonitorBucketEnvMapping = {
      prod: {in_progress: 2, ok: 1, missed: 2, timeout: 2, error: 3, unknown: 0},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(expectedMerged);
  });

  it('merges two filled mappings with differing envs', function () {
    const envMappingA: MonitorBucketEnvMapping = {
      prod: {in_progress: 1, ok: 0, missed: 1, timeout: 2, error: 1, unknown: 0},
    };
    const envMappingB: MonitorBucketEnvMapping = {
      dev: {in_progress: 0, ok: 1, missed: 1, timeout: 0, error: 2, unknown: 0},
    };
    const expectedMerged: MonitorBucketEnvMapping = {
      prod: {in_progress: 1, ok: 0, missed: 1, timeout: 2, error: 1, unknown: 0},
      dev: {in_progress: 0, ok: 1, missed: 1, timeout: 0, error: 2, unknown: 0},
    };
    const mergedMapping = mergeEnvMappings(envMappingA, envMappingB);

    expect(mergedMapping).toEqual(expectedMerged);
  });
});

describe('mergeStats', function () {
  it('merges two filled mappings', function () {
    const statsA: StatsBucket = generateStats([0, 0, 1, 2, 1, 0]);
    const statsB: StatsBucket = generateStats([2, 1, 1, 0, 2, 0]);
    const expectedMerged: StatsBucket = generateStats([2, 1, 2, 2, 3, 0]);
    const mergedStats = mergeStats(statsA, statsB);

    expect(mergedStats).toEqual(expectedMerged);
  });
});
