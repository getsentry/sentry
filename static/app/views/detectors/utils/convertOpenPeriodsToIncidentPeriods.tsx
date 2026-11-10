import {t} from 'sentry/locale';
import type {GroupOpenPeriod} from 'sentry/types/group';

import type {IncidentPeriod} from './incidentMarkers';

interface ConvertOpenPeriodsToIncidentPeriodsOptions {
  /**
   * Where ongoing open periods end, usually the last data point on the chart
   */
  chartEndTimestampMs: number | undefined;
  intervalMs: number;
  openPeriods: GroupOpenPeriod[];
}

function createTriggerIntervalMarkerData({
  period,
  intervalMs,
}: {
  intervalMs: number;
  period: GroupOpenPeriod;
}): IncidentPeriod {
  return {
    id: period.id,
    end: new Date(period.start).getTime(),
    issueShortId: period.shortId,
    priority: period.activities[0]?.value ?? 'high',
    start: new Date(period.start).getTime() - intervalMs,
    type: 'trigger-interval',
  };
}

function createOpenPeriodMarkerData({
  chartEndTimestampMs,
  period,
}: {
  chartEndTimestampMs: number | undefined;
  period: GroupOpenPeriod;
}): IncidentPeriod[] {
  const endDate = period.end
    ? new Date(period.end).getTime()
    : (chartEndTimestampMs ?? Date.now());

  const segments = period.activities
    .filter(activity => activity.type !== 'closed')
    .map((activity, i) => {
      const activityEndTime = new Date(
        period.activities[i + 1]?.dateCreated ?? period.end ?? endDate
      ).getTime();

      return {
        priority: activity.value,
        end: activityEndTime,
        start: new Date(activity.dateCreated).getTime(),
      };
    });

  return segments.map((segment, i) => ({
    type: i === 0 ? 'open-period-start' : 'open-period-transition',
    end: segment.end,
    id: period.id,
    isOngoing: !period.end && i === segments.length - 1,
    issueShortId: period.shortId,
    name: t('Open Periods'),
    priority: segment.priority ?? 'high',
    start: segment.start,
  }));
}

/**
 * Each open period becomes a marker for the interval that triggered it, followed by a
 * marker for every priority it held while open.
 */
export function convertOpenPeriodsToIncidentPeriods({
  openPeriods,
  intervalMs,
  chartEndTimestampMs,
}: ConvertOpenPeriodsToIncidentPeriodsOptions): IncidentPeriod[] {
  return openPeriods.flatMap(period => [
    createTriggerIntervalMarkerData({period, intervalMs}),
    ...createOpenPeriodMarkerData({chartEndTimestampMs, period}),
  ]);
}
