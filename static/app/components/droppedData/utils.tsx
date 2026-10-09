import type {Theme} from '@emotion/react';

import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

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

const REASON_TITLES: Record<string, string> = {
  backpressure: t('SDK backpressure drop'),
  before_send: t('Dropped by before send'),
  buffer_overflow: t('SDK buffer overflow'),
  ignore_spans: t('Dropped by ignored spans'),
  network_error: t('Unretried network error'),
  queue_overflow: t('SDK queue overflow'),
  ratelimit_backoff: t('SDK rate-limit backoff'),
  sample_rate: t('Dropped by sample rate'),
  send_error: t('SDK send failure'),
  'error-message': t('Error message filter'),
  'filtered-transaction': t('Filtered transaction'),
  'ip-address': t('IP address filter'),
  'legacy-browsers': t('Legacy browser filter'),
  'release-version': t('Release version filter'),
  'web-crawlers': t('Web crawler filter'),
  internal: t('Sentry processing error'),
  invalid_dsc: t('Invalid trace context'),
  invalid_json: t('Malformed JSON payload'),
  invalid_transaction: t('Invalid transaction data'),
  missing_dsc: t('Missing trace context'),
  'too_large:event': t('Event payload too large'),
  'too_large:log': t('Log payload too large'),
  'too_large:profile': t('Profile payload too large'),
  'too_large:span': t('Span payload too large'),
  'too_large:trace_metric': t('Application metric payload too large'),
  'too_large:transaction': t('Transaction payload too large'),
  generic: t('Generic rate limit'),
  project_abuse_limit: t('Project abuse limit'),
  smart_rate_limit: t('Spike protection'),
  usage_exceeded: t('Quota exceeded'),
};

function normalizeReason(reason: string): string {
  return reason.endsWith('_usage_exceeded') ? 'usage_exceeded' : reason;
}

export function reasonTitle(reason: string): string {
  return REASON_TITLES[normalizeReason(reason)] ?? reason;
}

const REASON_DESCRIPTIONS: Record<
  string,
  string | ((dataType: string | undefined) => string)
> = {
  backpressure: t('SDK reduced trace sampling under load.'),
  before_send: t('Event dropped by your before send function.'),
  buffer_overflow: t('SDK buffer filled before data could be sent.'),
  ignore_spans: t('Span dropped by your ignored spans configuration.'),
  network_error: t('Request failed before reaching Sentry.'),
  queue_overflow: t("SDK's send queue was full."),
  sample_rate: t('Event dropped by your configured sample rate.'),
  send_error: t('Sentry rejected the event with an error response.'),
  'error-message': t('Event message matched one of your custom filters.'),
  'filtered-transaction': t('Transaction matched the default health check filter.'),
  'ip-address': t('Event IP address matched one of your custom filters.'),
  'legacy-browsers': t('Browser matched your legacy browser filter.'),
  'release-version': t('Event release matched one of your custom filters.'),
  'web-crawlers': t("User agent matched Sentry's known crawler list."),
  internal: t('Sentry failed to process the event.'),
  invalid_dsc: t('Trace header did not match the spans sent.'),
  invalid_json: t('Event rejected due to invalid JSON.'),
  invalid_transaction: t('Transaction contained invalid data.'),
  missing_dsc: t('Envelope was missing the required trace header.'),
  'too_large:event': dataType =>
    dataType
      ? t('The %s event exceeded maximum payload size.', dataType)
      : t('The event exceeded maximum payload size.'),
  'too_large:log': t('The log event exceeded maximum payload size.'),
  'too_large:profile': t('The profile event exceeded maximum payload size.'),
  'too_large:span': t('The span event exceeded maximum payload size.'),
  'too_large:trace_metric': t(
    'The application metric event exceeded maximum payload size.'
  ),
  'too_large:transaction': t('The transaction exceeded maximum payload size.'),
  generic: t('Your requests across all event types were rate limited.'),
  project_abuse_limit: dataType =>
    dataType
      ? t('Your %s events exceeded the project abuse limit.', dataType)
      : t('Your events exceeded the project abuse limit.'),
  smart_rate_limit: t('Spike protection dropped events to preserve your quota.'),
  usage_exceeded: dataType =>
    dataType
      ? t('Your organization hit its quota for the %s event type.', dataType)
      : t('Your organization hit its quota for this event type.'),
};

function dataTypeName(category: string): string | undefined {
  return Object.values(DATA_CATEGORY_INFO).find(info => info.name === category)
    ?.displayName;
}

export function reasonDescription(reason: string, category: string): string | undefined {
  const description = REASON_DESCRIPTIONS[normalizeReason(reason)];
  return typeof description === 'function'
    ? description(dataTypeName(category))
    : description;
}

export function hasDroppedData(
  droppedEvents: DroppedEventsBucket[] | undefined,
  acceptedEvents?: DroppedEventsBucket[]
): droppedEvents is DroppedEventsBucket[] {
  return (
    defined(droppedEvents) && highlightedBuckets(droppedEvents, acceptedEvents).length > 0
  );
}

export function getOutcomeColors(
  outcomes: string[],
  theme: Theme
): Record<string, string> {
  const palette = theme.chart.getColorPalette(Math.max(outcomes.length - 1, 0));

  return outcomes.reduce<Record<string, string>>((acc, outcome, index) => {
    acc[outcome] = palette[index % palette.length]!;
    return acc;
  }, {});
}

// Shares run tiny (a reason can be a sliver of all traffic), so floor the
// display at 0.01% rather than rounding to 0%. Matches the drop tooltip.
const SHARE_MIN_VALUE = 0.0001;

export function formatDroppedShare(ratio: number): string {
  return formatPercentage(ratio, 2, {minimumValue: SHARE_MIN_VALUE});
}

function isConfiguredDrop({outcome, reason}: DroppedEventsBucket): boolean {
  if (outcome === 'filtered') {
    return true;
  }

  return outcome === 'client_discard' && CONFIGURED_CLIENT_DISCARD_REASONS.has(reason);
}

export function withAlpha(color: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color.slice(0, 7)}${channel}`.toUpperCase();
}

const SEVERITY_THRESHOLDS = [0, 0.05, 0.1, 0.25, 0.5] as const;

export function severityColor(ratio: number, theme: Theme): string {
  if (ratio <= 0) {
    return withAlpha(theme.tokens.background.secondary, 1);
  }

  const scale = theme.tokens.dataviz.sequential.magma.series5;
  const step = SEVERITY_THRESHOLDS.findLastIndex(threshold => ratio >= threshold);
  return withAlpha(scale[step]!, 1);
}

interface EventVolume {
  count: number;
}

export interface OutcomeVolume extends EventVolume {
  outcome: string;
}

/**
 * Dropped and accepted volume for one chart time bucket.
 */
export interface DroppedDataBucket {
  accepted: EventVolume;
  byOutcome: OutcomeVolume[];
  dropped: EventVolume;
  end: number;
  events: DroppedEventsBucket[];
  ratio: number;
  start: number;
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
