import type {eventWithTime} from 'rrweb/typings/types';

import type {
  MemorySpanType,
  RawSpanType,
} from 'sentry/components/events/interfaces/spans/types';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import type {Event, EventTransaction} from 'sentry/types/event';
import {Entry, EntryType} from 'sentry/types/event';
import {
  breadcrumbEntryFactory,
  breadcrumbValuesFromEvents,
  replayTimestamps,
  rrwebEventListFactory,
  spanDataFromEvents,
  spanEntryFactory,
} from 'sentry/utils/replays/replayDataUtils';

export default class ReplayReader {
  static factory(
    event: EventTransaction | undefined,
    rrwebEvents: eventWithTime[] | undefined,
    replayEvents: Event[] | undefined
  ) {
    if (!event || !rrwebEvents || !replayEvents) {
      return null;
    }
    return new ReplayReader(event, rrwebEvents, replayEvents);
  }

  private constructor(
    /**
     * The root Replay event, created at the start of the browser session.
     */
    event: EventTransaction,

    /**
     * The captured data from rrweb.
     * Saved as N attachments that belong to the root Replay event.
     */
    rrwebEvents: eventWithTime[],

    /**
     * Regular Sentry SDK events that occurred during the rrweb session.
     */
    replayEvents: Event[]
  ) {
    const rawCrumbs = breadcrumbValuesFromEvents(replayEvents);
    const rawSpanData = spanDataFromEvents(replayEvents);

    const {startTimestampMS, endTimestampMS} = replayTimestamps(
      rrwebEvents,
      rawCrumbs,
      rawSpanData
    );

    this.breadcrumbEntry = breadcrumbEntryFactory(
      startTimestampMS,
      event.tags,
      rawCrumbs
    );
    this.spanEntry = spanEntryFactory(rawSpanData);

    this.rrwebEvents = rrwebEventListFactory(
      startTimestampMS,
      endTimestampMS,
      rawSpanData,
      rrwebEvents
    );

    this.event = {
      ...event,
      entries: [this.breadcrumbEntry, this.spanEntry],
      startTimestamp: startTimestampMS / 1000,
      endTimestamp: endTimestampMS / 1000,
    } as EventTransaction;
  }

  event: EventTransaction;
  rrwebEvents: eventWithTime[];
  breadcrumbEntry: Entry;
  spanEntry: Entry;

  getEvent = () => {
    return this.event;
  };

  getRRWebEvents = () => {
    return this.rrwebEvents;
  };

  getEntryType = (type: EntryType) => {
    switch (type) {
      case EntryType.BREADCRUMBS:
        return this.breadcrumbEntry;
      case EntryType.SPANS:
        return this.spanEntry;
      default:
        throw new Error(
          `ReplayReader is unable to prepare EntryType ${type}. Type not supported.`
        );
    }
  };

  getRawCrumbs = () => {
    return this.breadcrumbEntry.data.values as RawCrumb[];
  };

  getRawSpans = () => {
    return this.spanEntry.data as RawSpanType[];
  };

  isMemorySpan = (span: RawSpanType): span is MemorySpanType => {
    return span.op === 'memory';
  };

  isNotMemorySpan = (span: RawSpanType) => {
    return !this.isMemorySpan(span);
  };
}
