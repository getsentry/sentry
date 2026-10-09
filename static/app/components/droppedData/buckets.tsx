import type {
  DroppedDataBucket,
  DroppedEventsBucket,
  EventVolume,
  OutcomeVolume,
} from 'sentry/components/droppedData/types';
import {defined} from 'sentry/utils/defined';

const CONFIGURED_CLIENT_DISCARD_REASONS = new Set(['before_send', 'sample_rate']);

function isConfiguredDrop({outcome, reason}: DroppedEventsBucket): boolean {
  if (outcome === 'filtered') {
    return true;
  }

  return outcome === 'client_discard' && CONFIGURED_CLIENT_DISCARD_REASONS.has(reason);
}

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

function addDroppedEvent(
  drafts: Map<string, BucketDraft>,
  event: DroppedEventsBucket
): void {
  if (isConfiguredDrop(event)) {
    return;
  }

  const key = `${event.start}-${event.end}`;
  let draft = drafts.get(key);

  if (!draft) {
    draft = {
      start: event.start,
      end: event.end,
      events: [],
      byOutcome: new Map(),
      dropped: emptyVolume(),
    };
    drafts.set(key, draft);
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
 * Group dropped events by their `(start, end)` time bucket, joining the
 * accepted volume for the same bucket so every total has a denominator.
 */
export function groupIntoBuckets(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents: DroppedEventsBucket[] = []
): DroppedDataBucket[] {
  const drafts = new Map<string, BucketDraft>();

  for (const event of droppedEvents) {
    addDroppedEvent(drafts, event);
  }

  const acceptedByStart = acceptedVolumeByStart(acceptedEvents);

  return Array.from(drafts.values()).map(draft => toBucket(draft, acceptedByStart));
}

export function highlightedBuckets(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents?: DroppedEventsBucket[]
): DroppedDataBucket[] {
  return groupIntoBuckets(droppedEvents, acceptedEvents).filter(
    bucket => bucket.ratio > 0
  );
}

export function hasDroppedData(
  droppedEvents: DroppedEventsBucket[] | undefined,
  acceptedEvents?: DroppedEventsBucket[]
): droppedEvents is DroppedEventsBucket[] {
  return (
    defined(droppedEvents) && highlightedBuckets(droppedEvents, acceptedEvents).length > 0
  );
}
