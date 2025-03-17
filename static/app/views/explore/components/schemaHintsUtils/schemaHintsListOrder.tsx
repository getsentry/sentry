import {FieldKey} from 'sentry/utils/fields';
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

export const SCHEMA_HINTS_LIST_ORDER_KEYS = [
  ...new Set([...FRONTEND_HINT_KEYS, ...MOBILE_HINT_KEYS, ...COMMON_HINT_KEYS]),
];
