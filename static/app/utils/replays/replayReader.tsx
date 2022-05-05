import memoize from 'lodash/memoize';
import type {eventWithTime} from 'rrweb/typings/types';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import type {Event, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import mergeBreadcrumbEntries from 'sentry/utils/replays/mergeBreadcrumbEntries';
import mergeSpanEntries from 'sentry/utils/replays/mergeSpanEntries';

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

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
        lastRRweb.timestamp,
        +new Date(lastBreadcrumb.timestamp || 0),
        lastSpan.timestamp * 1000
      ) / 1000;

    return {
      ...this._event,
      entries: [breadcrumbs, spans],
      endTimestamp,
    } as EventTransaction;
  });

  getRRWebEvents() {
    return this._rrwebEvents;
  }

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
}
