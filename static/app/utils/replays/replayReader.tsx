import last from 'lodash/last';
import memoize from 'lodash/memoize';
import type {eventWithTime} from 'rrweb/typings/types';

import type {
  MemorySpanType,
  RawSpanType,
} from 'sentry/components/events/interfaces/spans/types';
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
    // if (!event || !rrwebEvents || !replayEvents) {
    // return null;
    // }
    return new ReplayReader(event, rrwebEvents, replayEvents);
  }

  private constructor(
    /**
     * The root Replay event, created at the start of the browser session.
     */
    private _event: EventTransaction | undefined,

    /**
     * The captured data from rrweb.
     * Saved as N attachments that belong to the root Replay event.
     */
    private _rrwebEvents: eventWithTime[] | undefined,

    /**
     * Regular Sentry SDK events that occurred during the rrweb session.
     */
    private _replayEvents: Event[] | undefined
  ) {}

  /**
   * The original `this._event.startTimestamp` and `this._event.endTimestamp`
   * are the same. It's because the root replay event is re-purposing the
   * `transaction` type, but it is not a real span occuring over time.
   * So we need to figure out the real end time, in milliseconds.
   */
  private _getEndTimestampMS() {
    const crumbs = this.getRawCrumbs();
    const spans = this.getRawSpans();

    const lastRRweb = last(this._rrwebEvents);
    const lastBreadcrumb = last(crumbs);
    const lastSpan = last(spans);

    return Math.max(
      lastRRweb?.timestamp || 0,
      +new Date(lastBreadcrumb?.timestamp || 0),
      (lastSpan?.timestamp || 0) * 1000
    );
  }

  getEvent = memoize(() => {
    const breadcrumbEntry = this.getEntryType(EntryType.BREADCRUMBS);
    const spansEntry = this.getEntryType(EntryType.SPANS);
    const endTimestampMS = this._getEndTimestampMS();

    return {
      ...this._event,
      entries: [breadcrumbEntry, spansEntry],
      endTimestamp: endTimestampMS / 1000,
    } as EventTransaction;
  });

  getRRWebEvents = memoize(() => {
    const spans = this.getRawSpans();

    if (!spans || !this._rrwebEvents) {
      return null;
    }

    // Find LCP spans that have a valid replay node id, this will be used to
    const highlights = createHighlightEvents(spans);

    // Create a final event so that rrweb has the same internal duration as the
    // root event.
    // This allows the scrubber to view timestamps after the last captured
    // rrweb event, like if a memory span was captured after the last mouse-move,
    // but before page unload.
    const endEvent = {
      type: 5, // EventType.Custom
      timestamp: this._getEndTimestampMS(),
      data: {
        tag: 'replay-end',
      },
    } as eventWithTime;

    // TODO(replays): ideally this would happen on SDK, but due
    // to how plugins work, we are unable to specify a timestamp for an event
    // (rrweb applies it), so it's possible actual LCP timestamp does not
    // match when the observer happens and we emit an rrweb event (will
    // look into this)
    return mergeAndSortEvents(this._rrwebEvents, highlights, [endEvent]);
  });

  getEntryType = memoize((type: EntryType) => {
    if (!this._replayEvents) {
      return null;
    }

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

  getRawCrumbs = () => {
    return this.getEntryType(EntryType.BREADCRUMBS)?.data.values as RawCrumb[];
  };

  getRawSpans = () => {
    return this.getEntryType(EntryType.SPANS)?.data as RawSpanType[];
  };

  isMemorySpan = (span: RawSpanType): span is MemorySpanType => {
    return span.op === 'memory';
  };

  isNotMemorySpan = (span: RawSpanType) => {
    return !this.isMemorySpan(span);
  };
}
