import {FieldKey, MobileVital, WebVital} from 'sentry/utils/fields';

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

// This list matches currently supported tags in metrics extraction defined in
// https://github.com/getsentry/sentry/blob/2fd2459c274dc81c079fd4c31b2755114602ef7c/src/sentry/snuba/metrics/extraction.py#L42
export const ON_DEMAND_METRICS_SUPPORTED_TAGS = new Set([
  ...STANDARD_SEARCH_FIELD_KEYS,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  FieldKey.USER_IP,
  FieldKey.USER_USERNAME,
  FieldKey.USER_SEGMENT,
  FieldKey.GEO_CITY,
  FieldKey.GEO_REGION,
  FieldKey.GEO_SUBDIVISION,

  FieldKey.DEVICE_NAME,
  FieldKey.DEVICE_FAMILY,
  FieldKey.OS_KERNEL_VERSION,

  FieldKey.TRANSACTION_DURATION,
  FieldKey.RELEASE_BUILD,
  FieldKey.RELEASE_PACKAGE,
  FieldKey.RELEASE_VERSION,

  ...Object.values(WebVital),
  ...Object.values(MobileVital),
]) as Set<FieldKey>;
