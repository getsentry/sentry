import {t} from 'sentry/locale';

interface ReasonInfo {
  docsAnchor: string;
  title: string;
}

const DROPPED_DATA_DOCS_URL = 'https://docs.sentry.io/product/explore/dropped-data/';

// One entry per drop reason, keyed by the reason code Relay/Sentry emits.
// `title` is the row heading. `docsAnchor` is the reason's section id on
// DROPPED_DATA_DOCS_URL; it's kept separate from `title` because titles are
// translated and the docs are English-only.
// Content mirrors the "Dropped Events Descriptions" registry.
const REASON_INFO: Record<string, ReasonInfo> = {
  before_send: {title: t('Dropped by before send'), docsAnchor: 'dropped-by-before-send'},
  ignore_spans: {
    title: t('Dropped by ignored spans'),
    docsAnchor: 'dropped-by-ignored-spans',
  },
  sample_rate: {title: t('Dropped by sample rate'), docsAnchor: 'dropped-by-sample-rate'},
  no_parent_span: {title: t('Missing parent span'), docsAnchor: 'missing-parent-span'},
  event_processor: {title: t('Event processor'), docsAnchor: 'event-processor'},
  backpressure: {title: t('SDK backpressure drop'), docsAnchor: 'sdk-backpressure-drop'},
  queue_overflow: {title: t('SDK queue overflow'), docsAnchor: 'sdk-queue-overflow'},
  buffer_overflow: {title: t('SDK buffer overflow'), docsAnchor: 'sdk-buffer-overflow'},
  network_error: {
    title: t('Unretried network error'),
    docsAnchor: 'unretried-network-error',
  },
  send_error: {title: t('SDK send failure'), docsAnchor: 'sdk-send-failure'},
  cache_overflow: {title: t('Cache overflow'), docsAnchor: 'cache-overflow'},
  internal_sdk_error: {title: t('Internal SDK error'), docsAnchor: 'internal-sdk-error'},
  insufficient_data: {title: t('Insufficient data'), docsAnchor: 'insufficient-data'},
  invalid: {title: t('Failed SDK validation'), docsAnchor: 'failed-sdk-validation'},
  callback_error: {title: t('Callback error'), docsAnchor: 'callback-error'},
  ratelimit_backoff: {
    title: t('SDK rate-limit backoff'),
    docsAnchor: 'sdk-rate-limit-backoff',
  },
  'filtered-transaction': {
    title: t('Filtered transaction'),
    docsAnchor: 'filtered-transaction',
  },
  'error-message': {title: t('Error message filter'), docsAnchor: 'error-message-filter'},
  'release-version': {
    title: t('Release version filter'),
    docsAnchor: 'release-version-filter',
  },
  'ip-address': {title: t('IP address filter'), docsAnchor: 'ip-address-filter'},
  'legacy-browsers': {
    title: t('Legacy browser filter'),
    docsAnchor: 'legacy-browser-filter',
  },
  'web-crawlers': {title: t('Web crawler filter'), docsAnchor: 'web-crawler-filter'},
  localhost: {title: t('Localhost filter'), docsAnchor: 'localhost-filter'},
  'browser-extensions': {
    title: t('Browser extensions filter'),
    docsAnchor: 'browser-extensions-filter',
  },
  'invalid-csp': {title: t('Invalid CSP report'), docsAnchor: 'invalid-csp-report'},
  'denied-name': {title: t('Denied metric name'), docsAnchor: 'denied-metric-name'},
  'disabled-namespace': {
    title: t('Unsupported metric namespace'),
    docsAnchor: 'unsupported-metric-namespace',
  },
  discarded: {title: t('Discarded transaction'), docsAnchor: 'discarded-transaction'},
  'react-hydration-errors': {
    title: t('React hydration errors filter'),
    docsAnchor: 'react-hydration-errors-filter',
  },
  'chunk-load-error': {
    title: t('ChunkLoadError filter'),
    docsAnchor: 'chunkloaderror-filter',
  },
  'custom-error': {
    title: t('Sentry-managed error filter'),
    docsAnchor: 'sentry-managed-error-filter',
  },
  'log-message': {title: t('Log message filter'), docsAnchor: 'log-message-filter'},
  'trace-metric-name': {
    title: t('Application metric name filter'),
    docsAnchor: 'application-metric-name-filter',
  },
  'custom-inbound-filter': {
    title: t('Custom inbound filter'),
    docsAnchor: 'custom-inbound-filter',
  },
  internal: {title: t('Sentry processing error'), docsAnchor: 'sentry-processing-error'},
  invalid_dsc: {title: t('Invalid trace context'), docsAnchor: 'invalid-trace-context'},
  invalid_json: {
    title: t('Malformed JSON payload'),
    docsAnchor: 'malformed-json-payload',
  },
  invalid_transaction: {
    title: t('Invalid transaction data'),
    docsAnchor: 'invalid-transaction-data',
  },
  missing_dsc: {title: t('Missing trace context'), docsAnchor: 'missing-trace-context'},
  timestamp: {title: t('Invalid timestamp'), docsAnchor: 'invalid-timestamp'},
  cors: {title: t('Disallowed origin'), docsAnchor: 'disallowed-origin'},
  project_id: {
    title: t('Invalid or disabled project'),
    docsAnchor: 'invalid-or-disabled-project',
  },
  invalid_event_id: {title: t('Invalid event ID'), docsAnchor: 'invalid-event-id'},
  auth_version: {
    title: t('Unsupported protocol version'),
    docsAnchor: 'unsupported-protocol-version',
  },
  content_type: {
    title: t('Unsupported content type'),
    docsAnchor: 'unsupported-content-type',
  },
  request_too_large: {title: t('Request too large'), docsAnchor: 'request-too-large'},
  feature_disabled: {title: t('Feature disabled'), docsAnchor: 'feature-disabled'},
  duplicate: {title: t('Duplicate ID'), docsAnchor: 'duplicate-id'},
  duplicate_item: {
    title: t('Duplicate envelope item'),
    docsAnchor: 'duplicate-envelope-item',
  },
  transaction_attachment: {
    title: t('Transaction attachment'),
    docsAnchor: 'transaction-attachment',
  },
  transaction_sampled: {
    title: t('Dynamic sampling (legacy)'),
    docsAnchor: 'dynamic-sampling-legacy',
  },
  // Relay emits `Sampled:<rule_ids>`; normalizeReason strips the suffix.
  Sampled: {title: t('Dynamic sampling'), docsAnchor: 'dynamic-sampling'},
  payload: {
    title: t('Unprocessable crash payload'),
    docsAnchor: 'unprocessable-crash-payload',
  },
  empty_body: {title: t('Empty request body'), docsAnchor: 'empty-request-body'},
  invalid_body: {
    title: t('Unreadable request body'),
    docsAnchor: 'unreadable-request-body',
  },
  invalid_compression: {
    title: t('Invalid compression'),
    docsAnchor: 'invalid-compression',
  },
  invalid_envelope: {
    title: t('Unsupported envelope item'),
    docsAnchor: 'unsupported-envelope-item',
  },
  invalid_msgpack: {title: t('Invalid MessagePack'), docsAnchor: 'invalid-messagepack'},
  invalid_proto: {title: t('Invalid OTLP protobuf'), docsAnchor: 'invalid-otlp-protobuf'},
  invalid_multipart: {
    title: t('Invalid multipart upload'),
    docsAnchor: 'invalid-multipart-upload',
  },
  nesting_too_deep: {title: t('Nesting too deep'), docsAnchor: 'nesting-too-deep'},
  no_data: {title: t('No data'), docsAnchor: 'no-data'},
  no_event_payload: {
    title: t('Missing event payload'),
    docsAnchor: 'missing-event-payload',
  },
  invalid_span: {title: t('Invalid span'), docsAnchor: 'invalid-span'},
  invalid_log: {title: t('Invalid log'), docsAnchor: 'invalid-log'},
  invalid_trace_metric: {title: t('Invalid metric'), docsAnchor: 'invalid-metric'},
  invalid_check_in: {title: t('Invalid check-in'), docsAnchor: 'invalid-check-in'},
  invalid_span_attachment: {
    title: t('Invalid span attachment'),
    docsAnchor: 'invalid-span-attachment',
  },
  invalid_trace_attachment: {
    title: t('Invalid trace attachment'),
    docsAnchor: 'invalid-trace-attachment',
  },
  invalid_replay: {title: t('Invalid replay'), docsAnchor: 'invalid-replay'},
  invalid_replay_no_payload: {
    title: t('Empty replay event'),
    docsAnchor: 'empty-replay-event',
  },
  invalid_replay_pii_scrubber_failed: {
    title: t('Replay scrubbing failed'),
    docsAnchor: 'replay-scrubbing-failed',
  },
  invalid_replay_recording: {
    title: t('Invalid replay recording'),
    docsAnchor: 'invalid-replay-recording',
  },
  invalid_replay_video: {
    title: t('Invalid replay video'),
    docsAnchor: 'invalid-replay-video',
  },
  invalid_replay_missing_recording: {
    title: t('Replay missing recording'),
    docsAnchor: 'replay-missing-recording',
  },
  missing_minidump_upload: {
    title: t('Missing minidump upload'),
    docsAnchor: 'missing-minidump-upload',
  },
  invalid_minidump: {title: t('Invalid minidump'), docsAnchor: 'invalid-minidump'},
  invalid_unreal_report: {
    title: t('Invalid Unreal report'),
    docsAnchor: 'invalid-unreal-report',
  },
  process_unreal: {
    title: t('Unreal processing failed'),
    docsAnchor: 'unreal-processing-failed',
  },
  missing_prosperodump_upload: {
    title: t('Missing PlayStation dump'),
    docsAnchor: 'missing-playstation-dump',
  },
  invalid_prosperodump: {
    title: t('Invalid PlayStation dump'),
    docsAnchor: 'invalid-playstation-dump',
  },
  security_report: {
    title: t('Invalid security report'),
    docsAnchor: 'invalid-security-report',
  },
  security_report_type: {
    title: t('Unrecognized security report type'),
    docsAnchor: 'unrecognized-security-report-type',
  },
  project_state: {
    title: t('Project config unreadable'),
    docsAnchor: 'project-config-unreadable',
  },
  project_state_pii: {
    title: t('Data scrubbing config error'),
    docsAnchor: 'data-scrubbing-config-error',
  },
  project_unavailable: {
    title: t('Project unavailable'),
    docsAnchor: 'project-unavailable',
  },
  queue_failed: {title: t('Queue failed'), docsAnchor: 'queue-failed'},
  upload_failed: {title: t('Upload failed'), docsAnchor: 'upload-failed'},
  internal_envelope: {title: t('Internal envelope'), docsAnchor: 'internal-envelope'},
  invalid_signature: {title: t('Invalid signature'), docsAnchor: 'invalid-signature'},
  missing_signature: {title: t('Missing signature'), docsAnchor: 'missing-signature'},
  'too_large:event': {
    title: t('Event payload too large'),
    docsAnchor: 'event-payload-too-large',
  },
  'too_large:log': {
    title: t('Log payload too large'),
    docsAnchor: 'log-payload-too-large',
  },
  'too_large:profile': {
    title: t('Profile payload too large'),
    docsAnchor: 'profile-payload-too-large',
  },
  'too_large:span': {
    title: t('Span payload too large'),
    docsAnchor: 'span-payload-too-large',
  },
  'too_large:trace_metric': {
    title: t('Application metric payload too large'),
    docsAnchor: 'application-metric-payload-too-large',
  },
  'too_large:transaction': {
    title: t('Transaction payload too large'),
    docsAnchor: 'transaction-payload-too-large',
  },
  'too_large:profile_chunk': {
    title: t('Profile chunk too large'),
    docsAnchor: 'profile-chunk-too-large',
  },
  'too_large:replay_event': {
    title: t('Replay event too large'),
    docsAnchor: 'replay-event-too-large',
  },
  'too_large:replay_recording': {
    title: t('Replay recording too large'),
    docsAnchor: 'replay-recording-too-large',
  },
  'too_large:replay_video': {
    title: t('Replay video too large'),
    docsAnchor: 'replay-video-too-large',
  },
  'too_large:check_in': {
    title: t('Check-in too large'),
    docsAnchor: 'check-in-too-large',
  },
  'too_large:session': {
    title: t('Session update too large'),
    docsAnchor: 'session-update-too-large',
  },
  'too_large:sessions': {
    title: t('Session aggregates too large'),
    docsAnchor: 'session-aggregates-too-large',
  },
  'too_large:user_report': {
    title: t('Legacy user feedback too large'),
    docsAnchor: 'legacy-user-feedback-too-large',
  },
  'too_large:user_report_v2': {
    title: t('User feedback too large'),
    docsAnchor: 'user-feedback-too-large',
  },
  'too_large:security': {
    title: t('Security event too large'),
    docsAnchor: 'security-event-too-large',
  },
  'too_large:raw_security': {
    title: t('Security report too large'),
    docsAnchor: 'security-report-too-large',
  },
  'too_large:unreal_report': {
    title: t('Unreal crash report too large'),
    docsAnchor: 'unreal-crash-report-too-large',
  },
  'too_large:form_data': {
    title: t('Form data too large'),
    docsAnchor: 'form-data-too-large',
  },
  'too_large:client_report': {
    title: t('Client report too large'),
    docsAnchor: 'client-report-too-large',
  },
  'too_large:statsd': {
    title: t('Legacy custom metrics too large'),
    docsAnchor: 'legacy-custom-metrics-too-large',
  },
  'too_large:metric_buckets': {
    title: t('Metric buckets too large'),
    docsAnchor: 'metric-buckets-too-large',
  },
  'too_large:integration': {
    title: t('Integration payload too large'),
    docsAnchor: 'integration-payload-too-large',
  },
  'too_large:unknown': {
    title: t('Unknown item too large'),
    docsAnchor: 'unknown-item-too-large',
  },
  'too_large:attachment:attachment': {
    title: t('Attachment too large'),
    docsAnchor: 'attachment-too-large',
  },
  'too_large:attachment:minidump': {
    title: t('Minidump too large'),
    docsAnchor: 'minidump-too-large',
  },
  'too_large:attachment:apple_crash_report': {
    title: t('Apple crash report too large'),
    docsAnchor: 'apple-crash-report-too-large',
  },
  'too_large:attachment:event_payload': {
    title: t('Crash event payload too large'),
    docsAnchor: 'crash-event-payload-too-large',
  },
  'too_large:attachment:breadcrumbs': {
    title: t('Crash breadcrumbs too large'),
    docsAnchor: 'crash-breadcrumbs-too-large',
  },
  'too_large:attachment:prosperodump': {
    title: t('PlayStation crash dump too large'),
    docsAnchor: 'playstation-crash-dump-too-large',
  },
  'too_large:attachment:unreal_context': {
    title: t('Unreal context too large'),
    docsAnchor: 'unreal-context-too-large',
  },
  'too_large:attachment:unreal_logs': {
    title: t('Unreal crash logs too large'),
    docsAnchor: 'unreal-crash-logs-too-large',
  },
  'too_large:attachment:view_hierarchy': {
    title: t('View hierarchy too large'),
    docsAnchor: 'view-hierarchy-too-large',
  },
  'too_large:attachment:nnswitch_dying_message': {
    title: t('Switch dying message too large'),
    docsAnchor: 'switch-dying-message-too-large',
  },
  generic: {title: t('Generic rate limit'), docsAnchor: 'generic-rate-limit'},
  project_abuse_limit: {
    title: t('Project abuse limit'),
    docsAnchor: 'project-abuse-limit',
  },
  smart_rate_limit: {title: t('Spike protection'), docsAnchor: 'spike-protection'},
  usage_exceeded: {title: t('Quota exceeded'), docsAnchor: 'quota-exceeded'},
  rate_limited: {title: t('Internal rate limit'), docsAnchor: 'internal-rate-limit'},
  key_quota: {title: t('DSN rate limit'), docsAnchor: 'dsn-rate-limit'},
};

function normalizeReason(reason: string): string {
  if (reason === 'ignored') {
    return 'ignore_spans';
  }
  if (REASON_INFO[reason]) {
    return reason;
  }
  // Reasons like `Sampled:0` or `custom-inbound-filter:foo` carry a dynamic
  // suffix; the registry keys on the bare prefix. Exact keys (`too_large:span`)
  // are matched above, so this only strips genuinely dynamic suffixes.
  const colonIndex = reason.indexOf(':');
  if (colonIndex !== -1) {
    const prefix = reason.slice(0, colonIndex);
    if (REASON_INFO[prefix]) {
      return prefix;
    }
  }
  return reason.endsWith('_usage_exceeded') ? 'usage_exceeded' : reason;
}

export function reasonTitle(reason: string): string {
  return REASON_INFO[normalizeReason(reason)]?.title ?? reason;
}

export function reasonDocsUrl(reason: string): string {
  const anchor = REASON_INFO[normalizeReason(reason)]?.docsAnchor;
  return anchor ? `${DROPPED_DATA_DOCS_URL}#${anchor}` : DROPPED_DATA_DOCS_URL;
}
