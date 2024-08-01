import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {
  type FieldDefinition,
  FieldKey,
  FieldKind,
  FieldValueType,
  MobileVital,
  SpanOpBreakdown,
  WebVital,
} from 'sentry/utils/fields';
import {SpanFunction} from 'sentry/views/insights/types';

export const STARFISH_AGGREGATION_FIELDS: Record<
  SpanFunction,
  FieldDefinition & {defaultOutputType: AggregationOutputType}
> = {
  [SpanFunction.SPS]: {
    desc: t('Spans per second'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.SPM]: {
    desc: t('Spans per minute'),
    kind: FieldKind.FUNCTION,
    defaultOutputType: 'number',
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TIME_SPENT_PERCENTAGE]: {
    desc: t('Span time spent percentage'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.HTTP_ERROR_COUNT]: {
    desc: t('Count of 5XX http errors'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.HTTP_RESPONSE_RATE]: {
    desc: t('Percentage of HTTP responses by code'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.CACHE_HIT_RATE]: {
    desc: t('Percentage of cache hits'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.CACHE_MISS_RATE]: {
    desc: t('Percentage of cache misses'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.COUNT_OP]: {
    desc: t('Count of spans with matching operation'),
    defaultOutputType: 'integer',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [SpanFunction.TRACE_STATUS_RATE]: {
    desc: t('Percentage of spans with matching trace status'),
    defaultOutputType: 'percentage',
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
};

// Search categorizations for the new `SearchQueryBuilder` component.
// Each Insights module page will have different points of interest for searching, so use these on a case-by-case basis

export const TRANSACTION_FILTER_FIELDS: FilterKeySection = {
  value: 'transaction_fields',
  label: 'Transaction',
  children: [
    FieldKey.TRANSACTION_DURATION,
    FieldKey.TRANSACTION_OP,
    FieldKey.TRANSACTION_STATUS,
  ],
};

export const USER_FILTER_FIELDS: FilterKeySection = {
  value: 'user_fields',
  label: 'User',
  children: [
    FieldKey.USER,
    FieldKey.USER_DISPLAY,
    FieldKey.USER_EMAIL,
    FieldKey.USER_ID,
    FieldKey.USER_IP,
    FieldKey.USER_USERNAME,
  ],
};

export const GEO_FILTER_FIELDS: FilterKeySection = {
  value: 'geo_fields',
  label: 'Geographical',
  children: [
    FieldKey.GEO_CITY,
    FieldKey.GEO_COUNTRY_CODE,
    FieldKey.GEO_REGION,
    FieldKey.GEO_SUBDIVISION,
  ],
};

export const HTTP_FILTER_FIELDS: FilterKeySection = {
  value: 'http_fields',
  label: 'HTTP',
  children: [
    FieldKey.HTTP_METHOD,
    FieldKey.HTTP_REFERER,
    FieldKey.HTTP_STATUS_CODE,
    FieldKey.HTTP_URL,
  ],
};

export const SPAN_OP_FILTER_FIELDS: FilterKeySection = {
  value: 'span_duration_fields',
  label: 'Span Duration',
  children: [
    SpanOpBreakdown.SPANS_BROWSER,
    SpanOpBreakdown.SPANS_DB,
    SpanOpBreakdown.SPANS_HTTP,
    SpanOpBreakdown.SPANS_RESOURCE,
    SpanOpBreakdown.SPANS_UI,
  ],
};

export const WEB_VITAL_FIELDS: FilterKeySection = {
  value: 'web_vital_fields',
  label: 'Web Vitals',
  children: [
    WebVital.CLS,
    WebVital.FCP,
    WebVital.FID,
    WebVital.FP,
    WebVital.INP,
    WebVital.LCP,
    WebVital.REQUEST_TIME,
  ],
};

export const MOBILE_VITAL_FIELDS: FilterKeySection = {
  value: 'mobile_vital_fields',
  label: 'Mobile Vitals',
  children: [
    MobileVital.APP_START_COLD,
    MobileVital.APP_START_WARM,
    MobileVital.FRAMES_FROZEN,
    MobileVital.FRAMES_FROZEN_RATE,
    MobileVital.FRAMES_SLOW,
    MobileVital.FRAMES_SLOW_RATE,
    MobileVital.FRAMES_TOTAL,
    MobileVital.STALL_COUNT,
    MobileVital.STALL_LONGEST_TIME,
    MobileVital.STALL_PERCENTAGE,
    MobileVital.STALL_TOTAL_TIME,
    MobileVital.TIME_TO_FULL_DISPLAY,
    MobileVital.TIME_TO_INITIAL_DISPLAY,
  ],
};

export const DEVICE_FIELDS: FilterKeySection = {
  value: 'device_fields',
  label: 'Device',
  children: [
    FieldKey.DEVICE_ARCH,
    FieldKey.DEVICE_BATTERY_LEVEL,
    FieldKey.DEVICE_BRAND,
    FieldKey.DEVICE_CHARGING,
    FieldKey.DEVICE_CLASS,
    FieldKey.DEVICE_FAMILY,
    FieldKey.DEVICE_LOCALE,
    // FieldKey.DEVICE_MODEL_ID,
    FieldKey.DEVICE_NAME,
    FieldKey.DEVICE_ONLINE,
    FieldKey.DEVICE_ORIENTATION,
    FieldKey.DEVICE_SCREEN_DENSITY,
    FieldKey.DEVICE_SCREEN_DPI,
    FieldKey.DEVICE_SCREEN_HEIGHT_PIXELS,
    FieldKey.DEVICE_SCREEN_WIDTH_PIXELS,
    FieldKey.DEVICE_SIMULATOR,
    FieldKey.DEVICE_UUID,
  ],
};

export const RELEASE_FIELDS: FilterKeySection = {
  value: 'release_fields',
  label: 'Release',
  children: [
    FieldKey.RELEASE,
    FieldKey.RELEASE_BUILD,
    FieldKey.RELEASE_PACKAGE,
    FieldKey.RELEASE_STAGE,
    FieldKey.RELEASE_VERSION,
  ],
};

export const MISC_FIELDS: FilterKeySection = {
  value: 'misc_fields',
  label: 'Misc',
  children: [FieldKey.HAS, FieldKey.DIST],
};

export const ALL_INSIGHTS_FILTER_KEY_SECTIONS: FilterKeySection[] = [
  TRANSACTION_FILTER_FIELDS,
  USER_FILTER_FIELDS,
  GEO_FILTER_FIELDS,
  HTTP_FILTER_FIELDS,
  SPAN_OP_FILTER_FIELDS,
  WEB_VITAL_FIELDS,
  // TODO: In the future, it would be ideal if we could be more 'smart' about which fields we expose here.
  // For example, these mobile vitals are not necessary for a Python transaction, but they should be suggested for mobile SDK transactions
  MOBILE_VITAL_FIELDS,
  DEVICE_FIELDS,
  RELEASE_FIELDS,
  MISC_FIELDS,
];

// TODO: In followup PR, add this
// export const PLATFORM_KEY_TO_FILTER_SECTIONS
// will take in a project platform key, and output only the relevant filter key sections.
// This way, users will not be suggested mobile fields for a backend transaction, for example.
