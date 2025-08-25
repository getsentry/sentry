import moment from 'moment-timezone';

import {getTraceDateTimeRange} from 'sentry/components/events/interfaces/spans/utils';
import type {Event, EventTransaction} from 'sentry/types/event';

function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}
export function getTraceTimeRangeFromEvent(event: Event): {end: string; start: string} {
  const start = isTransaction(event)
    ? event.startTimestamp
    : moment(event.dateReceived ? event.dateReceived : event.dateCreated).valueOf() /
      1000;
  const end = isTransaction(event) ? event.endTimestamp : start;
  return getTraceDateTimeRange({start, end});
}

export function isTraceSplitResult<
  U extends Record<PropertyKey, unknown>,
  V extends readonly unknown[],
>(result: U | V): result is U {
  return 'transactions' in result;
}
