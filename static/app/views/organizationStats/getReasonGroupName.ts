import startCase from 'lodash/startCase';

import {Outcome} from 'sentry/types/core';

// List of Relay's current invalid reasons - https://github.com/getsentry/relay/blob/89a8dd7caaad1f126e1cacced0d73bb50fcd4f5a/relay-server/src/services/outcome.rs#L333
enum DiscardReason {
  DUPLICATE = 'duplicate',
  PROJECT_ID = 'project_id',
  AUTH_VERSION = 'auth_version',
  AUTH_CLIENT = 'auth_client',
  NO_DATA = 'no_data',
  DISALLOWED_METHOD = 'disallowed_method',
  CONTENT_TYPE = 'content_type',
  INVALID_MULTIPART = 'invalid_multipart',
  INVALID_MSGPACK = 'invalid_msgpack',
  INVALID_JSON = 'invalid_json',
  INVALID_ENVELOPE = 'invalid_envelope',
  TIMESTAMP = 'timestamp',
  DUPLICATE_ITEM = 'duplicate_item',
  INVALID_TRANSACTION = 'invalid_transaction',
  INVALID_SPAN = 'invalid_span',
  INVALID_REPLAY = 'invalid_replay',
  INVALID_REPLAY_RECORDING = 'invalid_replay_recording',
  INVALID_REPLAY_VIDEO = 'invalid_replay_video',
  PAYLOAD = 'payload',
  INVALID_COMPRESSION = 'invalid_compression',
  TOO_LARGE = 'too_large',
  MISSING_MINIDUMP_UPLOAD = 'missing_minidump_upload',
  INVALID_MINIDUMP = 'invalid_minidump',
  SECURITY_REPORT = 'security_report',
  SECURITY_REPORT_TYPE = 'security_report_type',
  PROCESS_UNREAL = 'process_unreal',
  CORS = 'cors',
  NO_EVENT_PAYLOAD = 'no_event_payload',
  EMPTY_ENVELOPE = 'empty_envelope',
  INVALID_REPLAY_NO_PAYLOAD = 'invalid_replay_no_payload',
  TRANSACTION_SAMPLED = 'transaction_sampled',
  INTERNAL = 'internal',
  MULTI_PROJECT_ID = 'multi_project_id',
  PROJECT_STATE = 'project_state',
  PROJECT_STATE_PII = 'project_state_pii',
  INVALID_REPLAY_PII_SCRUBBER_FAILED = 'invalid_replay_pii_scrubber_failed',
  FEATURE_DISABLED = 'feature_disabled',
}

// List of Client Discard Reason according to the Client Report's doc - https://develop.sentry.dev/sdk/client-reports/#envelope-item-payload
enum ClientDiscardReason {
  QUEUE_OVERFLOW = 'queue_overflow',
  CACHE_OVERFLOW = 'cache_overflow',
  RATELIMIT_BACKOFF = 'ratelimit_backoff',
  NETWORK_ERROR = 'network_error',
  SAMPLE_RATE = 'sample_rate',
  BEFORE_SEND = 'before_send',
  EVENT_PROCESSSOR = 'event_processor',
  SEND_ERROR = 'send_error',
  INTERNAL_SDK_ERROR = 'internal_sdk_error',
  INSUFFICIENT_DATA = 'insufficient_data',
  BACKPRESSURE = 'backpressure',
}

enum RateLimitedReason {
  PROJECT_QUOTA = 'project_quota',
  ORG_QUOTA = 'org_quota',
  KEY_QUOTA = 'key_quota',
  SPIKE_PROTECTION = 'spike_protection',
  SMART_RATE_LIMIT = 'smart_rate_limit',
}

