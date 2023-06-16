import {
  getAggregateStatus,
  getAggregateStatusFromMultipleBuckets,
  mergeBuckets,
} from 'sentry/views/monitors/components/checkInTimeline';
import {MonitorBucketData} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';

type StatusCounts = [
  ok: number,
  missed: number,
  timeout: number,
  error: number,
  in_progress: number
];

function generateEnvMapping(name: string, counts: StatusCounts) {
  const [ok, missed, timeout, error, in_progress] = counts;
  return {
    [name]: {ok, timeout, error, missed, in_progress},
  };
}

function generateJobRun(envName: string, jobStatus: CheckInStatus) {
  const sortedStatuses = [
    CheckInStatus.OK,
    CheckInStatus.MISSED,
    CheckInStatus.TIMEOUT,
    CheckInStatus.ERROR,
    CheckInStatus.IN_PROGRESS,
  ];
  const counts: StatusCounts = [0, 0, 0, 0, 0];
  counts[sortedStatuses.indexOf(jobStatus)] = 1;
  return generateEnvMapping(envName, counts);
}

describe('CheckInTimeline', function () {
  describe('getAggregateStatus', function () {
    it('aggregates correctly across multiple envs', function () {
      const envData = {
        ...generateEnvMapping('prod', [1, 2, 0, 1, 0]),
        ...generateEnvMapping('dev', [1, 0, 1, 0, 0]),
      };
      expect(getAggregateStatus(envData)).toEqual(CheckInStatus.ERROR);
    });
  });

  describe('getAggregateStatusFromMultipleBuckets', function () {
    it('aggregates correctly across multiple envs', function () {
      const envData1 = generateEnvMapping('prod', [1, 2, 1, 0, 0]);
      const envData2 = generateEnvMapping('dev', [2, 0, 0, 0, 0]);
      const envData3 = generateEnvMapping('prod', [1, 1, 3, 0, 0]);

      const status = getAggregateStatusFromMultipleBuckets([
        envData1,
        envData2,
        envData3,
      ]);

      expect(status).toEqual(CheckInStatus.TIMEOUT);
    });
  });

  describe('mergeBuckets', function () {
    it('does not generate ticks less than 3px width', function () {
      const bucketData: MonitorBucketData = [
        [1, generateJobRun('prod', CheckInStatus.OK)],
        [2, generateJobRun('prod', CheckInStatus.OK)],
        [3, generateJobRun('prod', CheckInStatus.OK)],
        [4, {}],
        [5, generateJobRun('prod', CheckInStatus.OK)],
        [6, generateJobRun('prod', CheckInStatus.OK)],
        [7, generateJobRun('prod', CheckInStatus.OK)],
        [8, generateJobRun('prod', CheckInStatus.OK)],
      ];
      const mergedData = mergeBuckets(bucketData);
      const expectedMerged = [
        {
          startTs: 1,
          endTs: 8,
          width: 8,
          roundedLeft: true,
          roundedRight: true,
          envMapping: generateEnvMapping('prod', [7, 0, 0, 0, 0]),
        },
      ];

      expect(mergedData).toEqual(expectedMerged);
    });

    it('generates adjacent ticks without border radius', function () {
      const bucketData: MonitorBucketData = [
        [1, generateJobRun('prod', CheckInStatus.OK)],
        [2, generateJobRun('prod', CheckInStatus.OK)],
        [3, generateJobRun('prod', CheckInStatus.OK)],
        [4, generateJobRun('prod', CheckInStatus.OK)],
        [5, generateJobRun('prod', CheckInStatus.MISSED)],
        [6, generateJobRun('prod', CheckInStatus.TIMEOUT)],
        [7, generateJobRun('prod', CheckInStatus.MISSED)],
        [8, generateJobRun('prod', CheckInStatus.MISSED)],
      ];
      const mergedData = mergeBuckets(bucketData);
      const expectedMerged = [
        {
          startTs: 1,
          endTs: 4,
          width: 4,
          roundedLeft: true,
          roundedRight: false,
          envMapping: generateEnvMapping('prod', [4, 0, 0, 0, 0]),
        },
        {
          startTs: 5,
          endTs: 8,
          width: 4,
          roundedLeft: false,
          roundedRight: true,
          envMapping: generateEnvMapping('prod', [0, 3, 1, 0, 0]),
        },
      ];

      expect(mergedData).toEqual(expectedMerged);
    });

    it('does not generate a separate tick if the next generated tick would be the same status', function () {
      const bucketData: MonitorBucketData = [
        [1, generateJobRun('prod', CheckInStatus.TIMEOUT)],
        [2, generateJobRun('prod', CheckInStatus.TIMEOUT)],
        [3, generateJobRun('prod', CheckInStatus.TIMEOUT)],
        [4, generateJobRun('prod', CheckInStatus.TIMEOUT)],
        [5, generateJobRun('prod', CheckInStatus.MISSED)],
        [6, generateJobRun('prod', CheckInStatus.OK)],
        [7, generateJobRun('prod', CheckInStatus.MISSED)],
        [8, generateJobRun('prod', CheckInStatus.TIMEOUT)],
      ];
      const mergedData = mergeBuckets(bucketData);
      const expectedMerged = [
        {
          startTs: 1,
          endTs: 8,
          width: 8,
          roundedLeft: true,
          roundedRight: true,
          envMapping: generateEnvMapping('prod', [1, 2, 5, 0, 0]),
        },
      ];

      expect(mergedData).toEqual(expectedMerged);
    });
  });
});
