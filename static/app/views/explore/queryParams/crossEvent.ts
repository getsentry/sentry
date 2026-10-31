import {defined} from 'sentry/utils/defined';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export type CrossEventType = 'logs' | 'spans' | 'metrics';

export type CrossEvent =
  | {query: string; type: 'logs' | 'spans'}
  | {metric: TraceMetric; query: string; type: 'metrics'};

export type CrossEventQueryExtras = {
  logQuery: string[];
  metricQuery: string[];
  spanQuery: string[];
};

export function getCrossEvents(rawCrossEvents: string | null): CrossEvent[] | undefined {
  let json: any;

  if (!defined(rawCrossEvents)) {
    return undefined;
  }

  try {
    json = JSON.parse(rawCrossEvents);
  } catch {
    return undefined;
  }

  if (!Array.isArray(json)) {
    return undefined;
  }

  const crossEvents = json.filter(isCrossEvent);
  return crossEvents.length > 0 ? crossEvents : undefined;
}

export function isCrossEventType(value: string): value is CrossEventType {
  return value === 'logs' || value === 'spans' || value === 'metrics';
}

function isCrossEvent(value: any): value is CrossEvent {
  if (
    !defined(value) ||
    typeof value !== 'object' ||
    typeof value.query !== 'string' ||
    typeof value.type !== 'string' ||
    !isCrossEventType(value.type)
  ) {
    return false;
  }

  if (value.type === 'metrics') {
    return (
      defined(value.metric) &&
      typeof value.metric === 'object' &&
      typeof value.metric.name === 'string' &&
      typeof value.metric.type === 'string' &&
      (value.metric.unit === undefined ||
        value.metric.unit === null ||
        typeof value.metric.unit === 'string')
    );
  }

  return true;
}
