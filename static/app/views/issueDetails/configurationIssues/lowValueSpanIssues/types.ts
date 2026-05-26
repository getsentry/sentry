import type {EventOccurrence} from 'sentry/types/event';

export interface LowValueSpanEvidenceData {
  avgDurationMs: number | null;
  count: number | null;
  description: string | null;
  estimatedCostUsd: number | null;
  op: string | null;
  sdkName: string | null;
}

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getLowValueSpanEvidenceData(
  evidenceData: EventOccurrence['evidenceData'] | null | undefined
): LowValueSpanEvidenceData {
  return {
    op: getStringValue(evidenceData?.op),
    description: getStringValue(evidenceData?.description),
    count: getNumberValue(evidenceData?.count),
    avgDurationMs: getNumberValue(evidenceData?.avg_duration_ms),
    estimatedCostUsd: getNumberValue(evidenceData?.estimated_cost_usd),
    sdkName: getStringValue(evidenceData?.sdk_name),
  };
}
