import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {
  ColumnValueType,
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
  TIMESTAMP_PRECISE = 'tags[sentry.timestamp_precise,number]',
  OBSERVED_TIMESTAMP_PRECISE = 'sentry.observed_timestamp_nanos',
  CODE_FILE_PATH = 'code.file.path',
  CODE_LINE_NUMBER = 'tags[code.line.number,number]',
  CODE_FUNCTION_NAME = 'code.function.name',

  RELEASE = 'release',
  TEMPLATE = 'message.template',
  PARENT_SPAN_ID = 'trace.parent_span_id',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',

  // From the EAP dataset directly not using a column alias.
  ID = 'sentry.item_id',

  // From the EAP dataset directly not using a column alias, should be hidden.
  ITEM_TYPE = 'sentry.item_type',
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
  metaFieldType: ColumnValueType;
  unit: LogAttributeUnits;
  value: OurLogsResponseItem[OurLogFieldKey];
}

export interface LogAttributeItem {
  fieldKey: OurLogFieldKey;
  value: OurLogsResponseItem[OurLogFieldKey] | null;
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
