import type {
  DroppedDataBucket,
  DroppedEventsBucket,
  EventVolume,
  OutcomeVolume,
} from 'sentry/components/droppedData/types';
import {defined} from 'sentry/utils/defined';

const MIN_HIGHLIGHT_RATIO = 0.001;

interface BucketDraft {
  byOutcome: Map<string, OutcomeVolume>;
  dropped: EventVolume;
  end: number;
  events: DroppedEventsBucket[];
  start: number;
}

function emptyVolume(): EventVolume {
  return {count: 0};
}

function addCount(volume: EventVolume, event: DroppedEventsBucket): void {
  volume.count += event.count;
}

function getOrCreateDraft(
  drafts: Map<number, BucketDraft>,
  {start, end}: DroppedEventsBucket
): BucketDraft {
  let draft = drafts.get(start);

  if (!draft) {
    draft = {start, end, events: [], byOutcome: new Map(), dropped: emptyVolume()};
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

  draft.events.push(event);
  addCount(draft.dropped, event);

  let outcomeVolume = draft.byOutcome.get(event.outcome);
  if (!outcomeVolume) {
    outcomeVolume = {
      outcome: event.outcome,
      ...emptyVolume(),
    };
    draft.byOutcome.set(event.outcome, outcomeVolume);
  }
  addCount(outcomeVolume, event);
}

function acceptedVolumeByStart(events: DroppedEventsBucket[]): Map<number, EventVolume> {
  const volumes = new Map<number, EventVolume>();

  for (const event of events) {
    const accepted = volumes.get(event.start) ?? emptyVolume();
    addCount(accepted, event);
    volumes.set(event.start, accepted);
  }

  return volumes;
}

function toBucket(
  draft: BucketDraft,
  acceptedByStart: Map<number, EventVolume>
): DroppedDataBucket {
  const accepted = acceptedByStart.get(draft.start) ?? emptyVolume();
  const total = draft.dropped.count + accepted.count;
  const ratio = total > 0 ? draft.dropped.count / total : 0;

  return {
    start: draft.start,
    end: draft.end,
    events: draft.events,
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
): droppedEvents is DroppedEventsBucket[] {
  return (
    defined(droppedEvents) &&
    groupIntoBuckets(droppedEvents, acceptedEvents).some(isHighlighted)
  );
}
