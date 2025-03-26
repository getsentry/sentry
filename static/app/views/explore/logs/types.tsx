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
export enum OurLogKnownFieldKey {
  TRACE_ID = 'sentry.trace_id',
  ID = 'sentry.item_id',
  BODY = 'sentry.body',
  SEVERITY_NUMBER = 'sentry.severity_number',
  SEVERITY_TEXT = 'sentry.severity_text',
  ORGANIZATION_ID = 'sentry.organization_id',
  PROJECT_ID = 'project_id',
  SENTRY_PROJECT_ID = 'sentry.project_id',
  PARENT_SPAN_ID = 'sentry.trace.parent_span_id',
  TIMESTAMP = 'timestamp',
  ITEM_TYPE = 'sentry.item_type',
}

export type OurLogFieldKey = OurLogCustomFieldKey | OurLogKnownFieldKey;

export type OurLogsKnownFieldResponseMap = {
  [OurLogKnownFieldKey.BODY]: string;
  [OurLogKnownFieldKey.SEVERITY_NUMBER]: number;
  [OurLogKnownFieldKey.SEVERITY_TEXT]: string;
  [OurLogKnownFieldKey.ORGANIZATION_ID]: number;
  [OurLogKnownFieldKey.PROJECT_ID]: number;
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
