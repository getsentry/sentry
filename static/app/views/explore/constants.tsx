import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {SpanFields} from 'sentry/views/insights/types';

export const SENTRY_SEARCHABLE_SPAN_STRING_TAGS: string[] = [
  // NOTE: intentionally choose to not expose transaction id
  // as we're moving toward span ids

  'id', // SpanIndexedField.SPAN_ID is actually `span_id`
  'profile.id', // SpanIndexedField.PROFILE_ID is actually `profile_id`
  SpanFields.BROWSER_NAME,
  SpanFields.ENVIRONMENT,
  SpanFields.ORIGIN_TRANSACTION,
  SpanFields.PROJECT,
  SpanFields.RAW_DOMAIN,
  SpanFields.RELEASE,
  SpanFields.SDK_NAME,
  SpanFields.SDK_VERSION,
  SpanFields.SPAN_ACTION,
  SpanFields.SPAN_CATEGORY,
  SpanFields.SPAN_DESCRIPTION,
  SpanFields.SPAN_DOMAIN,
  SpanFields.SPAN_GROUP,
  SpanFields.SPAN_OP,
  SpanFields.SPAN_STATUS,
  SpanFields.TIMESTAMP,
  SpanFields.TRACE,
  SpanFields.TRANSACTION,
  SpanFields.TRANSACTION_METHOD,
  SpanFields.TRANSACTION_OP,
  SpanFields.USER,
  SpanFields.USER_EMAIL,
  SpanFields.USER_GEO_SUBREGION,
  SpanFields.USER_ID,
  SpanFields.USER_IP,
  SpanFields.USER_USERNAME,
  SpanFields.IS_TRANSACTION, // boolean field but we can expose it as a string
  SpanFields.NORMALIZED_DESCRIPTION,
  SpanFields.CACHE_HIT,
];

export const SENTRY_SEARCHABLE_SPAN_NUMBER_TAGS: string[] = [
  SpanFields.SPAN_DURATION,
  SpanFields.SPAN_SELF_TIME,
];

export const SENTRY_SPAN_STRING_TAGS: string[] = [
  'id', // SpanIndexedField.SPAN_ID is actually `span_id`
  SpanFields.PROJECT,
  SpanFields.SPAN_DESCRIPTION,
  SpanFields.SPAN_OP,
  SpanFields.TIMESTAMP,
  SpanFields.TRANSACTION,
  SpanFields.TRACE,
  SpanFields.IS_TRANSACTION, // boolean field but we can expose it as a string
  SpanFields.NORMALIZED_DESCRIPTION,
  SpanFields.RELEASE, // temporary as orgs with >1k keys still want releases
  SpanFields.PROJECT_ID,
  SpanFields.SDK_NAME,
  SpanFields.SDK_VERSION,
  SpanFields.SPAN_SYSTEM,
  SpanFields.SPAN_CATEGORY,
  SpanFields.USER_ID,
  SpanFields.USER_IP,
  SpanFields.USER_EMAIL,
  SpanFields.USER_USERNAME,
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

export const MAX_CROSS_EVENT_QUERIES = 2;
