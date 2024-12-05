import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {isEventsStats} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

const LOW_CONFIDENCE_RATIO = 0.25;

export function fakeConfidenceData(
  data: EventsStats | MultiSeriesEventsStats | null
): EventsStats | MultiSeriesEventsStats | null {
  if (!data) {
    return null;
  }
  if (isEventsStats(data)) {
    return _fakeConfidenceEventsStats(data);
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, _fakeConfidenceEventsStats(value)])
  );
}

function _fakeConfidenceEventsStats(data: EventsStats): EventsStats {
  return {
    ...data,
    confidence: data.data.map(series => [
      series[0],
      series[1].map(val => ({
        ...val,
        count: Math.random() > LOW_CONFIDENCE_RATIO ? 'high' : 'low',
      })),
    ]),
  };
}
