import {defined} from 'sentry/utils/defined';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export const SEVERITY_OPACITIES = [0.3, 0.5, 0.7, 1] as const;
export const MAX_SEVERITY = SEVERITY_OPACITIES.length;

const CONFIGURED_CLIENT_DISCARD_REASONS = new Set(['before_send', 'sample_rate']);

function isConfiguredDrop({outcome, reason}: Annotation): boolean {
  if (outcome === 'filtered') {
    return true;
  }

  return outcome === 'client_discard' && CONFIGURED_CLIENT_DISCARD_REASONS.has(reason);
}

/**
 * The drop ratio each severity level starts at, parallel to
 * `SEVERITY_OPACITIES`. A bucket under the first cutoff has severity 0 and is
 * never drawn:
 *
 *   (none)  below 5%          draw nothing
 *   1       5% to below 10%   Some data missing
 *   2       10% to below 25%  Significant loss
 *   3       25% to below 50%  Heavy loss
 *   4       50% and above     Most data missing
 */
const SEVERITY_RATIO_THRESHOLDS = [0.05, 0.1, 0.25, 0.5];

/**
 * TODO: temporary. The denominator in `groupIntoBuckets` is every accepted
 * event in the bucket rather than only the accepted events comparable to what
 * was dropped, so real ratios land orders of magnitude below the cutoffs above
 * and the band never draws. Shrinking the cutoffs keeps it visible until the
 * backend can return accepted annotations broken down by outcome and reason;
 * delete this and use the cutoffs as-is at that point.
 *
 * `ratio` itself is deliberately left unscaled, so the tooltip still reports
 * the true share and a bucket's color currently reads more severe than its
 * percentage.
 */
const TEMPORARY_THRESHOLD_SCALE = 1 / 10_000;

function severityForRatio(ratio: number): number {
  return SEVERITY_RATIO_THRESHOLDS.filter(
    threshold => ratio >= threshold * TEMPORARY_THRESHOLD_SCALE
  ).length;
}

interface AnnotationVolume {
  eventCount: number;
  byteSize?: number;
}

export interface OutcomeVolume extends AnnotationVolume {
  outcome: string;
}

/**
 * A group of annotations that share the same time bucket.
 */
export interface AnnotationBucket {
  accepted: AnnotationVolume;
  annotations: Annotation[];
  byOutcome: OutcomeVolume[];
  dropped: AnnotationVolume;
  end: number;
  ratio: number;
  severity: number;
  start: number;
}

interface VolumeDraft {
  byteSize: number | undefined;
  eventCount: number;
}

interface BucketDraft {
  accepted: VolumeDraft;
  annotations: Annotation[];
  byOutcome: Map<string, OutcomeVolume & VolumeDraft>;
  dropped: VolumeDraft;
  end: number;
  start: number;
}

function emptyVolume(): VolumeDraft {
  return {eventCount: 0, byteSize: undefined};
}

function addAnnotation(volume: VolumeDraft, annotation: Annotation): void {
  volume.eventCount += annotation.eventCount;

  if (defined(annotation.byteSize)) {
    volume.byteSize = (volume.byteSize ?? 0) + annotation.byteSize;
  }
}

/**
 * Group dropped annotations by their `(start, end)` time bucket, joining the
 * accepted volume for the same bucket so every total has a denominator.
 */
export function groupIntoBuckets(
  droppedAnnotations: Annotation[],
  acceptedAnnotations: Annotation[] = []
): AnnotationBucket[] {
  const drafts = new Map<string, BucketDraft>();

  for (const annotation of droppedAnnotations) {
    if (isConfiguredDrop(annotation)) {
      continue;
    }

    const key = `${annotation.start}-${annotation.end}`;
    let draft = drafts.get(key);

    if (!draft) {
      draft = {
        start: annotation.start,
        end: annotation.end,
        annotations: [],
        byOutcome: new Map(),
        dropped: emptyVolume(),
        accepted: emptyVolume(),
      };
      drafts.set(key, draft);
    }

    draft.annotations.push(annotation);
    addAnnotation(draft.dropped, annotation);

    let outcomeVolume = draft.byOutcome.get(annotation.outcome);
    if (!outcomeVolume) {
      outcomeVolume = {
        outcome: annotation.outcome,
        ...emptyVolume(),
      };
      draft.byOutcome.set(annotation.outcome, outcomeVolume);
    }
    addAnnotation(outcomeVolume, annotation);
  }

  const acceptedByStart = new Map<number, VolumeDraft>();
  for (const annotation of acceptedAnnotations) {
    const accepted = acceptedByStart.get(annotation.start) ?? emptyVolume();
    addAnnotation(accepted, annotation);
    acceptedByStart.set(annotation.start, accepted);
  }

  return Array.from(drafts.values()).map(draft => {
    const accepted = acceptedByStart.get(draft.start) ?? emptyVolume();
    // TODO: we currently do the total based on total accepted, but we don't have the
    // granularity to know the type of accepted outcomes. Therefore, the numbers at the
    // moment are not particularly useful. We need to fix this. Until then
    // `TEMPORARY_THRESHOLD_SCALE` compensates.
    const total = draft.dropped.eventCount + accepted.eventCount;
    const ratio = total > 0 ? draft.dropped.eventCount / total : 0;

    return {
      start: draft.start,
      end: draft.end,
      annotations: draft.annotations,
      byOutcome: Array.from(draft.byOutcome.values()).sort(
        (a, b) => b.eventCount - a.eventCount
      ),
      dropped: draft.dropped,
      accepted,
      ratio,
      severity: severityForRatio(ratio),
    };
  });
}
