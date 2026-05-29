import type {EventOccurrence} from 'sentry/types/event';

export interface LowValueSpanEvidenceData {
  avgDurationMs: number | null;
  description: string | null;
  estimatedCostUsd: number | null;
  extrapolatedCount: number | null;
  op: string | null;
  sdkName: string | null;
  spanCount: number | null;
  spanOrigin: string | null;
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
    op: getStringValue(evidenceData?.op ?? evidenceData?.span_op),
    description: getStringValue(evidenceData?.description ?? evidenceData?.span_description),
    spanCount: getNumberValue(evidenceData?.span_count ?? evidenceData?.count),
    extrapolatedCount: getNumberValue(evidenceData?.extrapolated_count),
    avgDurationMs: getNumberValue(evidenceData?.avg_duration_ms),
    estimatedCostUsd: getNumberValue(evidenceData?.estimated_cost_usd),
    sdkName: getStringValue(evidenceData?.sdk_name),
    spanOrigin: getStringValue(evidenceData?.span_origin),
  };
}
