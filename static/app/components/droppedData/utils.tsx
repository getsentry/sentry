import {t} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

const CONFIGURED_CLIENT_DISCARD_REASONS = new Set(['before_send', 'sample_rate']);

const OUTCOME_LABELS: Partial<Record<Outcome, string>> = {
  [Outcome.CLIENT_DISCARD]: t('Client discard'),
  [Outcome.FILTERED]: t('Inbound filter'),
  [Outcome.INVALID]: t('Invalid or malformed'),
  [Outcome.RATE_LIMITED]: t('Rate limited'),
  [Outcome.ABUSE]: t('Abuse limit'),
  [Outcome.CARDINALITY_LIMITED]: t('Cardinality limit'),
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome as Outcome] ?? outcome;
}

// Shares run tiny (a reason can be a sliver of all traffic), so floor the
// display at 0.01% rather than rounding to 0%. Matches the drop tooltip.
const SHARE_MIN_VALUE = 0.0001;

export function formatDroppedShare(ratio: number): string {
  return formatPercentage(ratio, 2, {minimumValue: SHARE_MIN_VALUE});
}

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

export interface DroppedData {
  accepted?: Annotation[];
  dropped?: Annotation[];
  onClick?: (bucket: AnnotationBucket) => void;
  visible?: boolean;
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

function addDroppedAnnotation(
  drafts: Map<string, BucketDraft>,
  annotation: Annotation
): void {
  if (isConfiguredDrop(annotation)) {
    return;
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

function acceptedVolumeByStart(annotations: Annotation[]): Map<number, VolumeDraft> {
  const volumes = new Map<number, VolumeDraft>();

  for (const annotation of annotations) {
    const accepted = volumes.get(annotation.start) ?? emptyVolume();
    addAnnotation(accepted, annotation);
    volumes.set(annotation.start, accepted);
  }

  return volumes;
}

function toBucket(
  draft: BucketDraft,
  acceptedByStart: Map<number, VolumeDraft>
): AnnotationBucket {
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
    addDroppedAnnotation(drafts, annotation);
  }

  const acceptedByStart = acceptedVolumeByStart(acceptedAnnotations);

  return Array.from(drafts.values()).map(draft => toBucket(draft, acceptedByStart));
}

export interface ReasonRow {
  droppedBuckets: number;
  events: number;
  lastSeen: number;
  outcome: string;
  reason: string;
  shareRatio: number;
}

export interface CategorySection {
  events: number;
  label: string;
  outcome: string;
  reasons: ReasonRow[];
  shareRatio: number;
}

interface ReasonAggregate {
  buckets: Set<number>;
  events: number;
  lastSeen: number;
}

/**
 * Group dropped annotations into one section per outcome, each with a row per
 * reason. Shares are computed against total events (accepted + dropped); a
 * reason's `droppedBuckets` counts the distinct time buckets it appears in.
 *
 * `now` clamps `lastSeen`: the most recent bucket is still filling, so its
 * `end` is in the future — without the clamp a reason dropping right now would
 * render as last seen in the future.
 */
export function annotationsToCategorySections(
  droppedAnnotations: Annotation[],
  acceptedAnnotations: Annotation[],
  now: number = Date.now()
): CategorySection[] {
  const reasonsByOutcome = new Map<string, Map<string, ReasonAggregate>>();
  const eventsByOutcome = new Map<string, number>();
  let totalDroppedEvents = 0;

  for (const annotation of droppedAnnotations) {
    const {outcome, reason, eventCount, start, end} = annotation;
    totalDroppedEvents += eventCount;
    eventsByOutcome.set(outcome, (eventsByOutcome.get(outcome) ?? 0) + eventCount);

    const reasons = reasonsByOutcome.get(outcome) ?? new Map<string, ReasonAggregate>();
    const aggregate = reasons.get(reason) ?? {
      events: 0,
      buckets: new Set<number>(),
      lastSeen: 0,
    };
    aggregate.events += eventCount;
    aggregate.buckets.add(start);
    aggregate.lastSeen = Math.max(aggregate.lastSeen, end);
    reasons.set(reason, aggregate);
    reasonsByOutcome.set(outcome, reasons);
  }

  const totalAcceptedEvents = acceptedAnnotations.reduce(
    (sum, annotation) => sum + annotation.eventCount,
    0
  );
  const totalEvents = totalAcceptedEvents + totalDroppedEvents;
  const share = (events: number) => (totalEvents === 0 ? 0 : events / totalEvents);

  const sections: CategorySection[] = [];
  for (const [outcome, reasons] of reasonsByOutcome) {
    const sectionEvents = eventsByOutcome.get(outcome) ?? 0;

    const reasonRows: ReasonRow[] = [];
    for (const [reason, aggregate] of reasons) {
      reasonRows.push({
        outcome,
        reason,
        events: aggregate.events,
        droppedBuckets: aggregate.buckets.size,
        lastSeen: Math.min(aggregate.lastSeen, now),
        shareRatio: share(aggregate.events),
      });
    }
    reasonRows.sort((a, b) => b.events - a.events);

    sections.push({
      outcome,
      label: outcomeLabel(outcome),
      events: sectionEvents,
      shareRatio: share(sectionEvents),
      reasons: reasonRows,
    });
  }
  sections.sort((a, b) => b.events - a.events);

  return sections;
}
