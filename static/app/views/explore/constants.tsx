import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {SpanFields, SpanIndexedField} from 'sentry/views/insights/types';

export const SENTRY_SEARCHABLE_SPAN_STRING_TAGS: string[] = [
  // NOTE: intentionally choose to not expose transaction id
  // as we're moving toward span ids

  'id', // SpanIndexedField.SPAN_ID is actually `span_id`
  'profile.id', // SpanIndexedField.PROFILE_ID is actually `profile_id`
  SpanIndexedField.BROWSER_NAME,
  SpanIndexedField.ENVIRONMENT,
  SpanIndexedField.ORIGIN_TRANSACTION,
  SpanIndexedField.PROJECT,
  SpanIndexedField.RAW_DOMAIN,
  SpanIndexedField.RELEASE,
  SpanIndexedField.SDK_NAME,
  SpanIndexedField.SDK_VERSION,
  SpanIndexedField.SPAN_ACTION,
  SpanIndexedField.SPAN_CATEGORY,
  SpanIndexedField.SPAN_DESCRIPTION,
  SpanIndexedField.SPAN_DOMAIN,
  SpanIndexedField.SPAN_GROUP,
  SpanIndexedField.SPAN_OP,
  SpanIndexedField.SPAN_STATUS,
  SpanIndexedField.TIMESTAMP,
  SpanIndexedField.TRACE,
  SpanIndexedField.TRANSACTION,
  SpanIndexedField.TRANSACTION_METHOD,
  SpanIndexedField.TRANSACTION_OP,
  SpanIndexedField.USER,
  SpanIndexedField.USER_EMAIL,
  SpanIndexedField.USER_GEO_SUBREGION,
  SpanIndexedField.USER_ID,
  SpanIndexedField.USER_IP,
  SpanIndexedField.USER_USERNAME,
  SpanIndexedField.IS_TRANSACTION, // boolean field but we can expose it as a string
  SpanIndexedField.NORMALIZED_DESCRIPTION,
  SpanIndexedField.CACHE_HIT,
];

export const SENTRY_SEARCHABLE_SPAN_NUMBER_TAGS: string[] = [
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.SPAN_SELF_TIME,
];

export const SENTRY_SPAN_STRING_TAGS: string[] = [
  'id', // SpanIndexedField.SPAN_ID is actually `span_id`
  SpanIndexedField.PROJECT,
  SpanIndexedField.SPAN_DESCRIPTION,
  SpanIndexedField.SPAN_OP,
  SpanIndexedField.TIMESTAMP,
  SpanIndexedField.TRANSACTION,
  SpanIndexedField.TRACE,
  SpanIndexedField.IS_TRANSACTION, // boolean field but we can expose it as a string
  SpanIndexedField.NORMALIZED_DESCRIPTION,
  SpanIndexedField.RELEASE, // temporary as orgs with >1k keys still want releases
  SpanFields.PROJECT_ID,
  SpanFields.SPAN_SYSTEM,
  SpanFields.SPAN_CATEGORY,
];

export const SENTRY_SPAN_NUMBER_TAGS: string[] = [...SENTRY_SEARCHABLE_SPAN_NUMBER_TAGS];

export const SENTRY_LOG_STRING_TAGS: string[] = [
  OurLogKnownFieldKey.TRACE_ID,
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.MESSAGE,
  OurLogKnownFieldKey.SEVERITY,
  OurLogKnownFieldKey.TIMESTAMP,
];

export const SENTRY_LOG_NUMBER_TAGS: string[] = [OurLogKnownFieldKey.SEVERITY_NUMBER];
