export interface LowValueSpanEvidenceData {
  avgDurationMs: number | null;
  count: number | null;
  description: string | null;
  extrapolatedCount: number | null;
  op: string | null;
  spanOrigin: string | null;
}
