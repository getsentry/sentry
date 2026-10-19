import type {
  DroppedDataBucket,
  DroppedEventsBucket,
  EventVolume,
  OutcomeVolume,
} from 'sentry/components/droppedData/types';
import {defined} from 'sentry/utils/defined';

// TODO: The configured vs. unintentional classification will become a backend
// setting. Read it from the API once it's exposed instead of hardcoding it here.
const CONFIGURED_OUTCOMES = new Set(['client_sampled', 'filtered']);

const MIN_HIGHLIGHT_RATIO = 0.001;

const CONFIGURED_REASONS_BY_OUTCOME: Record<string, Set<string>> = {
  client_discard: new Set([
    'before_send',
    'event_processor',
    'ignored',
    'no_parent_span',
    'sample_rate',
  ]),
  invalid: new Set(['cors', 'missing_signature', 'transaction_sampled']),
  rate_limited: new Set(['key_quota']),
};

function isConfiguredDrop({outcome, reason}: DroppedEventsBucket): boolean {
  if (CONFIGURED_OUTCOMES.has(outcome)) {
    return true;
  }

  return CONFIGURED_REASONS_BY_OUTCOME[outcome]?.has(reason) ?? false;
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

  if (isConfiguredDrop(event)) {
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
