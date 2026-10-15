import {t} from 'sentry/locale';

type ReasonShort = string | ((dataType: string) => string);

interface ReasonInfo {
  title: string;
  short?: ReasonShort;
}

// One entry per drop reason, keyed by the reason code Relay/Sentry emits.
// `title` is the row heading, `short` the muted sub-line.
// Content mirrors the "Dropped Events Descriptions" registry.
export const REASON_INFO: Record<string, ReasonInfo> = {
  before_send: {
    title: t('Dropped by before send'),
    short: t('Event dropped by your before send function.'),
  },
  ignore_spans: {
    title: t('Dropped by ignored spans'),
    short: t('Span dropped by your ignored spans configuration.'),
  },
  sample_rate: {
    title: t('Dropped by sample rate'),
    short: t('Event dropped by your configured sample rate.'),
  },
  no_parent_span: {
    title: t('Missing parent span'),
    short: t('Span skipped because no parent span was active.'),
  },
  event_processor: {
    title: t('Event processor'),
    short: t('Dropped by an SDK event processor.'),
  },
  backpressure: {
    title: t('SDK backpressure drop'),
    short: t('SDK reduced trace sampling under load.'),
  },
  queue_overflow: {
    title: t('SDK queue overflow'),
    short: t("SDK's send queue was full."),
  },
  buffer_overflow: {
    title: t('SDK buffer overflow'),
    short: t('SDK buffer filled before data could be sent.'),
  },
  network_error: {
    title: t('Unretried network error'),
    short: t('Request failed before reaching Sentry.'),
  },
  send_error: {
    title: t('SDK send failure'),
    short: t('Sentry rejected the event with an error response.'),
  },
  cache_overflow: {
    title: t('Cache overflow'),
    short: t("SDK's offline cache was full."),
  },
  internal_sdk_error: {
    title: t('Internal SDK error'),
    short: t('SDK hit an internal error.'),
  },
  insufficient_data: {
    title: t('Insufficient data'),
    short: t('Not enough data to send.'),
  },
  invalid: {
    title: t('Failed SDK validation'),
    short: t("Data failed the SDK's validation checks."),
  },
  callback_error: {
    title: t('Callback error'),
    short: t('An SDK callback threw an error.'),
  },
  ratelimit_backoff: {
    title: t('SDK rate-limit backoff'),
    short: t('SDK backed off due to a rate limit.'),
  },
  'filtered-transaction': {
    title: t('Filtered transaction'),
    short: t('Transaction matched the default health check filter.'),
  },
  'error-message': {
    title: t('Error message filter'),
    short: t('Event message matched one of your custom filters.'),
  },
  'release-version': {
    title: t('Release version filter'),
    short: t('Event release matched one of your custom filters.'),
  },
  'ip-address': {
    title: t('IP address filter'),
    short: t('Event IP address matched one of your custom filters.'),
  },
  'legacy-browsers': {
    title: t('Legacy browser filter'),
    short: t('Browser matched your legacy browser filter.'),
  },
  'web-crawlers': {
    title: t('Web crawler filter'),
    short: t("User agent matched Sentry's known crawler list."),
  },
  localhost: {
    title: t('Localhost filter'),
    short: t('Event was sent from a local address.'),
  },
  'browser-extensions': {
    title: t('Browser extensions filter'),
    short: t('Error came from a browser extension.'),
  },
  'invalid-csp': {
    title: t('Invalid CSP report'),
    short: t('CSP report ignored or unsupported.'),
  },
  'denied-name': {
    title: t('Denied metric name'),
    short: t('Legacy: metric name was on a block list.'),
  },
  'disabled-namespace': {
    title: t('Unsupported metric namespace'),
    short: t('Metrics sent to an unsupported namespace.'),
  },
  discarded: {
    title: t('Discarded transaction'),
    short: t('Transaction kept as spans instead.'),
  },
  'react-hydration-errors': {
    title: t('React hydration errors filter'),
    short: t('Error was a React hydration error.'),
  },
  'chunk-load-error': {
    title: t('ChunkLoadError filter'),
    short: t('Error was a ChunkLoadError.'),
  },
  'custom-error': {
    title: t('Sentry-managed error filter'),
    short: t('Error matched a known malicious payload.'),
  },
  'log-message': {
    title: t('Log message filter'),
    short: t('Log message matched an inbound filter.'),
  },
  'trace-metric-name': {
    title: t('Application metric name filter'),
    short: t('Metric name matched an inbound filter.'),
  },
  'custom-inbound-filter': {
    title: t('Custom inbound filter'),
    short: t('Matched a custom inbound filter.'),
  },
  internal: {
    title: t('Sentry processing error'),
    short: t('Sentry failed to process the event.'),
  },
  invalid_dsc: {
    title: t('Invalid trace context'),
    short: t('Trace header did not match the spans sent.'),
  },
  invalid_json: {
    title: t('Malformed JSON payload'),
    short: t('Event rejected due to invalid JSON.'),
  },
  invalid_transaction: {
    title: t('Invalid transaction data'),
    short: t('Transaction contained invalid data.'),
  },
  missing_dsc: {
    title: t('Missing trace context'),
    short: t('Envelope was missing the required trace header.'),
  },
  timestamp: {
    title: t('Invalid timestamp'),
    short: t('Event timestamp was too far in the past or future.'),
  },
  cors: {
    title: t('Disallowed origin'),
    short: t("Origin not in project's Allowed Domains."),
  },
  project_id: {
    title: t('Invalid or disabled project'),
    short: t('DSN mismatch or disabled project or key.'),
  },
  invalid_event_id: {
    title: t('Invalid event ID'),
    short: t('Event ID was malformed or missing.'),
  },
  auth_version: {
    title: t('Unsupported protocol version'),
    short: t('Legacy: unsupported protocol version.'),
  },
  content_type: {
    title: t('Unsupported content type'),
    short: t('Legacy: unsupported content type.'),
  },
  request_too_large: {
    title: t('Request too large'),
    short: t('Request exceeded a size or parsing limit.'),
  },
  feature_disabled: {
    title: t('Feature disabled'),
    short: t('Feature not enabled for org or project.'),
  },
  duplicate: {
    title: t('Duplicate ID'),
    short: t('Span ID repeated in the same envelope.'),
  },
  duplicate_item: {
    title: t('Duplicate envelope item'),
    short: t('Envelope had duplicate or mixed items.'),
  },
  transaction_attachment: {
    title: t('Transaction attachment'),
    short: t('Legacy: attachment sent with transaction.'),
  },
  transaction_sampled: {
    title: t('Dynamic sampling'),
    short: t('Legacy: dropped by dynamic sampling.'),
  },
  // Relay emits `Sampled:<rule_ids>`; normalizeReason strips the suffix.
  Sampled: {
    title: t('Dynamic sampling'),
    short: t('Dropped by a dynamic sampling rule.'),
  },
  payload: {
    title: t('Unprocessable crash payload'),
    short: t('Console crash data could not be processed.'),
  },
  empty_body: {
    title: t('Empty request body'),
    short: t('Request body was empty.'),
  },
  invalid_body: {
    title: t('Unreadable request body'),
    short: t('Minidump upload body could not be read.'),
  },
  invalid_compression: {
    title: t('Invalid compression'),
    short: t('Crash file could not be decompressed.'),
  },
  invalid_envelope: {
    title: t('Unsupported envelope item'),
    short: t('Envelope item was not allowed or supported.'),
  },
  invalid_msgpack: {
    title: t('Invalid MessagePack'),
    short: t('Crash event or breadcrumbs failed to parse.'),
  },
  invalid_proto: {
    title: t('Invalid OTLP protobuf'),
    short: t('OTLP protobuf payload could not be decoded.'),
  },
  invalid_multipart: {
    title: t('Invalid multipart upload'),
    short: t('Multipart upload could not be parsed.'),
  },
  nesting_too_deep: {
    title: t('Nesting too deep'),
    short: t('Form-data keys nested over 15 levels deep.'),
  },
  no_data: {
    title: t('No data'),
    short: t('No valid data was left after validation.'),
  },
  no_event_payload: {
    title: t('Missing event payload'),
    short: t('Crash or profile was missing its event.'),
  },
  invalid_span: {
    title: t('Invalid span'),
    short: t('Span was missing fields or had a bad ID.'),
  },
  invalid_log: {
    title: t('Invalid log'),
    short: t('Log was missing a required field.'),
  },
  invalid_trace_metric: {
    title: t('Invalid metric'),
    short: t('Metric had no name or a bad type or value.'),
  },
  invalid_check_in: {
    title: t('Invalid check-in'),
    short: t('Check-in had a bad slug or environment.'),
  },
  invalid_span_attachment: {
    title: t('Invalid span attachment'),
    short: t('Span attachment had no matching span.'),
  },
  invalid_trace_attachment: {
    title: t('Invalid trace attachment'),
    short: t('Trace attachment metadata was invalid.'),
  },
  invalid_replay: {
    title: t('Invalid replay'),
    short: t('Replay event was malformed or missing IDs.'),
  },
  invalid_replay_no_payload: {
    title: t('Empty replay event'),
    short: t('Replay event contained no data.'),
  },
  invalid_replay_pii_scrubber_failed: {
    title: t('Replay scrubbing failed'),
    short: t('PII scrubbing of the replay event failed.'),
  },
  invalid_replay_recording: {
    title: t('Invalid replay recording'),
    short: t('Replay recording could not be parsed.'),
  },
  invalid_replay_video: {
    title: t('Invalid replay video'),
    short: t('Replay video was empty or undecodable.'),
  },
  invalid_replay_missing_recording: {
    title: t('Replay missing recording'),
    short: t('Replay event arrived without its recording.'),
  },
  missing_minidump_upload: {
    title: t('Missing minidump upload'),
    short: t('Minidump upload had no minidump file.'),
  },
  invalid_minidump: {
    title: t('Invalid minidump'),
    short: t('Minidump lacked a valid file header.'),
  },
  invalid_unreal_report: {
    title: t('Invalid Unreal report'),
    short: t('Unreal report unreadable; not recorded.'),
  },
  process_unreal: {
    title: t('Unreal processing failed'),
    short: t("Unreal crash report couldn't be read."),
  },
  missing_prosperodump_upload: {
    title: t('Missing PlayStation dump'),
    short: t('PlayStation upload had no .prosperodmp.'),
  },
  invalid_prosperodump: {
    title: t('Invalid PlayStation dump'),
    short: t('PlayStation dump had an invalid header.'),
  },
  security_report: {
    title: t('Invalid security report'),
    short: t("CSP report didn't match expected format."),
  },
  security_report_type: {
    title: t('Unrecognized security report type'),
    short: t("Security report type wasn't recognized."),
  },
  project_state: {
    title: t('Project config unreadable'),
    short: t("Project config couldn't be read."),
  },
  project_state_pii: {
    title: t('Data scrubbing config error'),
    short: t('Data scrubbing config failed to convert.'),
  },
  project_unavailable: {
    title: t('Project unavailable'),
    short: t("Project config couldn't load in time."),
  },
  queue_failed: {
    title: t('Queue failed'),
    short: t('Sentry queue full; shown as internal.'),
  },
  upload_failed: {
    title: t('Upload failed'),
    short: t("Sentry couldn't store an attachment."),
  },
  internal_envelope: {
    title: t('Internal envelope'),
    short: t('Envelope had internal-only items.'),
  },
  invalid_signature: {
    title: t('Invalid signature'),
    short: t('Relay signature unknown or expired.'),
  },
  missing_signature: {
    title: t('Missing signature'),
    short: t('Unsigned data bypassed trusted Relays.'),
  },
  'too_large:event': {
    title: t('Event payload too large'),
    short: dataType => t('The %s event exceeded maximum payload size.', dataType),
  },
  'too_large:log': {
    title: t('Log payload too large'),
    short: t('The log event exceeded maximum payload size.'),
  },
  'too_large:profile': {
    title: t('Profile payload too large'),
    short: t('The profile event exceeded maximum payload size.'),
  },
  'too_large:span': {
    title: t('Span payload too large'),
    short: t('The span event exceeded maximum payload size.'),
  },
  'too_large:trace_metric': {
    title: t('Application metric payload too large'),
    short: t('The application metric event exceeded maximum payload size.'),
  },
  'too_large:transaction': {
    title: t('Transaction payload too large'),
    short: t('The transaction exceeded maximum payload size.'),
  },
  'too_large:profile_chunk': {
    title: t('Profile chunk too large'),
    short: t('Profile chunk over size or count limit.'),
  },
  'too_large:replay_event': {
    title: t('Replay event too large'),
    short: t('Replay metadata event over size limit.'),
  },
  'too_large:replay_recording': {
    title: t('Replay recording too large'),
    short: t('Replay recording over size limit.'),
  },
  'too_large:replay_video': {
    title: t('Replay video too large'),
    short: t('Mobile replay video over size limit.'),
  },
  'too_large:check_in': {
    title: t('Check-in too large'),
    short: t('Cron check-in over size or count limit.'),
  },
  'too_large:session': {
    title: t('Session update too large'),
    short: t('Too many or too large session updates.'),
  },
  'too_large:sessions': {
    title: t('Session aggregates too large'),
    short: t('Too many or too large session aggregates.'),
  },
  'too_large:user_report': {
    title: t('Legacy user feedback too large'),
    short: t('User report hit shared attachment limits.'),
  },
  'too_large:user_report_v2': {
    title: t('User feedback too large'),
    short: t('User feedback over event size limit.'),
  },
  'too_large:security': {
    title: t('Security event too large'),
    short: t('Forwarded CSP event over size limit.'),
  },
  'too_large:raw_security': {
    title: t('Security report too large'),
    short: t('Browser security report over size limit.'),
  },
  'too_large:unreal_report': {
    title: t('Unreal crash report too large'),
    short: t('Unreal crash report over size limit.'),
  },
  'too_large:form_data': {
    title: t('Form data too large'),
    short: t('Crash upload form fields over size limit.'),
  },
  'too_large:client_report': {
    title: t('Client report too large'),
    short: t("SDK's client report exceeded its limits."),
  },
  'too_large:statsd': {
    title: t('Legacy custom metrics too large'),
    short: t('Legacy statsd metrics over size limit.'),
  },
  'too_large:metric_buckets': {
    title: t('Metric buckets too large'),
    short: t('Relay metric buckets over size limit.'),
  },
  'too_large:integration': {
    title: t('Integration payload too large'),
    short: t('OTLP, Vercel, or NEL payload too large.'),
  },
  'too_large:unknown': {
    title: t('Unknown item too large'),
    short: t('Unrecognized item type over size limit.'),
  },
  'too_large:attachment:attachment': {
    title: t('Attachment too large'),
    short: t('Attachment over size or count limit.'),
  },
  'too_large:attachment:minidump': {
    title: t('Minidump too large'),
    short: t('Minidump over attachment size limit.'),
  },
  'too_large:attachment:apple_crash_report': {
    title: t('Apple crash report too large'),
    short: t('Apple crash report hit attachment limits.'),
  },
  'too_large:attachment:event_payload': {
    title: t('Crash event payload too large'),
    short: t('Native crash event data over size limit.'),
  },
  'too_large:attachment:breadcrumbs': {
    title: t('Crash breadcrumbs too large'),
    short: t('Native crash breadcrumbs over size limit.'),
  },
  'too_large:attachment:prosperodump': {
    title: t('PlayStation crash dump too large'),
    short: t('PlayStation crash dump over size limit.'),
  },
  'too_large:attachment:unreal_context': {
    title: t('Unreal context too large'),
    short: t('Unreal context over attachment limits.'),
  },
  'too_large:attachment:unreal_logs': {
    title: t('Unreal crash logs too large'),
    short: t('Unreal crash logs over attachment limits.'),
  },
  'too_large:attachment:view_hierarchy': {
    title: t('View hierarchy too large'),
    short: t('View hierarchy over attachment limits.'),
  },
  'too_large:attachment:nnswitch_dying_message': {
    title: t('Switch dying message too large'),
    short: t('Switch dying message hit attachment limit.'),
  },
  generic: {
    title: t('Generic rate limit'),
    short: t('Your requests across all event types were rate limited.'),
  },
  project_abuse_limit: {
    title: t('Project abuse limit'),
    short: dataType => t('Your %s events exceeded the project abuse limit.', dataType),
  },
  smart_rate_limit: {
    title: t('Spike protection'),
    short: t('Spike protection dropped events to preserve your quota.'),
  },
  usage_exceeded: {
    title: t('Quota exceeded'),
    short: dataType =>
      t('Your organization hit its quota for the %s event type.', dataType),
  },
  rate_limited: {
    title: t('Internal rate limit'),
    short: t('Over an internal Sentry rate limit.'),
  },
  key_quota: {
    title: t('DSN rate limit'),
    short: t('Exceeded the DSN rate limit.'),
  },
};
