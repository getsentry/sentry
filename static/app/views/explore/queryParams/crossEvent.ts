import {parseAsJson} from 'nuqs';
import {z} from 'zod';

import {
  traceMetricSchema,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';

export type CrossEventType = 'logs' | 'spans' | 'metrics';

export type CrossEvent =
  | {query: string; type: 'logs' | 'spans'}
  | {metric: TraceMetric; query: string; type: 'metrics'};

export type CrossEventQueryExtras = {
  logQuery: string[];
  metricQuery: string[];
  spanQuery: string[];
};

const crossEventSchema = z.discriminatedUnion('type', [
  z.looseObject({query: z.string(), type: z.enum(['logs', 'spans'])}),
  z.looseObject({
    metric: traceMetricSchema,
    query: z.string(),
    type: z.literal('metrics'),
  }),
]);

const parseAsCrossEventItems = parseAsJson(z.array(z.unknown()));

export function getCrossEvents(rawCrossEvents: string | null): CrossEvent[] | undefined {
  const items = rawCrossEvents ? parseAsCrossEventItems.parse(rawCrossEvents) : null;
  const crossEvents = items?.filter(isCrossEvent) ?? [];
  return crossEvents.length > 0 ? crossEvents : undefined;
}

export function isCrossEventType(value: string): value is CrossEventType {
  return value === 'logs' || value === 'spans' || value === 'metrics';
}

function isCrossEvent(value: unknown): value is CrossEvent {
  return crossEventSchema.safeParse(value).success;
}
