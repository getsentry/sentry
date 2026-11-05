import type {TimeSeriesSegmentField} from 'sentry/utils/timeSeries/segmentTimeSeriesByDisplayStyle';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Which `TimeSeriesItem` properties the app's charts should segment by, for the current organization
 */
export function useTimeSeriesSegmentBy(): readonly TimeSeriesSegmentField[] {
  const organization = useOrganization();

  return organization.features.includes('data-browsing-time-series-confidence')
    ? WITH_CONFIDENCE
    : WITHOUT_CONFIDENCE;
}

// Module-level so the hook returns a stable reference for memo dependencies
const WITH_CONFIDENCE: readonly TimeSeriesSegmentField[] = ['incomplete', 'confidence'];
const WITHOUT_CONFIDENCE: readonly TimeSeriesSegmentField[] = ['incomplete'];
