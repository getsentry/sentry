import {defined} from 'sentry/utils/defined';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

const CONFIGURED_CLIENT_DISCARD_REASONS = new Set(['before_send', 'sample_rate']);

function isConfiguredDrop({outcome, reason}: Annotation): boolean {
  if (outcome === 'filtered') {
    return true;
  }

  return outcome === 'client_discard' && CONFIGURED_CLIENT_DISCARD_REASONS.has(reason);
}

/**
 * Severity opacity is a gradient from 0.15 to 1,
 * clamping full opacity at 0.5.
 */
const MIN_OPACITY = 0.15;
const FULL_AT_RATIO = 0.5;

export function opacityForRatio(ratio: number): number {
  if (ratio <= 0) {
    return 0;
  }

  return Math.min(1, MIN_OPACITY + (1 - MIN_OPACITY) * (ratio / FULL_AT_RATIO));
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
    };
  });
}
