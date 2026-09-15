import type {DataFidelityAnnotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export const MAX_SEVERITY = 4;
export const PILL_HEIGHT = 3;
export const PILL_GAP = 2;
export const BAND_PADDING = 4;
export const PILL_STACK_HEIGHT =
  MAX_SEVERITY * PILL_HEIGHT + (MAX_SEVERITY - 1) * PILL_GAP;
export const BAND_HEIGHT = BAND_PADDING + PILL_STACK_HEIGHT + BAND_PADDING;

/**
 * Map a dropped count onto 1–4 pills relative to the worst bucket in the
 * current window. Absolute cutoffs (100k, etc.) saturate once volume is in
 * the millions; ranking against `maxCount` keeps the stack as a local
 * intensity scale. A single bucket always reads as 4.
 */
export function severityForCount(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) {
    return 0;
  }

  return Math.min(
    MAX_SEVERITY,
    Math.max(1, Math.ceil((count / maxCount) * MAX_SEVERITY))
  );
}

export interface Bucket {
  annotations: DataFidelityAnnotation[];
  end: number;
  severity: number;
  start: number;
  total: number;
}

export function groupIntoBuckets(annotations: DataFidelityAnnotation[]): Bucket[] {
  const byBucket = new Map<string, Bucket>();
  for (const annotation of annotations) {
    const key = `${annotation.start}-${annotation.end}`;
    const existing = byBucket.get(key);
    if (existing) {
      existing.total += annotation.droppedCount;
      existing.annotations.push(annotation);
    } else {
      byBucket.set(key, {
        start: annotation.start,
        end: annotation.end,
        total: annotation.droppedCount,
        severity: 0,
        annotations: [annotation],
      });
    }
  }

  const buckets = Array.from(byBucket.values());
  const maxCount = Math.max(0, ...buckets.map(bucket => bucket.total));
  for (const bucket of buckets) {
    bucket.severity = severityForCount(bucket.total, maxCount);
  }
  return buckets;
}
