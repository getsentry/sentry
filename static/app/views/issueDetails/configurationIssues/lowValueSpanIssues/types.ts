export interface LowValueSpanEvidenceData {
  avgDurationMs: number | null;
  count: number | null;
  description: string | null;
  estimatedCostUsd: number | null;
  extrapolatedCount: number | null;
  op: string | null;
  spanOrigin: string | null;
}
