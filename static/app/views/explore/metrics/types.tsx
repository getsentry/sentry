// This enum is used to represent known fields or attributes in the metrics response.
// Should always map to the public alias from the backend (.../search/eap/trace_metrics/attributes.py)

import type {EventsMetaType} from 'sentry/utils/discover/eventView';

// This is not an exhaustive list, it's only the fields which have special handling in the frontend
export enum TraceMetricKnownFieldKey {
  TRACE = 'trace',
  MESSAGE = 'message',
  ORGANIZATION_ID = 'organization.id',
  PROJECT_ID = 'project.id',
  PROJECT = 'project',
  SPAN_ID = 'span_id',
  TIMESTAMP = 'timestamp',
  TIMESTAMP_PRECISE = 'timestamp_precise',
  OBSERVED_TIMESTAMP_PRECISE = 'observed_timestamp',

  METRIC_NAME = 'metric.name',
  METRIC_TYPE = 'metric.type',
  METRIC_VALUE = 'value',
  METRIC_UNIT = 'metric.unit',

  PAYLOAD_SIZE = 'payload_size',

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

  CLIENT_SAMPLE_RATE = 'tags[sentry.client_sample_rate,number]',

  // Deprecated fields
  TIMESTAMP_NANOS = 'sentry.timestamp_nanos',
  OBSERVED_TIMESTAMP_NANOS = 'sentry.observed_timestamp_nanos',
  TRACE_FLAGS = 'tags[sentry.trace_flags,number]',
  OLD_PROJECT_ID = 'project_id',
  OLD_SPAN_ID = 'sentry.span_id',

  // Replay integration
  REPLAY_ID = 'replay_id',
}

type TraceMetricCustomFieldKey = string;

export type TraceMetricFieldKey = TraceMetricCustomFieldKey | TraceMetricKnownFieldKey;

export type TraceMetricTypeValue = 'counter' | 'gauge' | 'distribution';

type TraceMetricsKnownFieldResponseMap = Record<
  TraceMetricKnownFieldKey,
  string | number
> & {
  [TraceMetricKnownFieldKey.METRIC_NAME]: string;
  [TraceMetricKnownFieldKey.METRIC_TYPE]: TraceMetricTypeValue;
  [TraceMetricKnownFieldKey.METRIC_UNIT]: string;
  [TraceMetricKnownFieldKey.METRIC_VALUE]: number;
  [TraceMetricKnownFieldKey.TIMESTAMP]: string;
  [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: number;
  [TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: number;
  [TraceMetricKnownFieldKey.ORGANIZATION_ID]: number;
  [TraceMetricKnownFieldKey.PROJECT_ID]: string;
  [TraceMetricKnownFieldKey.PROJECT]: string;
  [TraceMetricKnownFieldKey.SPAN_ID]: string;
  [TraceMetricKnownFieldKey.TRACE]: string;
  [TraceMetricKnownFieldKey.ID]: string;
};

type TraceMetricsCustomFieldResponseMap = Record<
  TraceMetricCustomFieldKey,
  string | number
>;

export type TraceMetricEventsResponseItem = TraceMetricsKnownFieldResponseMap &
  TraceMetricsCustomFieldResponseMap;

export interface TraceMetricEventsResult {
  data: TraceMetricEventsResponseItem[];
  meta?: EventsMetaType;
}

/**
 * These are the columns that are virtual and will be displayed in the table, but may not be backed by a table row.
 * eg. telemetry data columns (logs, spans, errors) are backed by a separate query.
 */
export enum VirtualTableSampleColumnKey {
  EXPAND_ROW = 'expand_row', // Chevron acts as an additional column
  PROJECT_BADGE = 'project_badge',
  LOGS = 'logs',
  SPANS = 'spans',
  ERRORS = 'errors',
}

export type SampleTableColumnKey = TraceMetricFieldKey | VirtualTableSampleColumnKey;
