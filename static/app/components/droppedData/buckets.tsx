import type {
  DroppedDataBucket,
  DroppedEventsBucket,
  OutcomeVolume,
} from 'sentry/components/droppedData/types';
import {defined} from 'sentry/utils/defined';

const MIN_HIGHLIGHT_RATIO = 0.001;

interface BucketDraft {
  byOutcome: Map<string, OutcomeVolume>;
  dropped: number;
  end: number;
  start: number;
}

function getOrCreateDraft(
  drafts: Map<number, BucketDraft>,
  {start, end}: DroppedEventsBucket
): BucketDraft {
  let draft = drafts.get(start);

  if (!draft) {
    draft = {start, end, byOutcome: new Map(), dropped: 0};
    drafts.set(start, draft);
  }

  return draft;
}

function addDroppedEvent(
  drafts: Map<number, BucketDraft>,
  event: DroppedEventsBucket
): void {
  const draft = getOrCreateDraft(drafts, event);

  if (!event.tags.includes('unintentional')) {
    return;
  }

  draft.dropped += event.count;

  let outcomeVolume = draft.byOutcome.get(event.outcome);
  if (!outcomeVolume) {
    outcomeVolume = {outcome: event.outcome, count: 0};
    draft.byOutcome.set(event.outcome, outcomeVolume);
  }
  outcomeVolume.count += event.count;
}

function acceptedVolumeByStart(events: DroppedEventsBucket[]): Map<number, number> {
  const volumes = new Map<number, number>();

  for (const event of events) {
    volumes.set(event.start, (volumes.get(event.start) ?? 0) + event.count);
  }

  return volumes;
}

function toBucket(
  draft: BucketDraft,
  acceptedByStart: Map<number, number>
): DroppedDataBucket {
  const accepted = acceptedByStart.get(draft.start) ?? 0;
  const total = draft.dropped + accepted;
  const ratio = total > 0 ? draft.dropped / total : 0;

  return {
    start: draft.start,
    end: draft.end,
    byOutcome: Array.from(draft.byOutcome.values()).sort((a, b) => b.count - a.count),
    dropped: draft.dropped,
    accepted,
    ratio,
  };
}

/**
 * Group events into one bucket per time range, joining dropped and accepted
 * events so every total has a denominator.
 */
export function groupIntoBuckets(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents: DroppedEventsBucket[] = []
): DroppedDataBucket[] {
  const drafts = new Map<number, BucketDraft>();

  for (const event of acceptedEvents) {
    getOrCreateDraft(drafts, event);
  }
  for (const event of droppedEvents) {
    addDroppedEvent(drafts, event);
  }

  const acceptedByStart = acceptedVolumeByStart(acceptedEvents);

  return Array.from(drafts.values()).map(draft => toBucket(draft, acceptedByStart));
}

export function isHighlighted(bucket: DroppedDataBucket): boolean {
  return bucket.ratio >= MIN_HIGHLIGHT_RATIO;
}

export function hasDroppedData(
  droppedEvents: DroppedEventsBucket[] | undefined,
  acceptedEvents?: DroppedEventsBucket[]
): boolean {
  return (
    defined(droppedEvents) &&
    groupIntoBuckets(droppedEvents, acceptedEvents).some(isHighlighted)
  );
}
