import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';

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
    !obj.hasOwnProperty('data')
  );
}

export function isGroupedMultiSeriesEventsStats(
  obj: unknown
): obj is GroupedMultiSeriesEventsStats {
  if (obj === null || obj === undefined) {
    return false;
  }

  return (
    getValues(obj).every(subObject => isMultiSeriesEventsStats(subObject)) &&
    !obj.hasOwnProperty('data')
  );
}

function getValues(obj: unknown): unknown[] {
  if (obj === null || obj === undefined) {
    return [];
  }

  return Object.entries(obj)
    .filter(([key, _value]) => key !== 'order')
    .map(([_key, value]) => {
      return value as unknown;
    });
}
