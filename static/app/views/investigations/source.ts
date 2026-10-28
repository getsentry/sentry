import {z} from 'zod';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

// Mirrors the snapshot built in src/sentry/investigations/services/breached_metrics.py.
const sourceConditionSchema = z.object({
  type: z.enum(DataConditionType),
  result: z.number(),
  // Dynamic monitors store their sensitivity settings here, not a number.
  comparison: z.union([z.number(), z.record(z.string(), z.unknown())]),
  thresholdChangePercent: z.number().optional(),
});

const sourceMonitorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    aggregate: z.string(),
    query: z.string(),
    environment: z.string().nullable(),
    // Snapshots taken before dynamic and percent monitors were supported leave this out.
    detectionType: z.enum(['static', 'percent', 'dynamic']).optional(),
    comparisonDeltaSeconds: z.number().nullable(),
    // Drop conditions we can't read, such as a type added on the backend later,
    // instead of losing the whole snapshot.
    conditions: z
      .array(sourceConditionSchema.optional().catch(undefined))
      .transform(conditions => conditions.filter(condition => condition !== undefined)),
  })
  .transform(monitor => ({
    ...monitor,
    // Like the backend, a comparison delta makes it a percent monitor.
    detectionType:
      monitor.detectionType ??
      (monitor.comparisonDeltaSeconds === null ? 'static' : 'percent'),
  }));

const metricOpenPeriodSourceSchema = z.object({
  type: z.literal('metric_open_period'),
  ref: z.object({groupId: z.string(), openPeriodId: z.string()}),
  // Investigations created before the snapshot existed only carry `ref`.
  snapshot: z
    .object({monitor: sourceMonitorSchema, project: z.object({slug: z.string()})})
    .optional()
    .catch(undefined),
});

export type SourceMonitor = z.infer<typeof sourceMonitorSchema> & {
  projectSlug: string;
};

function parseMetricOpenPeriodSource(source: InvestigationDetail['source']) {
  const parsed = metricOpenPeriodSourceSchema.safeParse(source);
  return parsed.success ? parsed.data : null;
}

// A breached metric investigation references the metric issue it was started
// from, and snapshots that issue's monitor.
export function getInvestigationSource(investigation: InvestigationDetail) {
  const source = parseMetricOpenPeriodSource(investigation.source);
  return {
    groupId: source?.ref.groupId ?? null,
    monitorName: source?.snapshot?.monitor.name ?? null,
  };
}

export function getSourceMonitor(
  source: InvestigationDetail['source'],
  detectorId: string
): SourceMonitor | null {
  const snapshot = parseMetricOpenPeriodSource(source)?.snapshot;
  if (snapshot?.monitor.id !== detectorId) {
    return null;
  }
  return {...snapshot.monitor, projectSlug: snapshot.project.slug};
}
