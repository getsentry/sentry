import {useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
  CRON_DEFAULT_RECOVERY_THRESHOLD,
  CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
  CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
  CRON_DEFAULT_SCHEDULE_TYPE,
  DEFAULT_CRONTAB,
  useCronDetectorFormField,
} from 'sentry/views/detectors/components/forms/cron/fields';
import {ScheduleType} from 'sentry/views/insights/crons/types';

export type CheckInBucketStats = Record<string, number>;
export type CheckInBucket = [bucketStartTs: number, stats: CheckInBucketStats];
export type ScheduleSampleBucketsResponse = CheckInBucket[];

interface UseMonitorsScheduleSampleBucketsOptions {
  /**
   * Bucket size in seconds (matches rollup config interval in the frontend).
   */
  interval: number | undefined;
  /**
   * Unix timestamp (seconds) for the first bucket in the window. For timeline
   * preview this can be `timeWindowConfig.start` (includes underscan).
   */
  start: number | undefined;
  /**
   * Optional unix timestamp (seconds) for end of bucket window. When provided,
   * backend will generate buckets for the entire range [start, endTs].
   */
  endTs?: number | undefined;
  /**
   * Optional unix timestamp (seconds) for the first scheduled tick. Use this
   * when `start` includes underscan (e.g. `timeWindowConfig.start`).
   */
  periodStart?: number | undefined;
  /**
   * Optional number of buckets in the main timeline (excluding underscan). When
   * provided with periodStart, the backend will prepend ok buckets from start
   * -> periodStart.
   */
  totalBuckets?: number | undefined;
}

export function useMonitorsScheduleSampleBuckets({
  start,
  periodStart,
  totalBuckets,
  endTs,
  interval,
}: UseMonitorsScheduleSampleBucketsOptions) {
  const organization = useOrganization();

  // Defaults make this hook easier to use in tests where the form store may not
  // have initialized values yet.
  const scheduleType =
    useCronDetectorFormField('scheduleType') ?? CRON_DEFAULT_SCHEDULE_TYPE;
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab') ?? DEFAULT_CRONTAB;
  const scheduleIntervalValue =
    useCronDetectorFormField('scheduleIntervalValue') ??
    CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE;
  const scheduleIntervalUnit =
    useCronDetectorFormField('scheduleIntervalUnit') ??
    CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT;
  const timezone = useCronDetectorFormField('timezone') ?? 'UTC';
  const failureIssueThreshold =
    useCronDetectorFormField('failureIssueThreshold') ??
    CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD;
  const recoveryThreshold =
    useCronDetectorFormField('recoveryThreshold') ?? CRON_DEFAULT_RECOVERY_THRESHOLD;

  const schedule =
    scheduleType === ScheduleType.INTERVAL
      ? [scheduleIntervalValue, scheduleIntervalUnit]
      : scheduleCrontab;

  const query = useMemo(
    () => ({
      failure_issue_threshold: failureIssueThreshold,
      recovery_threshold: recoveryThreshold,
      schedule_type: scheduleType,
      timezone,
      schedule,
      start,
      period_start: periodStart,
      total_buckets: totalBuckets,
      end_ts: endTs,
      interval,
    }),
    [
      failureIssueThreshold,
      interval,
      recoveryThreshold,
      schedule,
      scheduleType,
      start,
      periodStart,
      totalBuckets,
      endTs,
      timezone,
    ]
  );

  return useApiQuery<ScheduleSampleBucketsResponse>(
    [`/organizations/${organization.slug}/monitors-schedule-buckets/`, {query}],
    {
      staleTime: 0,
      enabled: start !== undefined && interval !== undefined,
      retry: false,
    }
  );
}
