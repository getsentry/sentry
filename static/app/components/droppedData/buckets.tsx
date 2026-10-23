import type {
  DroppedDataBucket,
  OutcomeRow,
  OutcomeVolume,
} from 'sentry/components/droppedData/types';
import {defined} from 'sentry/utils/defined';

const MIN_HIGHLIGHT_RATIO = 0.001;

interface BucketDraft {
  accepted: number;
  byOutcome: Map<string, OutcomeVolume>;
  dropped: number;
  end: number;
  start: number;
}

function getOrCreateDraft(
  drafts: Map<number, BucketDraft>,
  {start, end}: OutcomeRow
): BucketDraft {
  let draft = drafts.get(start);

  if (!draft) {
    draft = {start, end, byOutcome: new Map(), dropped: 0, accepted: 0};
    drafts.set(start, draft);
  }

  return draft;
}

function addDroppedEvent(drafts: Map<number, BucketDraft>, event: OutcomeRow): void {
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

function toBucket(draft: BucketDraft): DroppedDataBucket {
  const total = draft.dropped + draft.accepted;
  const ratio = total > 0 ? draft.dropped / total : 0;

  return {
    start: draft.start,
    end: draft.end,
    byOutcome: Array.from(draft.byOutcome.values()).sort((a, b) => b.count - a.count),
    dropped: draft.dropped,
    accepted: draft.accepted,
    ratio,
  };
}

/**
 * Group events into one bucket per time range, joining dropped and accepted
 * events so every total has a denominator.
 */
export function groupIntoBuckets(
  droppedEvents: OutcomeRow[],
  acceptedEvents: OutcomeRow[] = []
): DroppedDataBucket[] {
  const drafts = new Map<number, BucketDraft>();

  for (const event of acceptedEvents) {
    getOrCreateDraft(drafts, event).accepted += event.count;
  }
  for (const event of droppedEvents) {
    addDroppedEvent(drafts, event);
  }

  return Array.from(drafts.values()).map(toBucket);
}

export function isHighlighted(bucket: DroppedDataBucket): boolean {
  return bucket.ratio >= MIN_HIGHLIGHT_RATIO;
}

export function hasDroppedData(
  droppedEvents: OutcomeRow[] | undefined,
  acceptedEvents?: OutcomeRow[]
): boolean {
  return (
    defined(droppedEvents) &&
    groupIntoBuckets(droppedEvents, acceptedEvents).some(isHighlighted)
  );
}
