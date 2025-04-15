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
  // From the EAP dataset directly not using a column alias.
  ID = 'sentry.item_id',
  MESSAGE = 'message',
  TEMPLATE = 'sentry.message.template',
  SEVERITY_NUMBER = 'severity_number',
  SEVERITY_TEXT = 'severity_text',
  ORGANIZATION_ID = 'organization.id',
  PROJECT_ID = 'project.id',
  PROJECT = 'project',
  SPAN_ID = 'span_id',
  PARENT_SPAN_ID = 'sentry.trace.parent_span_id',
  TIMESTAMP = 'timestamp',
  // From the EAP dataset directly not using a column alias, should be hidden.
  ITEM_TYPE = 'sentry.item_type',
}

export type OurLogFieldKey = OurLogCustomFieldKey | OurLogKnownFieldKey;

export type OurLogsKnownFieldResponseMap = {
  [OurLogKnownFieldKey.MESSAGE]: string;
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
