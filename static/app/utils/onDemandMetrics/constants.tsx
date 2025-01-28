import {ErrorTags, FieldKey, SpanOpBreakdown, StackTags} from 'sentry/utils/fields';

export const STANDARD_SEARCH_FIELD_KEYS = new Set([
  FieldKey.RELEASE,
  FieldKey.DIST,
  FieldKey.ENVIRONMENT,
  FieldKey.TRANSACTION,
  FieldKey.PLATFORM,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,
  FieldKey.HTTP_METHOD,
  FieldKey.HTTP_STATUS_CODE,
  FieldKey.BROWSER_NAME,
  FieldKey.OS_NAME,
  FieldKey.GEO_COUNTRY_CODE,
]);

export const ON_DEMAND_METRICS_UNSUPPORTED_TAGS = new Set([
  FieldKey.ERROR_RECEIVED,
  FieldKey.HTTP_REFERER,
  FieldKey.ID,
  FieldKey.MESSAGE,
  FieldKey.PROFILE_ID,
  FieldKey.RELEASE_STAGE,
  FieldKey.TIMESTAMP_TO_DAY,
  FieldKey.TIMESTAMP_TO_HOUR,
  FieldKey.TIMESTAMP,
  FieldKey.TITLE,
  FieldKey.TRACE_PARENT_SPAN,
  FieldKey.TRACE_SPAN,
  FieldKey.TRACE,
  FieldKey.USER,
  FieldKey.USER_DISPLAY,
  ...Object.values(SpanOpBreakdown),
  ...Object.values(StackTags),
  ...Object.values(ErrorTags),
]) as Set<FieldKey>;

export const ERROR_ONLY_TAGS = new Set(Object.values(ErrorTags));
