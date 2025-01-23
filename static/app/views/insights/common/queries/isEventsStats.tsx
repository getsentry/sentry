import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';

export function isEventsStats(
  obj: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats
): obj is EventsStats {
  return typeof obj === 'object' && obj !== null && typeof obj.data === 'object';
}

export function isMultiSeriesEventsStats(
  obj: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats
): obj is MultiSeriesEventsStats {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return Object.values(obj).every(series => isEventsStats(series));
}
