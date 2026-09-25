import type {Theme} from '@emotion/react';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
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

export function reasonTitle(reason: string): string {
  return REASON_TITLES[reason] ?? reason;
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
  const description = REASON_DESCRIPTIONS[reason];
  return typeof description === 'function'
    ? description(dataTypeName(category))
    : description;
}

export function hasDroppedData(
  droppedAnnotations: Annotation[] | undefined
): droppedAnnotations is Annotation[] {
  return (
    defined(droppedAnnotations) &&
    droppedAnnotations.some(annotation => !isConfiguredDrop(annotation))
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
