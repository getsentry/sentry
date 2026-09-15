import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export const MAX_SEVERITY = 4;

/**
 * A group of annotations that share the same time bucket
 */
export interface AnnotationBucket {
  annotations: Annotation[];
  droppedTotal: number;
  end: number;
  severity: number;
  start: number;
}

// TODO: the way we paint + calculate severity will change once
// https://github.com/getsentry/sentry/pull/124298 is merged, hence leaving
// mildly untested.
function severityForCount(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) {
    return 0;
  }

  return Math.min(
    MAX_SEVERITY,
    Math.max(1, Math.ceil((count / maxCount) * MAX_SEVERITY))
  );
}

/**
 * Group annotations by their `(start, end)` time bucket, summing `droppedCount`
 * into each bucket's `droppedTotal`, then assign every bucket a window-relative
 * `severity`.
 */
export function groupIntoBuckets(annotations: Annotation[]): AnnotationBucket[] {
  const byBucket = new Map<string, AnnotationBucket>();
  for (const annotation of annotations) {
    const key = `${annotation.start}-${annotation.end}`;
    const existing = byBucket.get(key);
    if (existing) {
      existing.droppedTotal += annotation.droppedCount;
      existing.annotations.push(annotation);
    } else {
      byBucket.set(key, {
        start: annotation.start,
        end: annotation.end,
        droppedTotal: annotation.droppedCount,
        severity: 0,
        annotations: [annotation],
      });
    }
  }

  const buckets = Array.from(byBucket.values());
  const maxCount = Math.max(0, ...buckets.map(bucket => bucket.droppedTotal));
  for (const bucket of buckets) {
    bucket.severity = severityForCount(bucket.droppedTotal, maxCount);
  }
  return buckets;
}
