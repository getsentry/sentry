import {CheckInStatus} from 'sentry/views/monitors/types';

import type {MonitorBucket, MonitorBucketWithStats} from '../types';

import {mergeBuckets, mergeBucketsWithStats} from './mergeBuckets';

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

function generateJobRun(envName: string, jobStatus: CheckInStatus) {
  const sortedStatuses = [
    CheckInStatus.IN_PROGRESS,
    CheckInStatus.OK,
    CheckInStatus.MISSED,
    CheckInStatus.TIMEOUT,
    CheckInStatus.ERROR,
    CheckInStatus.UNKNOWN,
  ];
  const counts: StatusCounts = [0, 0, 0, 0, 0, 0];
  counts[sortedStatuses.indexOf(jobStatus)] = 1;
  return generateEnvMapping(envName, counts);
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

function generateJobRunWithStats(jobStatus: CheckInStatus) {
  const sortedStatuses = [
    CheckInStatus.IN_PROGRESS,
    CheckInStatus.OK,
    CheckInStatus.MISSED,
    CheckInStatus.TIMEOUT,
    CheckInStatus.ERROR,
    CheckInStatus.UNKNOWN,
  ];
  const counts: StatusCounts = [0, 0, 0, 0, 0, 0];
  counts[sortedStatuses.indexOf(jobStatus)] = 1;
  return generateStats(counts);
}

describe('mergeBuckets', function () {
  it('does not generate ticks less than 3px width', function () {
    const bucketData: MonitorBucket[] = [
      [1, generateJobRun('prod', CheckInStatus.OK)],
      [2, generateJobRun('prod', CheckInStatus.OK)],
      [3, generateJobRun('prod', CheckInStatus.OK)],
      [4, {}],
      [5, generateJobRun('prod', CheckInStatus.OK)],
      [6, generateJobRun('prod', CheckInStatus.OK)],
      [7, generateJobRun('prod', CheckInStatus.OK)],
      [8, generateJobRun('prod', CheckInStatus.OK)],
    ];
    const mergedData = mergeBuckets(bucketData, 'prod');
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 8,
        width: 8,
        roundedLeft: true,
        roundedRight: true,
        envMapping: generateEnvMapping('prod', [0, 7, 0, 0, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('generates adjacent ticks without border radius', function () {
    const bucketData: MonitorBucket[] = [
      [1, generateJobRun('prod', CheckInStatus.OK)],
      [2, generateJobRun('prod', CheckInStatus.OK)],
      [3, generateJobRun('prod', CheckInStatus.OK)],
      [4, generateJobRun('prod', CheckInStatus.OK)],
      [5, generateJobRun('prod', CheckInStatus.MISSED)],
      [6, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      [7, generateJobRun('prod', CheckInStatus.MISSED)],
      [8, generateJobRun('prod', CheckInStatus.MISSED)],
    ];
    const mergedData = mergeBuckets(bucketData, 'prod');
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 4,
        width: 4,
        roundedLeft: true,
        roundedRight: false,
        envMapping: generateEnvMapping('prod', [0, 4, 0, 0, 0, 0]),
      },
      {
        startTs: 5,
        endTs: 8,
        width: 4,
        roundedLeft: false,
        roundedRight: true,
        envMapping: generateEnvMapping('prod', [0, 0, 3, 1, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('does not generate a separate tick if the next generated tick would be the same status', function () {
    const bucketData: MonitorBucket[] = [
      [1, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      [2, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      [3, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      [4, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      [5, generateJobRun('prod', CheckInStatus.MISSED)],
      [6, generateJobRun('prod', CheckInStatus.OK)],
      [7, generateJobRun('prod', CheckInStatus.MISSED)],
      [8, generateJobRun('prod', CheckInStatus.TIMEOUT)],
    ];
    const mergedData = mergeBuckets(bucketData, 'prod');
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 8,
        width: 8,
        roundedLeft: true,
        roundedRight: true,
        envMapping: generateEnvMapping('prod', [0, 1, 2, 5, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('filters off environment', function () {
    const bucketData: MonitorBucket[] = [
      [
        1,
        {
          ...generateJobRun('prod', CheckInStatus.TIMEOUT),
          ...generateJobRun('dev', CheckInStatus.OK),
        },
      ],
      [
        2,
        {
          ...generateJobRun('prod', CheckInStatus.TIMEOUT),
          ...generateJobRun('dev', CheckInStatus.MISSED),
        },
      ],
      [
        3,
        {
          ...generateJobRun('prod', CheckInStatus.TIMEOUT),
          ...generateJobRun('dev', CheckInStatus.TIMEOUT),
        },
      ],
      [4, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      [5, generateJobRun('prod', CheckInStatus.MISSED)],
      [6, generateJobRun('prod', CheckInStatus.OK)],
      [7, generateJobRun('prod', CheckInStatus.MISSED)],
      [8, generateJobRun('prod', CheckInStatus.TIMEOUT)],
    ];

    const mergedData = mergeBuckets(bucketData, 'dev');
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 4,
        width: 4,
        roundedLeft: true,
        roundedRight: true,
        envMapping: generateEnvMapping('dev', [0, 1, 1, 1, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });
});

describe('mergeBucketsWithStats', function () {
  it('does not generate ticks less than 3px width', function () {
    const bucketData: MonitorBucketWithStats[] = [
      [1, generateJobRunWithStats(CheckInStatus.OK)],
      [2, generateJobRunWithStats(CheckInStatus.OK)],
      [3, generateJobRunWithStats(CheckInStatus.OK)],
      [4, generateStats([0, 0, 0, 0, 0, 0])],
      [5, generateJobRunWithStats(CheckInStatus.OK)],
      [6, generateJobRunWithStats(CheckInStatus.OK)],
      [7, generateJobRunWithStats(CheckInStatus.OK)],
      [8, generateJobRunWithStats(CheckInStatus.OK)],
    ];
    const mergedData = mergeBucketsWithStats(bucketData);
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 8,
        width: 8,
        roundedLeft: true,
        roundedRight: true,
        stats: generateStats([0, 7, 0, 0, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('generates adjacent ticks without border radius', function () {
    const bucketData: MonitorBucketWithStats[] = [
      [1, generateJobRunWithStats(CheckInStatus.OK)],
      [2, generateJobRunWithStats(CheckInStatus.OK)],
      [3, generateJobRunWithStats(CheckInStatus.OK)],
      [4, generateJobRunWithStats(CheckInStatus.OK)],
      [5, generateJobRunWithStats(CheckInStatus.MISSED)],
      [6, generateJobRunWithStats(CheckInStatus.TIMEOUT)],
      [7, generateJobRunWithStats(CheckInStatus.MISSED)],
      [8, generateJobRunWithStats(CheckInStatus.MISSED)],
    ];
    const mergedData = mergeBucketsWithStats(bucketData);
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 4,
        width: 4,
        roundedLeft: true,
        roundedRight: false,
        stats: generateStats([0, 4, 0, 0, 0, 0]),
      },
      {
        startTs: 5,
        endTs: 8,
        width: 4,
        roundedLeft: false,
        roundedRight: true,
        stats: generateStats([0, 0, 3, 1, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });

  it('does not generate a separate tick if the next generated tick would be the same status', function () {
    const bucketData: MonitorBucketWithStats[] = [
      [1, generateJobRunWithStats(CheckInStatus.TIMEOUT)],
      [2, generateJobRunWithStats(CheckInStatus.TIMEOUT)],
      [3, generateJobRunWithStats(CheckInStatus.TIMEOUT)],
      [4, generateJobRunWithStats(CheckInStatus.TIMEOUT)],
      [5, generateJobRunWithStats(CheckInStatus.MISSED)],
      [6, generateJobRunWithStats(CheckInStatus.OK)],
      [7, generateJobRunWithStats(CheckInStatus.MISSED)],
      [8, generateJobRunWithStats(CheckInStatus.TIMEOUT)],
    ];
    const mergedData = mergeBucketsWithStats(bucketData);
    const expectedMerged = [
      {
        startTs: 1,
        endTs: 8,
        width: 8,
        roundedLeft: true,
        roundedRight: true,
        stats: generateStats([0, 1, 2, 5, 0, 0]),
      },
    ];

    expect(mergedData).toEqual(expectedMerged);
  });
});
