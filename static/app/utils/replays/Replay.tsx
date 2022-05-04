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

export default class Replay {
  static factory(
    event: EventTransaction | undefined,
    rrwebEvents: eventWithTime[] | undefined,
    replayEvents: Event[] | undefined
  ) {
    if (!event || !rrwebEvents || !replayEvents) {
      return null;
    }
    return new Replay(event, rrwebEvents, replayEvents);
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

    const last_rrweb = last(this._rrwebEvents);
    const last_breadcrumb = last(breadcrumbs?.data.values as RawCrumb[]);
    const last_span = last(spans?.data as RawSpanType[]);

    // The original `this._event.startTimestamp` and `this._event.endTimestamp`
    // are the same. It's because the root replay event is re-purposing the
    // `transaction` type, but it is not a real span occuring over time.
    // So we need to figure out the real end time (in seconds).
    const endTimestamp =
      Math.max(
        last_rrweb.timestamp,
        +new Date(last_breadcrumb.timestamp || 0),
        last_span.timestamp * 1000
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
      case EntryType.EXCEPTION:
      case EntryType.MESSAGE:
      case EntryType.REQUEST:
      case EntryType.STACKTRACE:
      case EntryType.TEMPLATE:
      case EntryType.CSP:
      case EntryType.EXPECTCT:
      case EntryType.EXPECTSTAPLE:
      case EntryType.HPKP:
      case EntryType.THREADS:
      case EntryType.DEBUGMETA:
      default:
        return undefined;
    }
  });
}
