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

type ReasonShort = string | ((dataType: string | undefined) => string);

interface ReasonInfo {
  title: string;
  long?: string;
  short?: ReasonShort;
}

// One entry per drop reason, keyed by the reason code Relay/Sentry emits.
// `title` is the row heading, `short` the muted sub-line, `long` the expansion
// paragraph. Content mirrors the "Dropped Events Descriptions" registry.
const REASON_INFO: Record<string, ReasonInfo> = {
  before_send: {
    title: t('Dropped by before send'),
    short: t('Event dropped by your before send function.'),
    long: t(
      'Your before send function or your ignore spans configuration omitted the event. If you think this is unintentional, double check your Sentry configuration.'
    ),
  },
  ignore_spans: {
    title: t('Dropped by ignored spans'),
    short: t('Span dropped by your ignored spans configuration.'),
    long: t(
      'Spans matching the ignored spans in your SDK configuration were omitted before being sent to Sentry.'
    ),
  },
  sample_rate: {
    title: t('Dropped by sample rate'),
    short: t('Event dropped by your configured sample rate.'),
    long: t('Events dropped normally due to your configured client sample rate.'),
  },
  no_parent_span: {
    title: t('Missing parent span'),
    short: t('Span skipped because no parent span was active.'),
    long: t(
      'The SDK only records some spans, such as outgoing requests, when a parent span is active. Without one, the span is never created, so no data was lost.'
    ),
  },
  event_processor: {
    title: t('Event processor'),
    short: t('Dropped by an SDK event processor.'),
    long: t(
      'Your SDK dropped data in an event processor, a step that can change or discard data before it is sent. This includes filters you configure, your own custom event processors, and built-in ones like the Dedupe integration.'
    ),
  },
  backpressure: {
    title: t('SDK backpressure drop'),
    short: t('SDK reduced trace sampling under load.'),
    long: t(
      'Your SDK detected that it was under load and automatically reduced trace sampling to keep telemetry processing from putting additional pressure on your application. The discarded spans never left your application.'
    ),
  },
  queue_overflow: {
    title: t('SDK queue overflow'),
    short: t("SDK's send queue was full."),
    long: t(
      'Your application is generating events faster than the SDK can buffer and send them. The SDK allows a limited number of operations in flight at once; beyond that, new events are dropped immediately rather than queued.'
    ),
  },
  buffer_overflow: {
    title: t('SDK buffer overflow'),
    short: t('SDK buffer filled before data could be sent.'),
    long: t(
      'A fixed-size in-memory buffer in the SDK reached its limit and dropped data. This is most often caused by a session replay exceeding its size cap.'
    ),
  },
  network_error: {
    title: t('Unretried network error'),
    short: t('Request failed before reaching Sentry.'),
    long: t(
      'The request failed outright without receiving a response, often caused by ad blockers and browser extensions.'
    ),
  },
  send_error: {
    title: t('SDK send failure'),
    short: t('Sentry rejected the event with an error response.'),
    long: t('The event reached Sentry but was rejected with an error code.'),
  },
  cache_overflow: {
    title: t('Cache overflow'),
    short: t("SDK's offline cache was full."),
    long: t(
      'Your SDK deleted data it had cached offline, usually the oldest items once the cache reached its limit. The offline cache holds data the SDK could not send yet, so long offline periods can fill it.'
    ),
  },
  internal_sdk_error: {
    title: t('Internal SDK error'),
    short: t('SDK hit an internal error.'),
    long: t(
      'Your SDK dropped data because of an error inside the SDK itself, such as a Session Replay buffer or web worker failure, or a failure building the request to Sentry.'
    ),
  },
  insufficient_data: {
    title: t('Insufficient data'),
    short: t('Not enough data to send.'),
    long: t(
      "Your SDK dropped data that didn't have enough content to send, such as a profile with too few samples. This is often expected for very short operations."
    ),
  },
  invalid: {
    title: t('Failed SDK validation'),
    short: t("Data failed the SDK's validation checks."),
    long: t(
      "Your SDK dropped data that failed its own checks before sending, such as a replay that ran too long, a child span left open when its parent ended, or a malformed log or metric. The SDK made this decision, not Sentry's servers."
    ),
  },
  callback_error: {
    title: t('Callback error'),
    short: t('An SDK callback threw an error.'),
    long: t(
      'Your SDK dropped data because one of your callbacks, such as beforeSend, tracesSampler or a custom event processor, threw an error while handling it.'
    ),
  },
  ratelimit_backoff: {
    title: t('SDK rate-limit backoff'),
    short: t('SDK backed off due to a rate limit.'),
    long: t(
      'Your SDK discarded data locally while backing off, usually because Sentry had earlier told it to pause sending that data type. The real cause is whatever triggered that original limit.'
    ),
  },
  'filtered-transaction': {
    title: t('Filtered transaction'),
    short: t('Transaction matched the default health check filter.'),
    long: t(
      "The transaction name matched Sentry's health check filter, which drops transactions for endpoints like /health, /healthz, /ping, and /ready. This filter is enabled by default."
    ),
  },
  'error-message': {
    title: t('Error message filter'),
    short: t('Event message matched one of your custom filters.'),
    long: t(
      'The event matched a custom glob provided in your error message filter settings.'
    ),
  },
  'release-version': {
    title: t('Release version filter'),
    short: t('Event release matched one of your custom filters.'),
    long: t('The event matched a custom release filter rule provided in your settings.'),
  },
  'ip-address': {
    title: t('IP address filter'),
    short: t('Event IP address matched one of your custom filters.'),
    long: t(
      'The event matched a range of IP addresses provided in a custom filter rule.'
    ),
  },
  'legacy-browsers': {
    title: t('Legacy browser filter'),
    short: t('Browser matched your legacy browser filter.'),
    long: t(
      'The event was filtered because the reporting browser matched the legacy browsers inbound filter. This rule filters out events from older web browsers that are likely to provide broken telemetry.'
    ),
  },
  'web-crawlers': {
    title: t('Web crawler filter'),
    short: t("User agent matched Sentry's known crawler list."),
    long: t(
      "Data was filtered because the reporting user agent matched Sentry's list of known web crawlers."
    ),
  },
  localhost: {
    title: t('Localhost filter'),
    short: t('Event was sent from a local address.'),
    long: t(
      "The event was filtered because it came from a local address such as localhost or 127.0.0.1. This rule is enabled in your project's inbound filter settings."
    ),
  },
  'browser-extensions': {
    title: t('Browser extensions filter'),
    short: t('Error came from a browser extension.'),
    long: t(
      "Data was filtered because the error matched Sentry's list of errors known to be caused by browser extensions. This filter is turned on automatically for new projects with a JavaScript platform."
    ),
  },
  'invalid-csp': {
    title: t('Invalid CSP report'),
    short: t('CSP report ignored or unsupported.'),
    long: t(
      'A Content Security Policy (CSP) report was filtered because its blocked, source or document URI matched the project\'s ignored sources. Sentry also uses this reason for browser reports whose type is not "csp-violation", which it does not support.'
    ),
  },
  'denied-name': {
    title: t('Denied metric name'),
    short: t('Legacy: metric name was on a block list.'),
    long: t(
      "Legacy: metrics were dropped because their name was on the project's block list in Sentry's retired custom metrics product. This reason is no longer emitted and only appears in historical data."
    ),
  },
  'disabled-namespace': {
    title: t('Unsupported metric namespace'),
    short: t('Metrics sent to an unsupported namespace.'),
    long: t(
      "Sentry dropped metrics sent to a namespace it does not support; it only accepts its own namespaces, such as sessions, spans and transactions, and no longer accepts custom metrics. This is an intentional drop on Sentry's side and almost never shows up in Stats."
    ),
  },
  discarded: {
    title: t('Discarded transaction'),
    short: t('Transaction kept as spans instead.'),
    long: t(
      "Sentry discarded the transaction event after extracting its spans, so the transaction's data is kept as spans instead. A Sentry-side setting controls this, not your project, and attachments sent with the transaction are dropped and reported under this reason too."
    ),
  },
  'react-hydration-errors': {
    title: t('React hydration errors filter'),
    short: t('Error was a React hydration error.'),
    long: t(
      "Data was filtered because the error is a React hydration error, which the hydration errors inbound filter removes by default. The filter matches messages containing React's error-decoder links for hydration error codes 418, 419, 421, 422, 423 and 425."
    ),
  },
  'chunk-load-error': {
    title: t('ChunkLoadError filter'),
    short: t('Error was a ChunkLoadError.'),
    long: t(
      'Data was filtered because the error is a ChunkLoadError, raised when the browser fails to load a JavaScript chunk. The ChunkLoadError filter is on by default.'
    ),
  },
  'custom-error': {
    title: t('Sentry-managed error filter'),
    short: t('Error matched a known malicious payload.'),
    long: t(
      'Data was filtered because the error matched a Sentry-managed filter for known malicious payloads, such as fake "npx" setup commands. These are not real application errors, and there is no project setting for this filter.'
    ),
  },
  'log-message': {
    title: t('Log message filter'),
    short: t('Log message matched an inbound filter.'),
    long: t(
      "Data was filtered because the log's message matched a pattern in the project's Log Message inbound filter."
    ),
  },
  'trace-metric-name': {
    title: t('Application metric name filter'),
    short: t('Metric name matched an inbound filter.'),
    long: t(
      "Data was filtered because the metric's name matched a pattern in the project's Application Metrics inbound filter."
    ),
  },
  'custom-inbound-filter': {
    title: t('Custom inbound filter'),
    short: t('Matched a custom inbound filter.'),
    long: t(
      "Data was filtered because it matched one of the project's custom inbound filters. The number after the colon is the filter's ID, and Stats groups all custom filters together."
    ),
  },
  internal: {
    title: t('Sentry processing error'),
    short: t('Sentry failed to process the event.'),
    long: t(
      "This indicates a bug or an infrastructure problem on Sentry's ingestion side. During healthy operation this should be zero."
    ),
  },
  invalid_dsc: {
    title: t('Invalid trace context'),
    short: t('Trace header did not match the spans sent.'),
    long: t(
      'The trace ID provided in the trace header did not match the trace ID of the spans sent.'
    ),
  },
  invalid_json: {
    title: t('Malformed JSON payload'),
    short: t('Event rejected due to invalid JSON.'),
    long: t('Sentry could not parse the event that was sent.'),
  },
  invalid_transaction: {
    title: t('Invalid transaction data'),
    short: t('Transaction contained invalid data.'),
    long: t('The transaction was valid JSON but semantically could not be accepted.'),
  },
  missing_dsc: {
    title: t('Missing trace context'),
    short: t('Envelope was missing the required trace header.'),
    long: t('The envelope contained spans but no trace header.'),
  },
  timestamp: {
    title: t('Invalid timestamp'),
    short: t('Event timestamp was too far in the past or future.'),
    long: t(
      "The event's timestamp was outside the range Sentry accepts, either older than the retention window or too far in the future. This is usually caused by an incorrect clock on the device that sent it."
    ),
  },
  cors: {
    title: t('Disallowed origin'),
    short: t("Origin not in project's Allowed Domains."),
    long: t(
      "Data was rejected because the request's Origin header, or its Referer header when there is no Origin, did not match any entry in your project's Allowed Domains. Requests that send neither header always pass."
    ),
  },
  project_id: {
    title: t('Invalid or disabled project'),
    short: t('DSN mismatch or disabled project or key.'),
    long: t(
      "Data was rejected because the project ID in your DSN did not match its key, or because the project is disabled or the client key is disabled or deleted. Drops caused by a disabled project or key likely won't appear in your organization's stats; only the ID mismatch case does."
    ),
  },
  invalid_event_id: {
    title: t('Invalid event ID'),
    short: t('Event ID was malformed or missing.'),
    long: t(
      "Your SDK or upload code sent an item with a malformed or missing event ID, so Sentry couldn't accept it. This happens with attachments, user reports and replays sent without an event ID, or with an upload whose sentry[event_id] form field can't be parsed."
    ),
  },
  auth_version: {
    title: t('Unsupported protocol version'),
    short: t('Legacy: unsupported protocol version.'),
    long: t(
      'Legacy: Sentry no longer emits this reason, so it only appears in historical data. It was recorded when an SDK sent an unsupported Sentry protocol version in its auth header; today those requests are rejected with an HTTP 400 and no dropped-event record.'
    ),
  },
  content_type: {
    title: t('Unsupported content type'),
    short: t('Legacy: unsupported content type.'),
    long: t(
      "Legacy: Sentry no longer emits this reason, so it only appears in historical data. It was recorded when a request's Content-Type was not allowed for the endpoint it was sent to."
    ),
  },
  request_too_large: {
    title: t('Request too large'),
    short: t('Request exceeded a size or parsing limit.'),
    long: t(
      "Sentry rejected a whole request that was over the endpoint's size limit, or a batch of logs, spans or metrics that needed more parsing work than Sentry allows. This is separate from the too_large:<item_type> reasons, which drop individual items rather than the whole request."
    ),
  },
  feature_disabled: {
    title: t('Feature disabled'),
    short: t('Feature not enabled for org or project.'),
    long: t(
      "Sentry dropped data that relies on a feature that isn't enabled for your organization or project, such as PlayStation ingestion, resumable minidump uploads or logs sent over OTLP. These features are controlled by Sentry, so you can't turn them on yourself."
    ),
  },
  duplicate: {
    title: t('Duplicate ID'),
    short: t('Span ID repeated in the same envelope.'),
    long: t(
      'A span was dropped because another span in the same envelope (the bundle of data an SDK sends in one request) had the same span ID. Sentry keeps the later span and drops the earlier one.'
    ),
  },
  duplicate_item: {
    title: t('Duplicate envelope item'),
    short: t('Envelope had duplicate or mixed items.'),
    long: t(
      'An envelope (the bundle of data an SDK sends in one request) held more than one event or check-in, repeated or mixed log or span batches, repeated metric batches, or an invalid mix of replay items. Only the extra events and check-ins are dropped, but for logs, spans, metrics and replays every item of that type in the envelope is dropped.'
    ),
  },
  transaction_attachment: {
    title: t('Transaction attachment'),
    short: t('Legacy: attachment sent with transaction.'),
    long: t(
      'Legacy: Sentry no longer emits this reason, so it only appears in historical data. It was recorded when an attachment sent alongside a transaction was dropped while an internal Sentry option disallowed it; that option has since been removed.'
    ),
  },
  transaction_sampled: {
    title: t('Dynamic sampling'),
    short: t('Legacy: dropped by dynamic sampling.'),
    long: t(
      'Legacy: Sentry no longer emits this reason, so it only appears in historical data. It was recorded when dynamic sampling dropped a transaction under the rules in effect at the time; current sampling drops are recorded as filtered, with a Sampled: reason, instead.'
    ),
  },
  payload: {
    title: t('Unprocessable crash payload'),
    short: t('Console crash data could not be processed.'),
    long: t(
      'Sentry could not process a Nintendo Switch crash or a PlayStation crash dump that your app sent, for example because the file was corrupt, cut off, or badly compressed.'
    ),
  },
  empty_body: {
    title: t('Empty request body'),
    short: t('Request body was empty.'),
    long: t(
      'Legacy: Sentry received a request with an empty body, so there was nothing to ingest. This reason is not emitted today, because Sentry rejects empty requests with an HTTP 400 error before recording them, so you should not expect to see it in Stats.'
    ),
  },
  invalid_body: {
    title: t('Unreadable request body'),
    short: t('Minidump upload body could not be read.'),
    long: t(
      'Sentry could not read the body of a minidump uploaded directly rather than as multipart form data, for example because the stream was cut off. Each failed upload is counted as a single error as a best-effort estimate.'
    ),
  },
  invalid_compression: {
    title: t('Invalid compression'),
    short: t('Crash file could not be decompressed.'),
    long: t(
      'Sentry could not decompress a minidump or an Unreal crash report your app sent. For minidumps, Sentry detects the format (gzip, zstd, bzip2, or xz) from the file header, and large minidumps that fail to decompress are reported as invalid_minidump instead.'
    ),
  },
  invalid_envelope: {
    title: t('Unsupported envelope item'),
    short: t('Envelope item was not allowed or supported.'),
    long: t(
      'Sentry dropped an item that was not allowed or supported in the envelope it arrived in. Envelopes are the container format SDKs use to send events and related data to Sentry.'
    ),
  },
  invalid_msgpack: {
    title: t('Invalid MessagePack'),
    short: t('Crash event or breadcrumbs failed to parse.'),
    long: t(
      'Sentry could not decode the event or breadcrumbs attached to a native crash. These are sent in MessagePack, a compact binary format.'
    ),
  },
  invalid_proto: {
    title: t('Invalid OTLP protobuf'),
    short: t('OTLP protobuf payload could not be decoded.'),
    long: t(
      'Sentry could not decode an OpenTelemetry (OTLP) payload for traces or logs sent in protobuf binary encoding. JSON-encoded OTLP payloads that fail to parse are reported as invalid_json instead.'
    ),
  },
  invalid_multipart: {
    title: t('Invalid multipart upload'),
    short: t('Multipart upload could not be parsed.'),
    long: t(
      'Sentry could not parse a multipart form-data upload, such as a minidump or PlayStation crash report. Each failed upload is counted as a single error as a best-effort estimate.'
    ),
  },
  nesting_too_deep: {
    title: t('Nesting too deep'),
    short: t('Form-data keys nested over 15 levels deep.'),
    long: t(
      'Sentry dropped a crash report because its form-data keys (like sentry[a][b]...) were nested more than 15 levels deep. This applies to Breakpad or Crashpad-style uploads that send event fields as form data.'
    ),
  },
  no_data: {
    title: t('No data'),
    short: t('No valid data was left after validation.'),
    long: t(
      'Sentry dropped a span, log, or trace-connected metric because nothing valid was left after checking it against the expected format. This often happens when a required field is missing, so the whole item is removed.'
    ),
  },
  no_event_payload: {
    title: t('Missing event payload'),
    short: t('Crash or profile was missing its event.'),
    long: t(
      'Sentry received a crash upload but could not build an event from it, or received a profile without the transaction it belongs to. Without that primary data, there was nothing to ingest.'
    ),
  },
  invalid_span: {
    title: t('Invalid span'),
    short: t('Span was missing fields or had a bad ID.'),
    long: t(
      'Sentry dropped a span that was missing required fields or had an invalid span ID or segment ID. This also covers spans taken from transactions that could not be converted.'
    ),
  },
  invalid_log: {
    title: t('Invalid log'),
    short: t('Log was missing a required field.'),
    long: t(
      'Sentry dropped a log that was missing a required field, such as its timestamp or level, after normalization. Normalization is the step where Sentry cleans up incoming data before storing it.'
    ),
  },
  invalid_trace_metric: {
    title: t('Invalid metric'),
    short: t('Metric had no name or a bad type or value.'),
    long: t(
      'Sentry dropped a metric that had an empty name, an unknown or missing type, a non-numeric value, or a missing required field. This applies to trace-connected Metrics, not legacy custom metrics.'
    ),
  },
  invalid_check_in: {
    title: t('Invalid check-in'),
    short: t('Check-in had a bad slug or environment.'),
    long: t(
      'Sentry dropped a cron monitor check-in that had an empty monitor slug or an environment name longer than 64 characters. Slugs longer than 50 characters are shortened automatically, so only an empty slug is rejected.'
    ),
  },
  invalid_span_attachment: {
    title: t('Invalid span attachment'),
    short: t('Span attachment had no matching span.'),
    long: t(
      'Sentry dropped a span attachment that had no span ID, or that pointed to a span not sent in the same envelope. A span attachment has to arrive together with the span it belongs to.'
    ),
  },
  invalid_trace_attachment: {
    title: t('Invalid trace attachment'),
    short: t('Trace attachment metadata was invalid.'),
    long: t(
      'Sentry dropped a trace attachment whose meta_length header was missing or larger than the attachment itself, or that lacked required metadata such as its trace ID or content type.'
    ),
  },
  invalid_replay: {
    title: t('Invalid replay'),
    short: t('Replay event was malformed or missing IDs.'),
    long: t(
      'Sentry dropped a replay event that was not valid JSON, was missing its replay_id or segment_id, or had invalid error or trace IDs. A segment_id that is too large is also rejected.'
    ),
  },
  invalid_replay_no_payload: {
    title: t('Empty replay event'),
    short: t('Replay event contained no data.'),
    long: t(
      'Sentry dropped a replay event that parsed correctly but contained no data, for example a JSON null.'
    ),
  },
  invalid_replay_pii_scrubber_failed: {
    title: t('Replay scrubbing failed'),
    short: t('PII scrubbing of the replay event failed.'),
    long: t(
      "Sentry dropped a replay because applying PII scrubbing rules to the replay event failed. This is not expected to happen in practice, so it points to a problem on Sentry's side rather than with your data."
    ),
  },
  invalid_replay_recording: {
    title: t('Invalid replay recording'),
    short: t('Replay recording could not be parsed.'),
    long: t(
      'Sentry could not parse or decompress a replay recording while scrubbing it for sensitive data, so the recording was dropped. This only happens when Sentry scrubs replay recordings for your project, which requires your project to have PII rules or data scrubbing settings.'
    ),
  },
  invalid_replay_video: {
    title: t('Invalid replay video'),
    short: t('Replay video was empty or undecodable.'),
    long: t(
      'Sentry dropped a native replay video that could not be decoded or was empty. These videos arrive as a single bundle of the replay event, recording, and video, and a broken replay event inside the bundle is reported as invalid_replay instead.'
    ),
  },
  invalid_replay_missing_recording: {
    title: t('Replay missing recording'),
    short: t('Replay event arrived without its recording.'),
    long: t(
      'Sentry dropped a replay event that was sent without its recording in the same envelope. Recordings sent on their own are still accepted, but a replay event must come with its recording.'
    ),
  },
  missing_minidump_upload: {
    title: t('Missing minidump upload'),
    short: t('Minidump upload had no minidump file.'),
    long: t(
      "Sentry rejected a minidump upload because the request didn't include a minidump file. This only happens with multipart form uploads, and any other attachments or breadcrumbs in the same upload are dropped under this reason too."
    ),
  },
  invalid_minidump: {
    title: t('Invalid minidump'),
    short: t('Minidump lacked a valid file header.'),
    long: t(
      "Sentry rejected a minidump because the file didn't start with a valid minidump header. Large minidumps whose compressed file is corrupt are also reported this way; corrupt compression on other minidumps is reported as invalid_compression."
    ),
  },
  invalid_unreal_report: {
    title: t('Invalid Unreal report'),
    short: t('Unreal report unreadable; not recorded.'),
    long: t(
      "Legacy: this reason was defined for unreadable Unreal Engine crash reports, but Sentry never recorded it as a dropped event, so it shouldn't appear in your stats. Unreadable Unreal crash reports are recorded as process_unreal instead."
    ),
  },
  process_unreal: {
    title: t('Unreal processing failed'),
    short: t("Unreal crash report couldn't be read."),
    long: t(
      "Sentry couldn't extract an Unreal Engine crash report from the upload during processing, so the crash was dropped. This is recorded by Sentry's servers or by self-hosted Sentry, never by a Relay you run in front of Sentry."
    ),
  },
  missing_prosperodump_upload: {
    title: t('Missing PlayStation dump'),
    short: t('PlayStation upload had no .prosperodmp.'),
    long: t(
      "Sentry rejected a PlayStation crash upload because it didn't include a .prosperodmp core dump file. Sentry recognizes the dump only by a filename ending in .prosperodmp, and any other files in the upload are dropped with it."
    ),
  },
  invalid_prosperodump: {
    title: t('Invalid PlayStation dump'),
    short: t('PlayStation dump had an invalid header.'),
    long: t(
      "Sentry rejected a PlayStation crash dump because the .prosperodmp file didn't start with an ELF or LZ4 header. This check only looks at the start of the file; a dump that fails later during processing is reported as payload instead."
    ),
  },
  security_report: {
    title: t('Invalid security report'),
    short: t("CSP report didn't match expected format."),
    long: t(
      "Sentry rejected a Content Security Policy (CSP) report because its JSON didn't match the expected report format. Browsers and extensions generate these reports, so you rarely control the payload."
    ),
  },
  security_report_type: {
    title: t('Unrecognized security report type'),
    short: t("Security report type wasn't recognized."),
    long: t(
      "Sentry couldn't tell what kind of security report it received because the JSON had neither a csp-report key nor a type field. This is the shape of legacy Expect-CT, HPKP and Expect-Staple reports, and only CSP reports are accepted."
    ),
  },
  project_state: {
    title: t('Project config unreadable'),
    short: t("Project config couldn't be read."),
    long: t(
      "Legacy: Sentry couldn't read this project's configuration, so it dropped the data. Current Sentry no longer emits this reason; it can only come from very old Relays you run yourself."
    ),
  },
  project_state_pii: {
    title: t('Data scrubbing config error'),
    short: t('Data scrubbing config failed to convert.'),
    long: t(
      "Legacy: Sentry couldn't convert this project's data scrubbing settings into a usable configuration, so it dropped the data. Current Sentry can no longer fail this way; it can only come from old Relays."
    ),
  },
  project_unavailable: {
    title: t('Project unavailable'),
    short: t("Project config couldn't load in time."),
    long: t(
      "Sentry could not load the project's configuration in time, so it rejected a minidump or PlayStation crash upload. This is a Sentry-side infrastructure issue, and your SDK may retry the upload."
    ),
  },
  queue_failed: {
    title: t('Queue failed'),
    short: t('Sentry queue full; shown as internal.'),
    long: t(
      "Legacy: this reason is defined for when Sentry's ingestion queue is full or shutting down, but those failures are always recorded as internal instead. You should not see it in your stats."
    ),
  },
  upload_failed: {
    title: t('Upload failed'),
    short: t("Sentry couldn't store an attachment."),
    long: t(
      'Sentry failed to save an attachment or crash file to its storage, so the data was dropped. If a minidump fails to save, the whole crash upload is rejected; a failed extra attachment is dropped on its own.'
    ),
  },
  internal_envelope: {
    title: t('Internal envelope'),
    short: t('Envelope had internal-only items.'),
    long: t(
      "Legacy: Sentry never records this reason in your stats; it only returns an HTTP 400 error to the client. It applies when an envelope sent to the regular envelope or store endpoint contains internal-only integration items, which only Sentry's own integration endpoints, such as OTLP and Vercel, create."
    ),
  },
  invalid_signature: {
    title: t('Invalid signature'),
    short: t('Relay signature unknown or expired.'),
    long: t(
      'Sentry rejected data signed by a Relay that isn\'t registered with your organization, or whose signature had expired. This check only runs when your organization has "Ingest Through Trusted Relays Only" enabled.'
    ),
  },
  missing_signature: {
    title: t('Missing signature'),
    short: t('Unsigned data bypassed trusted Relays.'),
    long: t(
      'Your organization only accepts data through trusted Relays, so data sent directly without a Relay signature was rejected. This is the "Ingest Through Trusted Relays Only" setting working as intended.'
    ),
  },
  'too_large:event': {
    title: t('Event payload too large'),
    short: dataType =>
      dataType
        ? t('The %s event exceeded maximum payload size.', dataType)
        : t('The event exceeded maximum payload size.'),
    long: t('The event exceeded the maximum payload size.'),
  },
  'too_large:log': {
    title: t('Log payload too large'),
    short: t('The log event exceeded maximum payload size.'),
    long: t('The log event exceeded the maximum payload size.'),
  },
  'too_large:profile': {
    title: t('Profile payload too large'),
    short: t('The profile event exceeded maximum payload size.'),
  },
  'too_large:span': {
    title: t('Span payload too large'),
    short: t('The span event exceeded maximum payload size.'),
    long: t('The span event exceeded the maximum payload size.'),
  },
  'too_large:trace_metric': {
    title: t('Application metric payload too large'),
    short: t('The application metric event exceeded maximum payload size.'),
    long: t('The application metric event exceeded the maximum payload size.'),
  },
  'too_large:transaction': {
    title: t('Transaction payload too large'),
    short: t('The transaction exceeded maximum payload size.'),
    long: t(
      'The transaction exceeded the maximum payload size. Transactions carry their spans inline, so payload size is usually driven by span count rather than by any single large field.'
    ),
  },
  'too_large:profile_chunk': {
    title: t('Profile chunk too large'),
    short: t('Profile chunk over size or count limit.'),
    long: t(
      'Sentry rejected a continuous profiling chunk because it was over the profile size limit (50 MiB by default), or because it was sent in the same envelope (one SDK upload) as another profile or profile chunk. The whole envelope is rejected.'
    ),
  },
  'too_large:replay_event': {
    title: t('Replay event too large'),
    short: t('Replay metadata event over size limit.'),
    long: t(
      "Sentry rejected a replay's metadata event because it was over the event size limit (1 MiB by default), or because it was sent in the same envelope (one SDK upload) as another event. The whole envelope is rejected, including the replay recording sent with it, so that replay segment is lost."
    ),
  },
  'too_large:replay_recording': {
    title: t('Replay recording too large'),
    short: t('Replay recording over size limit.'),
    long: t(
      'Sentry dropped a replay segment because its recording was over 10 MiB compressed (the default limit), because more than one recording was sent in the same envelope (one SDK upload), or because the replay event, recording, and video together reached 15 MiB. Oversized mobile video segments can also show up under this reason.'
    ),
  },
  'too_large:replay_video': {
    title: t('Replay video too large'),
    short: t('Mobile replay video over size limit.'),
    long: t(
      'Sentry rejected a mobile replay segment because its video was over the size limit (10 MiB compressed by default), or because more than one video was sent in the same envelope (one SDK upload). Normal segments are far below this limit, so this likely points to an SDK problem or an unusual segment.'
    ),
  },
  'too_large:check_in': {
    title: t('Check-in too large'),
    short: t('Cron check-in over size or count limit.'),
    long: t(
      'Sentry rejected a cron monitor check-in because it was over the check-in size limit (100 KiB by default), or because the envelope (one SDK upload) held more than one check-in. The whole envelope is rejected.'
    ),
  },
  'too_large:session': {
    title: t('Session update too large'),
    short: t('Too many or too large session updates.'),
    long: t(
      'Sentry rejected release health session updates because the envelope (one SDK upload) was over the session size limit (10 MiB by default) or held more than 100 session items. The whole envelope is rejected.'
    ),
  },
  'too_large:sessions': {
    title: t('Session aggregates too large'),
    short: t('Too many or too large session aggregates.'),
    long: t(
      'Sentry rejected pre-aggregated release health sessions, which server-mode SDKs send, because the envelope (one SDK upload) was over the shared session size limit (10 MiB by default) or held more than 100 session items. The whole envelope is rejected.'
    ),
  },
  'too_large:user_report': {
    title: t('Legacy user feedback too large'),
    short: t('User report hit shared attachment limits.'),
    long: t(
      'Sentry rejected an envelope (one SDK upload) because a user report from the older user feedback API pushed it over the attachment size or count limits it shares with attachments. User reports are small, so the attachments sent with it are usually what caused the overflow.'
    ),
  },
  'too_large:user_report_v2': {
    title: t('User feedback too large'),
    short: t('User feedback over event size limit.'),
    long: t(
      'Sentry rejected user feedback because it was over the event size limit (1 MiB by default), or because it was sent in the same envelope (one SDK upload) as another event. Feedback screenshots are separate attachments and do not count toward this check.'
    ),
  },
  'too_large:security': {
    title: t('Security event too large'),
    short: t('Forwarded CSP event over size limit.'),
    long: t(
      "Sentry rejected a Content Security Policy (CSP) event because it was over the event size limit (1 MiB by default), or because it was sent in the same envelope (one upload) as another event. Sentry's own endpoints already cap these reports, so this usually comes from a downstream Relay (Sentry's ingestion service, which you can also run yourself) forwarding an oversized CSP event."
    ),
  },
  'too_large:raw_security': {
    title: t('Security report too large'),
    short: t('Browser security report over size limit.'),
    long: t(
      "Sentry rejected a browser security report, such as a CSP violation, because it was larger than the event size limit (1 MiB by default). The security report endpoint already caps reports at this limit, so this only happens when a raw report is sent directly inside an envelope (one upload), for example by your own client or by a Relay (Sentry's ingestion service) running in proxy mode."
    ),
  },
  'too_large:unreal_report': {
    title: t('Unreal crash report too large'),
    short: t('Unreal crash report over size limit.'),
    long: t(
      'Sentry rejected an Unreal Engine crash report because it was over the shared attachment limits (200 MiB per item, 30 items, and 200 MiB total by default), or because it grew past 200 MiB once unpacked. These drops are counted as errors.'
    ),
  },
  'too_large:form_data': {
    title: t('Form data too large'),
    short: t('Crash upload form fields over size limit.'),
    long: t(
      'Sentry rejected a multipart crash upload, such as a minidump upload, because its non-file form fields together were over the event size limit (1 MiB by default). Form data has no data category of its own, so the drop is recorded against the other items in the upload, such as the minidump.'
    ),
  },
  'too_large:client_report': {
    title: t('Client report too large'),
    short: t("SDK's client report exceeded its limits."),
    long: t(
      "Sentry rejected an envelope (one SDK upload) because the SDK's client report, its summary of data it dropped, was over the size or count limits. A lone client report records nothing here, so this only appears when other items in the same envelope were dropped with it, and it points to an SDK problem rather than your data."
    ),
  },
  'too_large:statsd': {
    title: t('Legacy custom metrics too large'),
    short: t('Legacy statsd metrics over size limit.'),
    long: t(
      'Legacy: Sentry rejected custom metrics sent in the old statsd format because they were over the size limit. Sentry no longer accepts this format or emits this reason, so it only appears in historical data.'
    ),
  },
  'too_large:metric_buckets': {
    title: t('Metric buckets too large'),
    short: t('Relay metric buckets over size limit.'),
    long: t(
      "Sentry rejected metric buckets sent by a downstream Relay (Sentry's ingestion service, which some customers run themselves) because they were over the size limit (1 MiB by default), or because more than one was sent in the same envelope (one upload). SDKs never send metric buckets, so this comes from Relay-to-Relay traffic, and many of these rejections record no count."
    ),
  },
  'too_large:integration': {
    title: t('Integration payload too large'),
    short: t('OTLP, Vercel, or NEL payload too large.'),
    long: t(
      'Sentry rejected an OpenTelemetry (OTLP), Vercel log drain, or Network Error Logging (NEL) payload because it was over the size limit (12 MiB by default). Those endpoints usually refuse oversized requests before this check, so this reason needs an envelope (one upload) that carries the integration data directly, or more than one item of the same kind, and is rare.'
    ),
  },
  'too_large:unknown': {
    title: t('Unknown item too large'),
    short: t('Unrecognized item type over size limit.'),
    long: t(
      "Legacy: Sentry rejected an item of a type Relay (Sentry's ingestion service) did not recognize because it was over the size limit. Current Relay versions no longer emit this reason, so it appears only in historical data or from older Relays, such as ones you run yourself."
    ),
  },
  'too_large:attachment:attachment': {
    title: t('Attachment too large'),
    short: t('Attachment over size or count limit.'),
    long: t(
      'Sentry rejected an envelope (one SDK upload) because an attachment was over the size limit or there were too many attachments. The whole envelope is rejected, including the event the attachments belong to.'
    ),
  },
  'too_large:attachment:minidump': {
    title: t('Minidump too large'),
    short: t('Minidump over attachment size limit.'),
    long: t(
      'Sentry rejected a crash minidump because it was over the attachment size limit, which is checked on upload and again after decompression. This can happen on the minidump upload endpoint or when the minidump is sent with other attachments in one upload.'
    ),
  },
  'too_large:attachment:apple_crash_report': {
    title: t('Apple crash report too large'),
    short: t('Apple crash report hit attachment limits.'),
    long: t(
      'Sentry rejected an envelope (one SDK upload) because an Apple crash report attachment was over the attachment size or count limits. These limits are shared, so other attachments sent with the crash may be what pushed it over.'
    ),
  },
  'too_large:attachment:event_payload': {
    title: t('Crash event payload too large'),
    short: t('Native crash event data over size limit.'),
    long: t(
      'Sentry rejected the event data attached to a native crash upload because it was over the event size limit (1 MiB by default). Native crash uploads from sentry-native, Crashpad, and Breakpad send this data, and Unreal crash files can contain it too.'
    ),
  },
  'too_large:attachment:breadcrumbs': {
    title: t('Crash breadcrumbs too large'),
    short: t('Native crash breadcrumbs over size limit.'),
    long: t(
      'Sentry rejected the breadcrumbs file attached to a native crash upload because it was over the event size limit (1 MiB by default).'
    ),
  },
  'too_large:attachment:prosperodump': {
    title: t('PlayStation crash dump too large'),
    short: t('PlayStation crash dump over size limit.'),
    long: t(
      'Sentry rejected a PlayStation crash dump because it was over the attachment size limit once decompressed, or because it and the attachments sent with it went over the attachment limits on upload.'
    ),
  },
  'too_large:attachment:unreal_context': {
    title: t('Unreal context too large'),
    short: t('Unreal context over attachment limits.'),
    long: t(
      'Sentry rejected an Unreal Engine crash context attachment because it was over the attachment size or count limits. Sentry normally creates this file itself when unpacking an Unreal crash report, so this only appears when a client sends the context attachment directly.'
    ),
  },
  'too_large:attachment:unreal_logs': {
    title: t('Unreal crash logs too large'),
    short: t('Unreal crash logs over attachment limits.'),
    long: t(
      'Sentry rejected an Unreal Engine crash log attachment because it was over the attachment size or count limits. Sentry normally extracts these logs itself when unpacking an Unreal crash report, so this only appears when a client sends the log attachment directly.'
    ),
  },
  'too_large:attachment:view_hierarchy': {
    title: t('View hierarchy too large'),
    short: t('View hierarchy over attachment limits.'),
    long: t(
      'Sentry rejected an event because its view hierarchy attachment, which mobile SDKs send when view hierarchy capture is turned on, was over the attachment size or count limits. With a 200 MiB per-attachment default, the shared count or total limit is the more likely trigger.'
    ),
  },
  'too_large:attachment:nnswitch_dying_message': {
    title: t('Switch dying message too large'),
    short: t('Switch dying message hit attachment limit.'),
    long: t(
      'Sentry rejected an envelope (one SDK upload) because a Nintendo Switch dying message attachment was over the attachment size or count limits. The dying message has no count of its own, so the drop is recorded against the error event and other attachments.'
    ),
  },
  generic: {
    title: t('Generic rate limit'),
    short: t('Your requests across all event types were rate limited.'),
    long: t(
      "Your requests were throttled by Sentry's edge protection rather than by a quota. This applies to a single DSN key and to all data types, for the duration Sentry indicated in its Retry-After response."
    ),
  },
  project_abuse_limit: {
    title: t('Project abuse limit'),
    short: dataType =>
      dataType
        ? t('Your %s events exceeded the project abuse limit.', dataType)
        : t('Your events exceeded the project abuse limit.'),
    long: t(
      "Your project exceeded Sentry's abuse limit for a data type. This is a rate limit measured over a short window, not your billing quota and not spike protection."
    ),
  },
  smart_rate_limit: {
    title: t('Spike protection'),
    short: t('Spike protection dropped events to preserve your quota.'),
    long: t(
      'Spike protection detected a sudden increase in event volume for this project and began dropping events to stop the spike from consuming your quota.'
    ),
  },
  usage_exceeded: {
    title: t('Quota exceeded'),
    short: dataType =>
      dataType
        ? t('Your organization hit its quota for the %s event type.', dataType)
        : t('Your organization hit its quota for this event type.'),
    long: t(
      "Your organization's quota for this data category was fully consumed and no pay-as-you-go budget remained."
    ),
  },
  rate_limited: {
    title: t('Internal rate limit'),
    short: t('Over an internal Sentry rate limit.'),
    long: t(
      'Sentry dropped data that went over one of its internal rate limits. This covers attachments over the per-project save limit, cron check-ins over the per-monitor limit, and Seer scanner and autofix runs that Sentry starts automatically.'
    ),
  },
  key_quota: {
    title: t('DSN rate limit'),
    short: t('Exceeded the DSN rate limit.'),
    long: t(
      "Sentry dropped events because they went over the rate limit set on the project's client key (DSN). The limit covers errors and security reports such as CSP reports."
    ),
  },
};

function normalizeReason(reason: string): string {
  if (reason === 'ignored') {
    return 'ignore_spans';
  }
  if (reason.startsWith('custom-inbound-filter:')) {
    return 'custom-inbound-filter';
  }
  return reason.endsWith('_usage_exceeded') ? 'usage_exceeded' : reason;
}

export function reasonTitle(reason: string): string {
  return REASON_INFO[normalizeReason(reason)]?.title ?? reason;
}

export function dataCategoryInfo(category: string) {
  return Object.values(DATA_CATEGORY_INFO).find(info => info.name === category);
}

export function reasonDescription(reason: string, category: string): string | undefined {
  const short = REASON_INFO[normalizeReason(reason)]?.short;
  return typeof short === 'function'
    ? short(dataCategoryInfo(category)?.displayName)
    : short;
}

export function reasonLongDescription(reason: string): string | undefined {
  return REASON_INFO[normalizeReason(reason)]?.long;
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
