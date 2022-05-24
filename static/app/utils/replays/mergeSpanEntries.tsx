import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {Entry, EntryType, Event} from 'sentry/types/event';

/**
 * Merge all spans from each Event in the `events` array
 */
export default function mergeSpanEntries(events: Event[]): Entry {
  const spans = events.flatMap(event =>
    event.entries.flatMap((entry: Entry) =>
      entry.type === EntryType.SPANS ? (entry.data as RawSpanType[]) : []
    )
  );

  spans.sort((a, b) => a.start_timestamp - b.start_timestamp);

  return {type: EntryType.SPANS, data: spans};
}
