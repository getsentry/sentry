import first from 'lodash/first';
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
  ) {
    this._rrwebEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * The original `this._event.startTimestamp` and `this._event.endTimestamp`
   * are the same. It's because the root replay event is re-purposing the
   * `transaction` type, but it is not a real span occuring over time.
   * So we need to figure out the real start and end timestamps based on when
   * first and last bits of data were collected. In milliseconds.
   */
  private _getTimestampsMS = memoize(() => {
    const crumbs = this.getRawCrumbs();
    const spans = this.getRawSpans();

    const endSortedSpans = Array.from(spans).sort((a, b) => a.timestamp - b.timestamp);

    const rrwebStart = first(this._rrwebEvents)?.timestamp;
    const crumbStart = first(crumbs)?.timestamp;
    const spanStart = first(spans)?.start_timestamp;

    return {
      startTimestsampMS: Math.min(
        ...([
          rrwebStart,
          crumbStart ? +new Date(crumbStart) : undefined,
          spanStart ? spanStart * 1000 : undefined,
        ].filter(Boolean) as number[])
      ),
      endTimestampMS: Math.max(
        last(this._rrwebEvents)?.timestamp || 0,
        +new Date(last(crumbs)?.timestamp || 0),
        (first(endSortedSpans)?.timestamp || 0) * 1000
      ),
    };
  });

  getEvent = memoize(() => {
    const breadcrumbEntry = this.getEntryType(EntryType.BREADCRUMBS);
    const spansEntry = this.getEntryType(EntryType.SPANS);
    const {startTimestsampMS, endTimestampMS} = this._getTimestampsMS();

    return {
      ...this._event,
      entries: [breadcrumbEntry, spansEntry],
      startTimestamp: startTimestsampMS / 1000,
      endTimestamp: endTimestampMS / 1000,
    } as EventTransaction;
  });

  getRRWebEvents = memoize(() => {
    const spans = this.getRawSpans();

    // Find LCP spans that have a valid replay node id, this will be used to
    const highlights = createHighlightEvents(spans);

    // Init bookend event so that rrweb has the same internal duration as the
    // root event.
    // This allows the scrubber to view timestamps before and after the last
    // captured rrweb event, like if a memory span was captured after the last
    // mouse-move, but before page unload.
    const {startTimestsampMS, endTimestampMS} = this._getTimestampsMS();

    const firstRRWebEvent = first(this._rrwebEvents);
    if (firstRRWebEvent) {
      firstRRWebEvent.timestamp = startTimestsampMS;
    }

    // TODO(replay): We start rendering at `startTimestsampMS`, and then the
    // first rrweb data comes later at `this._rrwebEvents[0].timestamp`.
    // Can/should we inject an rrweb event, like `FullSnapshot` so that
    // there is something to render in that 'in-between' time?

    const endEvent = {
      type: 5, // EventType.Custom,
      timestamp: endTimestampMS,
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
