import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export function AnnotationFixture(params: Partial<Annotation> = {}): Annotation {
  return {
    type: 'system',
    category: 'span',
    reason: 'rate_limited',
    start: 0,
    end: 60_000,
    droppedCount: 1,
    label: 'Rate limited',
    ...params,
  };
}
