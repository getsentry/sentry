import last from 'lodash/last';
import memoize from 'lodash/memoize';
import type {eventWithTime} from 'rrweb/typings/types';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import type {Event, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import createHighlightEvents from 'sentry/utils/replays/createHighlightEvents';
import mergeAndSortEvents from 'sentry/utils/replays/mergeAndSortEvents';
import mergeBreadcrumbEntries from 'sentry/utils/replays/mergeBreadcrumbEntries';
import mergeSpanEntries from 'sentry/utils/replays/mergeSpanEntries';

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
    private _event: EventTransaction,

    /**
     * The captured data from rrweb.
     * Saved as N attachments that belong to the root Replay event.
     */
    private _rrwebEvents: eventWithTime[],

    /**
     * Regular Sentry SDK events that occurred during the rrweb session.
     */
    private _replayEvents: Event[]
  ) {}

  getEvent = memoize(() => {
    const breadcrumbs = this.getEntryType(EntryType.BREADCRUMBS);
    const spans = this.getEntryType(EntryType.SPANS);

    const lastRRweb = last(this._rrwebEvents);
    const lastBreadcrumb = last(breadcrumbs?.data.values as RawCrumb[]);
    const lastSpan = last(spans?.data as RawSpanType[]);

    // The original `this._event.startTimestamp` and `this._event.endTimestamp`
    // are the same. It's because the root replay event is re-purposing the
    // `transaction` type, but it is not a real span occuring over time.
    // So we need to figure out the real end time (in seconds).
    const endTimestamp =
      Math.max(
        lastRRweb?.timestamp || 0,
        +new Date(lastBreadcrumb?.timestamp || 0),
        (lastSpan?.timestamp || 0) * 1000
      ) / 1000;

    return {
      ...this._event,
      entries: [breadcrumbs, spans],
      endTimestamp,
    } as EventTransaction;
  });

  getRRWebEvents = memoize(() => {
    const spansEntry = this.getEntryType(EntryType.SPANS);

    // Find LCP spans that have a valid replay node id, this will be used to
    const highlights = createHighlightEvents(spansEntry.data);

    // TODO(replays): ideally this would happen on SDK, but due
    // to how plugins work, we are unable to specify a timestamp for an event
    // (rrweb applies it), so it's possible actual LCP timestamp does not
    // match when the observer happens and we emit an rrweb event (will
    // look into this)
    return mergeAndSortEvents(this._rrwebEvents, highlights);
  });

  getEntryType = memoize((type: EntryType) => {
    switch (type) {
      case EntryType.BREADCRUMBS:
        return mergeBreadcrumbEntries(this._replayEvents);
      case EntryType.SPANS:
        return mergeSpanEntries(this._replayEvents);
      default:
        throw new Error(
          `ReplayReader is unable to prepare EntryType ${type}. Type not supported.`
        );
    }
  });

  isMemorySpan = (span: RawSpanType) => {
    return span.op === 'memory';
  };

  isNotMemorySpan = (span: RawSpanType) => {
    return !this.isMemorySpan(span);
  };
}
