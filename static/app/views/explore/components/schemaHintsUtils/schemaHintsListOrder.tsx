import type {TagCollection} from 'sentry/types/group';
import {FieldKey} from 'sentry/utils/fields';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {SpanIndexedField} from 'sentry/views/insights/types';

const FRONTEND_HINT_KEYS = [SpanIndexedField.BROWSER_NAME, SpanIndexedField.USER];

const MOBILE_HINT_KEYS = [
  FieldKey.OS_NAME,
  FieldKey.DEVICE_FAMILY,
  SpanIndexedField.USER,
];

const COMMON_HINT_KEYS = [
  SpanIndexedField.IS_TRANSACTION,
  SpanIndexedField.SPAN_OP,
  SpanIndexedField.SPAN_DESCRIPTION,
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.TRANSACTION,
  FieldKey.HTTP_STATUS_CODE,
  SpanIndexedField.RELEASE,
  'url',
];

const LOGS_HINT_KEYS = [
  OurLogKnownFieldKey.BODY,
  OurLogKnownFieldKey.SEVERITY_TEXT,
  OurLogKnownFieldKey.SEVERITY_NUMBER,
  OurLogKnownFieldKey.ORGANIZATION_ID,
  OurLogKnownFieldKey.PROJECT_ID,
  OurLogKnownFieldKey.PARENT_SPAN_ID,
  OurLogKnownFieldKey.TIMESTAMP,
];

const SCHEMA_HINTS_LIST_ORDER_KEYS_LOGS = [
  ...new Set([
    ...FRONTEND_HINT_KEYS,
    ...MOBILE_HINT_KEYS,
    ...LOGS_HINT_KEYS,
    ...COMMON_HINT_KEYS,
  ]),
];

const SCHEMA_HINTS_LIST_ORDER_KEYS_EXPLORE = [
  ...new Set([...FRONTEND_HINT_KEYS, ...MOBILE_HINT_KEYS, ...COMMON_HINT_KEYS]),
];

const SCHEMA_HINTS_HIDDEN_KEYS_LOGS = [
  OurLogKnownFieldKey.SEVERITY_NUMBER, // Severity number is a detail saved by the OTel protocol, and may not be required. 'level' is a mandatory field on the new 'log' ItemType schema.
  OurLogKnownFieldKey.ITEM_TYPE, // This is a detail internal to the trace items table.
  OurLogKnownFieldKey.ID, // This is a detail internal to the trace items table.
];

// Unlike ORDER_KEYS, hidden keys are completely omitted from the schema hints list.
export const SCHEMA_HINTS_HIDDEN_KEYS: string[] = [
  ...new Set([...SCHEMA_HINTS_HIDDEN_KEYS_LOGS]),
];

export enum SchemaHintsSources {
  EXPLORE = 'explore',
  LOGS = 'logs',
}

export const getSchemaHintsListOrder = (source: SchemaHintsSources) => {
  if (source === SchemaHintsSources.LOGS) {
    return SCHEMA_HINTS_LIST_ORDER_KEYS_LOGS;
  }

  return SCHEMA_HINTS_LIST_ORDER_KEYS_EXPLORE;
};

export const removeHiddenKeys = (tagCollection: TagCollection): TagCollection => {
  const result: TagCollection = {};
  for (const key in tagCollection) {
    if (key && !SCHEMA_HINTS_HIDDEN_KEYS.includes(key) && tagCollection[key]) {
      result[key] = tagCollection[key];
    }
  }
  return result;
};
