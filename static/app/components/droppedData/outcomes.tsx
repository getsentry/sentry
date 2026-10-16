import type {Theme} from '@emotion/react';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

const OUTCOME_LABELS: Partial<Record<Outcome, string>> = {
  [Outcome.CLIENT_DISCARD]: t('Client Discard'),
  [Outcome.FILTERED]: t('Inbound Filter'),
  [Outcome.INVALID]: t('Invalid or Malformed'),
  [Outcome.RATE_LIMITED]: t('Rate Limited'),
  [Outcome.ABUSE]: t('Abuse Limit'),
  [Outcome.CARDINALITY_LIMITED]: t('Cardinality Limit'),
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
  no_parent_span: t('Missing parent span'),
  queue_overflow: t('SDK queue overflow'),
  ratelimit_backoff: t('SDK rate-limit backoff'),
  sample_rate: t('Dropped by sample rate'),
  send_error: t('SDK send failure'),
  'error-message': t('Error message filter'),
  'filtered-transaction': t('Filtered transaction'),
  'ip-address': t('IP address filter'),
  'legacy-browsers': t('Legacy browser filter'),
  localhost: t('Localhost filter'),
  'release-version': t('Release version filter'),
  'web-crawlers': t('Web crawler filter'),
  cors: t('Disallowed origin'),
  internal: t('Sentry processing error'),
  invalid_dsc: t('Invalid trace context'),
  invalid_json: t('Malformed JSON payload'),
  invalid_transaction: t('Invalid transaction data'),
  missing_dsc: t('Missing trace context'),
  timestamp: t('Invalid timestamp'),
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
  if (reason === 'ignored') {
    return 'ignore_spans';
  }
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
  no_parent_span: t('Span skipped because no parent span was active.'),
  queue_overflow: t("SDK's send queue was full."),
  sample_rate: t('Event dropped by your configured sample rate.'),
  send_error: t('Sentry rejected the event with an error response.'),
  'error-message': t('Event message matched one of your custom filters.'),
  'filtered-transaction': t('Transaction matched the default health check filter.'),
  'ip-address': t('Event IP address matched one of your custom filters.'),
  'legacy-browsers': t('Browser matched your legacy browser filter.'),
  localhost: t('Event was sent from a local address.'),
  'release-version': t('Event release matched one of your custom filters.'),
  'web-crawlers': t("User agent matched Sentry's known crawler list."),
  cors: t("Origin not in project's Allowed Domains."),
  internal: t('Sentry failed to process the event.'),
  invalid_dsc: t('Trace header did not match the spans sent.'),
  invalid_json: t('Event rejected due to invalid JSON.'),
  invalid_transaction: t('Transaction contained invalid data.'),
  missing_dsc: t('Envelope was missing the required trace header.'),
  timestamp: t('Event timestamp was too far in the past or future.'),
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

const REASON_LONG_DESCRIPTIONS: Record<string, string> = {
  backpressure: t(
    'Your SDK detected that it was under load and automatically reduced trace sampling to keep telemetry processing from putting additional pressure on your application. The discarded spans never left your application.'
  ),
  before_send: t(
    'Your before send function or your ignore spans configuration omitted the event. If you think this is unintentional, double check your Sentry configuration.'
  ),
  buffer_overflow: t(
    'A fixed-size in-memory buffer in the SDK reached its limit and dropped data. This is most often caused by a session replay exceeding its size cap.'
  ),
  ignore_spans: t(
    'Spans matching the ignored spans in your SDK configuration were omitted before being sent to Sentry.'
  ),
  network_error: t(
    'The request failed outright without receiving a response, often caused by ad blockers and browser extensions.'
  ),
  no_parent_span: t(
    'The SDK only records some spans, such as outgoing requests, when a parent span is active. Without one, the span is never created, so no data was lost.'
  ),
  queue_overflow: t(
    'Your application is generating events faster than the SDK can buffer and send them. The SDK allows a limited number of operations in flight at once; beyond that, new events are dropped immediately rather than queued.'
  ),
  ratelimit_backoff: t(
    'Your SDK discarded data locally while backing off, usually because Sentry had earlier told it to pause sending that data type. The real cause is whatever triggered that original limit.'
  ),
  sample_rate: t('Events dropped normally due to your configured client sample rate.'),
  send_error: t('The event reached Sentry but was rejected with an error code.'),
  'error-message': t(
    'The event matched a custom glob provided in your error message filter settings.'
  ),
  'filtered-transaction': t(
    "The transaction name matched Sentry's health check filter, which drops transactions for endpoints like /health, /healthz, /ping, and /ready. This filter is enabled by default."
  ),
  'ip-address': t(
    'The event matched a range of IP addresses provided in a custom filter rule.'
  ),
  'legacy-browsers': t(
    'The event was filtered because the reporting browser matched the legacy browsers inbound filter. This rule filters out events from older web browsers that are likely to provide broken telemetry.'
  ),
  localhost: t(
    "The event was filtered because it came from a local address such as localhost or 127.0.0.1. This rule is enabled in your project's inbound filter settings."
  ),
  'release-version': t(
    'The event matched a custom release filter rule provided in your settings.'
  ),
  'web-crawlers': t(
    "Data was filtered because the reporting user agent matched Sentry's list of known web crawlers."
  ),
  cors: t(
    "Data was rejected because the request's Origin header, or its Referer header when there is no Origin, did not match any entry in your project's Allowed Domains. Requests that send neither header always pass."
  ),
  internal: t(
    "This indicates a bug or an infrastructure problem on Sentry's ingestion side. During healthy operation this should be zero."
  ),
  invalid_dsc: t(
    'The trace ID provided in the trace header did not match the trace ID of the spans sent.'
  ),
  invalid_json: t('Sentry could not parse the event that was sent.'),
  invalid_transaction: t(
    'The transaction was valid JSON but semantically could not be accepted.'
  ),
  missing_dsc: t('The envelope contained spans but no trace header.'),
  timestamp: t(
    "The event's timestamp was outside the range Sentry accepts, either older than the retention window or too far in the future. This is usually caused by an incorrect clock on the device that sent it."
  ),
  'too_large:event': t('The event exceeded the maximum payload size.'),
  'too_large:log': t('The log event exceeded the maximum payload size.'),
  'too_large:span': t('The span event exceeded the maximum payload size.'),
  'too_large:trace_metric': t(
    'The application metric event exceeded the maximum payload size.'
  ),
  'too_large:transaction': t(
    'The transaction exceeded the maximum payload size. Transactions carry their spans inline, so payload size is usually driven by span count rather than by any single large field.'
  ),
  generic: t(
    "Your requests were throttled by Sentry's edge protection rather than by a quota. This applies to a single DSN key and to all data types, for the duration Sentry indicated in its Retry-After response."
  ),
  project_abuse_limit: t(
    "Your project exceeded Sentry's abuse limit for a data type. This is a rate limit measured over a short window, not your billing quota and not spike protection."
  ),
  smart_rate_limit: t(
    'Spike protection detected a sudden increase in event volume for this project and began dropping events to stop the spike from consuming your quota.'
  ),
  usage_exceeded: t(
    "Your organization's quota for this data category was fully consumed and no pay-as-you-go budget remained."
  ),
};

export function reasonLongDescription(reason: string): string | undefined {
  return REASON_LONG_DESCRIPTIONS[normalizeReason(reason)];
}

export function dataCategoryInfo(category: string) {
  return Object.values(DATA_CATEGORY_INFO).find(info => info.name === category);
}

export function reasonDescription(reason: string, category: string): string | undefined {
  const description = REASON_DESCRIPTIONS[normalizeReason(reason)];
  return typeof description === 'function'
    ? description(dataCategoryInfo(category)?.displayName)
    : description;
}

export function buildInvestigatePrompt(args: {
  category: string;
  dataset: DiscoverDatasets;
  outcome: string;
  reason: string;
}): string {
  const outcome = outcomeLabel(args.outcome);
  const reason = reasonTitle(args.reason);
  const detail = reasonDescription(args.reason, args.category);
  return t(
    'My %s data is being dropped as "%s" (%s).%s Why is this happening and how do I fix it?',
    args.dataset,
    outcome,
    reason,
    detail ? ` ${detail}` : ''
  );
}

export type OutcomeColors = Record<string, string>;

export function getOutcomeColors(outcomes: string[], theme: Theme): OutcomeColors {
  const orderedOutcomes = [...new Set(outcomes)].sort();
  const palette = theme.chart.getColorPalette(Math.max(orderedOutcomes.length - 1, 0));

  return orderedOutcomes.reduce<OutcomeColors>((acc, outcome, index) => {
    acc[outcome] = palette[index % palette.length]!;
    return acc;
  }, {});
}

export type OutcomeSelection = Record<string, boolean>;

export function isOutcomeSelected(selection: OutcomeSelection, outcome: string): boolean {
  return selection[outcome] !== false;
}

// Shares run tiny (a reason can be a sliver of all traffic), so floor the
// display at 0.01% rather than rounding to 0%. Matches the drop tooltip.
const SHARE_MIN_VALUE = 0.0001;

export function formatDroppedShare(ratio: number): string {
  return formatPercentage(ratio, 2, {minimumValue: SHARE_MIN_VALUE});
}
