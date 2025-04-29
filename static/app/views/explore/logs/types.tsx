import type {
  ColumnValueType,
  CountUnit,
  CurrencyUnit,
  DurationUnit,
  PercentageUnit,
  PercentChangeUnit,
} from 'sentry/utils/discover/fields';

type OurLogCustomFieldKey = string; // We could brand this for nominal types.

// This enum is used to represent known fields or attributes in the logs response.
// Should always map to the public alias from the backend (.../search/eap/ourlogs/attributes.py)
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
  CODE_FILE_PATH = 'code.file.path',
  CODE_LINE_NUMBER = 'tags[code.line.number,number]',
  CODE_FUNCTION_NAME = 'code.function.name',

  // From the EAP dataset directly not using a column alias.
  ID = 'sentry.item_id',
  RELEASE = 'sentry.release',
  TEMPLATE = 'sentry.message.template',
  PARENT_SPAN_ID = 'sentry.trace.parent_span_id',
  SDK_NAME = 'sentry.sdk.name',
  SDK_VERSION = 'sentry.sdk.version',

  // From the EAP dataset directly not using a column alias, should be hidden.
  ITEM_TYPE = 'sentry.item_type',
}

export type OurLogFieldKey = OurLogCustomFieldKey | OurLogKnownFieldKey;

type OurLogsKnownFieldResponseMap = {
  [OurLogKnownFieldKey.MESSAGE]: string;
  [OurLogKnownFieldKey.SEVERITY_NUMBER]: number;
  [OurLogKnownFieldKey.SEVERITY]: string;
  [OurLogKnownFieldKey.ORGANIZATION_ID]: number;
  [OurLogKnownFieldKey.PROJECT_ID]: string;
  [OurLogKnownFieldKey.TIMESTAMP]: string;
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
