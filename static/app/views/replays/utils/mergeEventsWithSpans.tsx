import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {Entry, EntryType, Event} from 'sentry/types/event';

export default function mergeEventsWithSpans(events: Event[]): Event {
  // Get a merged list of all spans from all replay events
  const spans = events.flatMap(event =>
    event.entries.flatMap((entry: Entry) =>
      entry.type === EntryType.SPANS ? (entry.data as RawSpanType[]) : []
    )
  );

  // Create a merged spans entry on the first replay event and fake the
  // endTimestamp by using the timestamp of the final span
  return {
    ...events[0],
    entries: [{type: EntryType.SPANS, data: spans}],
    // This is probably better than taking the end timestamp of the last `replayEvent`
    endTimestamp: spans[spans.length - 1]?.timestamp,
  } as Event;
}
