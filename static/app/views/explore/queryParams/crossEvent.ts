import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export interface CrossEvent {
  crossEvent: string;
}

export function defaultCrossEvents() {
  return [{crossEvent: ''}];
}

export function getCrossEventsFromLocation(
  location: Location,
  key: string
): CrossEvent[] | null {
  const rawCrossEvents = decodeList(location.query?.[key]);

  if (rawCrossEvents.length) {
    return rawCrossEvents.map(crossEvent => ({crossEvent}));
  }

  return null;
}

export function isCrossEvent(value: any): value is CrossEvent {
  return (
    defined(value) && typeof value === 'object' && typeof value.crossEvent === 'string'
  );
}
