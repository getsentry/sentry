// This enum is used to represent known fields or attributes in the metrics response.
// Should always map to the public alias from the backend (.../search/eap/trace_metrics/attributes.py)
// This is not an exhaustive list, it's only the fields which have special handling in the frontend
export enum TraceMetricKnownFieldKey {
  TRACE_ID = 'trace',
  MESSAGE = 'message',
  SEVERITY_NUMBER = 'severity_number',
  SEVERITY = 'severity',
  ORGANIZATION_ID = 'organization.id',
  PROJECT_ID = 'project.id',
  PROJECT = 'project',
  SPAN_ID = 'span_id',
  TIMESTAMP = 'timestamp',
  TIMESTAMP_PRECISE = 'timestamp_precise',
  OBSERVED_TIMESTAMP_PRECISE = 'observed_timestamp',

  PAYLOAD_SIZE = 'payload_size',

  TEMPLATE = 'message.template',
  PARENT_SPAN_ID = 'trace.parent_span_id',

  // Field renderer aliases
  CODE_FILE_PATH = 'code.file.path',
  CODE_LINE_NUMBER = 'tags[code.line.number,number]',
  CODE_FUNCTION_NAME = 'code.function.name',

  // SDK attributes https://develop.sentry.dev/sdk/telemetry/logs/#default-attributes
  RELEASE = 'release',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  BROWSER_NAME = 'browser.name',
  BROWSER_VERSION = 'browser.version',
  USER_ID = 'user.id',
  USER_EMAIL = 'user.email',
  USER_NAME = 'user.name',
  SERVER_ADDRESS = 'server.address',

  // From the EAP dataset directly not using a column alias.
  ID = 'id',

  // From the EAP dataset directly not using a column alias, should be hidden.
  ITEM_TYPE = 'sentry.item_type',

  // Deprecated fields
  TIMESTAMP_NANOS = 'sentry.timestamp_nanos',

  // Replay integration
  REPLAY_ID = 'replay_id',
}

type TraceMetricCustomFieldKey = string;

export type TraceMetricFieldKey = TraceMetricCustomFieldKey | TraceMetricKnownFieldKey;
