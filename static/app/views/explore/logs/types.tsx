import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {
  CountUnit,
  CurrencyUnit,
  DurationUnit,
  PercentageUnit,
  PercentChangeUnit,
} from 'sentry/utils/discover/fields';
import type {AggregationKey} from 'sentry/utils/fields';
import type {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';

type OurLogCustomFieldKey = string; // We could brand this for nominal types.

// This enum is used to represent known fields or attributes in the logs response.
// Should always map to the public alias from the backend (.../search/eap/ourlogs/attributes.py)
// This is not an exhaustive list, it's only the fields which have special handling in the frontend
export enum OurLogKnownFieldKey {
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
  LOGGER = 'logger.name',

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

  // INTERNAL only (these only appear for staff)
  INTERNAL_ONLY_INGESTED_AT = 'tags[sentry._internal.ingested_at,number]',
}

export type OurLogFieldKey = OurLogCustomFieldKey | OurLogKnownFieldKey;

type OurLogsKnownFieldResponseMap = Record<
  (typeof AlwaysPresentLogFields)[number],
  string | number
> & {
  [OurLogKnownFieldKey.MESSAGE]: string;
  [OurLogKnownFieldKey.TRACE_ID]: string;
  [OurLogKnownFieldKey.ID]: string;
  [OurLogKnownFieldKey.SEVERITY]: string;
  [OurLogKnownFieldKey.ORGANIZATION_ID]: number;
  [OurLogKnownFieldKey.PROJECT_ID]: string;
  [OurLogKnownFieldKey.TIMESTAMP]: string;
  [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: string | number;
  [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: string | number;
};

type OurLogsCustomFieldResponseMap = Record<OurLogCustomFieldKey, string | number>;

export type OurLogsResponseItem = OurLogsKnownFieldResponseMap &
  OurLogsCustomFieldResponseMap;

export type LogAttributeUnits =
  | null
  | DurationUnit
  | CurrencyUnit
  | PercentageUnit
  | PercentChangeUnit
  | CountUnit;

export interface LogRowItem {
  fieldKey: OurLogFieldKey;
  unit: LogAttributeUnits;
  value: OurLogsResponseItem[OurLogFieldKey];
}

export interface EventsLogsResult {
  data: OurLogsResponseItem[];
  meta?: EventsMetaType;
}

export type OurLogsAggregate =
  | AggregationKey.COUNT
  | AggregationKey.COUNT_UNIQUE
  | AggregationKey.SUM
  | AggregationKey.AVG
  | AggregationKey.P50
  | AggregationKey.P75
  | AggregationKey.P90
  | AggregationKey.P95
  | AggregationKey.P99
  | AggregationKey.MIN
  | AggregationKey.MAX;

type OurLogsAggregateKeys = `${OurLogsAggregate}(${OurLogFieldKey})`;
type OurLogsAggregateResponseItem = Record<
  keyof OurLogsResponseItem | OurLogsAggregateKeys,
  string | number
>;

export interface LogsAggregatesResult {
  data: OurLogsAggregateResponseItem[];
  meta?: EventsMetaType;
}
