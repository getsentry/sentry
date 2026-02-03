import type {Location} from 'history';

import {defined} from 'sentry/utils';

export type CrossEventType = 'logs' | 'spans' | 'metrics';

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

export function isCrossEventType(value: string): value is CrossEventType {
  return value === 'logs' || value === 'spans' || value === 'metrics';
}

function isCrossEvent(value: any): value is CrossEvent {
  return (
    defined(value) &&
    typeof value === 'object' &&
    typeof value.query === 'string' &&
    typeof value.type === 'string' &&
    isCrossEventType(value.type)
  );
}
