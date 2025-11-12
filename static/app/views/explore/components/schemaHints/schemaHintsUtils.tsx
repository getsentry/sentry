import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKey} from 'sentry/utils/fields';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {onlyShowKeys, removeHiddenKeys} from 'sentry/views/explore/utils';
import {SpanFields} from 'sentry/views/insights/types';

export const USER_IDENTIFIER_KEY = 'user.key';

const FRONTEND_HINT_KEYS = [SpanFields.BROWSER_NAME, USER_IDENTIFIER_KEY];

const MOBILE_HINT_KEYS = [FieldKey.OS_NAME, FieldKey.DEVICE_FAMILY, USER_IDENTIFIER_KEY];

const COMMON_HINT_KEYS = [
  SpanFields.IS_TRANSACTION,
  SpanFields.SPAN_OP,
  SpanFields.SPAN_DESCRIPTION,
  SpanFields.SPAN_DURATION,
  SpanFields.TRANSACTION,
  FieldKey.HTTP_STATUS_CODE,
  SpanFields.RELEASE,
  'url',
];

const LOGS_HINT_KEYS = [
  OurLogKnownFieldKey.MESSAGE,
  OurLogKnownFieldKey.SEVERITY,
  OurLogKnownFieldKey.SEVERITY_NUMBER,
  OurLogKnownFieldKey.TEMPLATE,
  OurLogKnownFieldKey.RELEASE,
  OurLogKnownFieldKey.BROWSER_NAME,
  OurLogKnownFieldKey.USER_ID,
  OurLogKnownFieldKey.USER_EMAIL,
  OurLogKnownFieldKey.USER_NAME,
  OurLogKnownFieldKey.SERVER_ADDRESS,
];

const AI_GENERATIONS_HINT_KEYS = [
  SpanFields.GEN_AI_REQUEST_MODEL,
  SpanFields.GEN_AI_AGENT_NAME,
  SpanFields.GEN_AI_REQUEST_MESSAGES,
  SpanFields.GEN_AI_RESPONSE_TEXT,
  SpanFields.GEN_AI_RESPONSE_OBJECT,
  SpanFields.TRANSACTION,
  SpanFields.RELEASE,
];

const SCHEMA_HINTS_LIST_ORDER_KEYS_LOGS = [...new Set([...LOGS_HINT_KEYS])];

const SCHEMA_HINTS_LIST_ORDER_KEYS_AI_GENERATIONS = [
  ...new Set([...AI_GENERATIONS_HINT_KEYS]),
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
const SCHEMA_HINTS_HIDDEN_KEYS: string[] = [
  ...new Set([...SCHEMA_HINTS_HIDDEN_KEYS_LOGS]),
];

export enum SchemaHintsSources {
  EXPLORE = 'explore',
  LOGS = 'logs',
  AI_GENERATIONS = 'ai_generations',
}

export const getSchemaHintsListOrder = (source: SchemaHintsSources) => {
  if (source === SchemaHintsSources.LOGS) {
    return SCHEMA_HINTS_LIST_ORDER_KEYS_LOGS;
  }
  if (source === SchemaHintsSources.AI_GENERATIONS) {
    return SCHEMA_HINTS_LIST_ORDER_KEYS_AI_GENERATIONS;
  }

  return SCHEMA_HINTS_LIST_ORDER_KEYS_EXPLORE;
};

export const removeHiddenSchemaHintsKeys = (
  tagCollection: TagCollection
): TagCollection => {
  return removeHiddenKeys(tagCollection, SCHEMA_HINTS_HIDDEN_KEYS);
};

export const onlyShowSchemaHintsKeys = (
  tagCollection: Tag[],
  source: SchemaHintsSources
): Tag[] => {
  if (source === SchemaHintsSources.LOGS) {
    return onlyShowKeys(tagCollection, SCHEMA_HINTS_LIST_ORDER_KEYS_LOGS);
  }

  return tagCollection;
};
