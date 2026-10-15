import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';

export function DroppedEventFixture(
  params: Partial<DroppedEventsBucket> = {}
): DroppedEventsBucket {
  return {
    type: 'system',
    category: 'span',
    reason: 'rate_limited',
    outcome: 'rate_limited',
    start: 0,
    end: 60_000,
    count: 1,
    ...params,
  };
}
