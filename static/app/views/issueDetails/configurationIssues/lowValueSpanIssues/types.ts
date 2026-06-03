import type {EventOccurrence} from 'sentry/types/event';

export interface LowValueSpanEvidenceData {
  avgDurationMs: number | null;
  count: number | null;
  description: string | null;
  estimatedCostUsd: number | null;
  extrapolatedCount: number | null;
  op: string | null;
  spanOrigin: string | null;
}

type LowValueSpanEvidencePayload = Partial<{
  analysisEnd: unknown;
  analysisStart: unknown;
  avgDurationMs: unknown;
  count: unknown;
  description: unknown;
  estimatedCostUsd: unknown;
  extrapolatedCount: unknown;
  op: unknown;
  spanOrigin: unknown;
  valueScore: unknown;
}>;

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getLowValueSpanEvidenceData(
  evidenceData: EventOccurrence['evidenceData'] | null | undefined
): LowValueSpanEvidenceData {
  const data = evidenceData as LowValueSpanEvidencePayload | null | undefined;

  return {
    op: getStringValue(data?.op),
    description: getStringValue(data?.description),
    count: getNumberValue(data?.count),
    extrapolatedCount: getNumberValue(data?.extrapolatedCount),
    avgDurationMs: getNumberValue(data?.avgDurationMs),
    estimatedCostUsd: getNumberValue(data?.estimatedCostUsd),
    spanOrigin: getStringValue(data?.spanOrigin),
  };
}
