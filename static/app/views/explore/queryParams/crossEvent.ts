import type {Location} from 'history';

import {defined} from 'sentry/utils';

type CrossEventType = 'logs' | 'span' | 'metric';

export interface CrossEvent {
  query: string;
  type: CrossEventType;
}

export function getCrossEventsFromLocation(
  location: Location,
  key: string
): CrossEvent[] | undefined {
  let json: any;

  if (!defined(location.query?.[key]) || Array.isArray(location.query?.[key])) {
    return undefined;
  }

  try {
    json = JSON.parse(location.query?.[key]);
  } catch {
    return undefined;
  }

  if (Array.isArray(json) && json.every(isCrossEvent)) {
    return json;
  }

  return undefined;
}

function isCrossEvent(value: any): value is CrossEvent {
  return (
    defined(value) &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    typeof value.query === 'string'
  );
}
