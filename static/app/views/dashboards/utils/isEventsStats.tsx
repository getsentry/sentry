import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export function isEventsStats(obj: unknown): obj is EventsStats {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return 'data' in obj && Array.isArray(obj.data);
}

export function isMultiSeriesEventsStats(obj: unknown): obj is MultiSeriesEventsStats {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return (
    getValues(obj).every(subObject => isEventsStats(subObject)) &&
    !Object.hasOwn(obj, 'data')
  );
}

export function isGroupedMultiSeriesEventsStats(
  obj: unknown
): obj is GroupedMultiSeriesEventsStats {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return (
    getValues(obj).every(subObject => isMultiSeriesEventsStats(subObject)) &&
    !Object.hasOwn(obj, 'data')
  );
}

/** @public */
export function isEventsTimeSeriesResponse(
  obj: unknown
): obj is EventsTimeSeriesResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return 'timeSeries' in obj && Array.isArray(obj.timeSeries);
}

function getValues(obj: unknown): unknown[] {
  if (obj === null || obj === undefined) {
    return [];
  }

  // Grouped responses put a numeric `order` next to each group's series. Only
  // skip that numeric key: a top-events group can itself be named "order" (e.g.,
  // a project slug), and its value is a series that still needs to be checked.
  return Object.entries(obj)
    .filter(([key, value]) => !(key === 'order' && typeof value === 'number'))
    .map(([_key, value]) => {
      return value as unknown;
    });
}
