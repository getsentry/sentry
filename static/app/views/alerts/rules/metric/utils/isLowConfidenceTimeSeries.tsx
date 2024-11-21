import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {isEventsStats} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

// Returns true if any of the time series data has a low confidence interval
export function isLowConfidenceTimeSeries(
  data: EventsStats | MultiSeriesEventsStats | null
) {
  if (data) {
    if (isEventsStats(data)) {
      return data.data.some(series => series[1][0].confidence === 'LOW');
    }
    return Object.values(data).some(eventsStats =>
      eventsStats.data.some(series => series[1][0].confidence === 'LOW')
    );
  }
  return false;
}