// Invalid reasons should not be exposed directly, but instead in the following groups:
const invalidReasonsGroup: Record<string, DiscardReason[]> = {
  duplicate: [DiscardReason.DUPLICATE],
  project_missing: [DiscardReason.PROJECT_ID],
  invalid_request: [
    DiscardReason.AUTH_VERSION,
    DiscardReason.AUTH_CLIENT,
    DiscardReason.NO_DATA,
    DiscardReason.DISALLOWED_METHOD,
    DiscardReason.CONTENT_TYPE,
    DiscardReason.INVALID_MULTIPART,
    DiscardReason.INVALID_MSGPACK,
    DiscardReason.INVALID_JSON,
    DiscardReason.INVALID_ENVELOPE,
    DiscardReason.TIMESTAMP,
    DiscardReason.DUPLICATE_ITEM,
  ],
  invalid_data: [
    DiscardReason.INVALID_TRANSACTION,
    DiscardReason.INVALID_SPAN,
    DiscardReason.INVALID_REPLAY,
    DiscardReason.INVALID_REPLAY_RECORDING,
    DiscardReason.INVALID_REPLAY_VIDEO,
  ],
  payload: [DiscardReason.PAYLOAD, DiscardReason.INVALID_COMPRESSION],
  too_large: [DiscardReason.TOO_LARGE],
  minidump: [DiscardReason.MISSING_MINIDUMP_UPLOAD, DiscardReason.INVALID_MINIDUMP],
  security_report: [DiscardReason.SECURITY_REPORT, DiscardReason.SECURITY_REPORT_TYPE],
  unreal: [DiscardReason.PROCESS_UNREAL],
  disallowed_domain: [DiscardReason.CORS],
  empty: [
    DiscardReason.NO_EVENT_PAYLOAD,
    DiscardReason.EMPTY_ENVELOPE,
    DiscardReason.INVALID_REPLAY_NO_PAYLOAD,
  ],
  sampling: [DiscardReason.TRANSACTION_SAMPLED],
};

function getInvalidReasonGroupName(reason: DiscardReason): string {
  for (const [group, reasons] of Object.entries(invalidReasonsGroup)) {
    if (reasons.includes(reason)) {
      return group;
    }
  }
  return 'internal';
}

function getRateLimitedReasonGroupName(reason: RateLimitedReason | string): string {
  if (reason.endsWith('_usage_exceeded')) {
    return 'quota';
  }

  if (reason.endsWith('_disabled')) {
    return 'disabled';
  }

  switch (reason) {
    case RateLimitedReason.ORG_QUOTA:
    case RateLimitedReason.PROJECT_QUOTA:
      return 'global limit';
    case RateLimitedReason.KEY_QUOTA:
      return 'DSN limit';
    case RateLimitedReason.SPIKE_PROTECTION:
    case RateLimitedReason.SMART_RATE_LIMIT:
      return 'spike protection';
    default:
      return 'internal';
  }
}

function getClientDiscardReasonGroupName(reason: ClientDiscardReason): string {
  switch (reason) {
    case ClientDiscardReason.QUEUE_OVERFLOW:
    case ClientDiscardReason.CACHE_OVERFLOW:
    case ClientDiscardReason.RATELIMIT_BACKOFF:
    case ClientDiscardReason.NETWORK_ERROR:
    case ClientDiscardReason.SAMPLE_RATE:
    case ClientDiscardReason.BEFORE_SEND:
    case ClientDiscardReason.EVENT_PROCESSSOR:
    case ClientDiscardReason.SEND_ERROR:
    case ClientDiscardReason.INTERNAL_SDK_ERROR:
    case ClientDiscardReason.INSUFFICIENT_DATA:
    case ClientDiscardReason.BACKPRESSURE:
      return reason;
    default:
      return 'other';
  }
}

export function getReasonGroupName(outcome: string | number, reason: string): string {
  switch (outcome) {
    case Outcome.INVALID:
      return getInvalidReasonGroupName(reason as DiscardReason);
    case Outcome.CARDINALITY_LIMITED:
    case Outcome.RATE_LIMITED:
    case Outcome.ABUSE:
      return getRateLimitedReasonGroupName(reason as RateLimitedReason);
    case Outcome.FILTERED:
      return startCase(reason);
    case Outcome.CLIENT_DISCARD:
      return getClientDiscardReasonGroupName(reason as ClientDiscardReason);
    default:
      return String(reason);
  }
}
