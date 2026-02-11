import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {OurLogKnownFieldKey, type OurLogFieldKey} from 'sentry/views/explore/logs/types';

export const LogAttributesHumanLabel: Partial<Record<OurLogFieldKey, string>> = {
  [OurLogKnownFieldKey.TIMESTAMP]: t('Timestamp'),
  [OurLogKnownFieldKey.SEVERITY]: t('Severity'),
  [OurLogKnownFieldKey.MESSAGE]: t('Message'),
  [OurLogKnownFieldKey.TRACE_ID]: t('Trace'),
};

export const MAX_LOG_INGEST_DELAY = 40_000;
export const QUERY_PAGE_LIMIT = 1000; // If this does not equal the limit with auto-refresh, the query keys will diverge and they will have separate caches. We may want to make this change in the future.
export const QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH = 1000;
export const LOG_ATTRIBUTE_LAZY_LOAD_HOVER_TIMEOUT = 150;
export const DEFAULT_TRACE_ITEM_HOVER_TIMEOUT = 150;
export const DEFAULT_TRACE_ITEM_HOVER_TIMEOUT_WITH_AUTO_REFRESH = 400; // With autorefresh on, a stationary mouse can prefetch multiple rows since virtual time moves rows constantly.
export const MAX_LOGS_INFINITE_QUERY_PAGES = 30; // This number * the refresh interval must be more seconds than 2 * the smallest time interval in the chart for streaming to work.

/**
 * These are required fields are always added to the query when fetching the log table.
 */
export const AlwaysPresentLogFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.PROJECT_ID,
  OurLogKnownFieldKey.TRACE_ID,
  OurLogKnownFieldKey.SEVERITY_NUMBER,
  OurLogKnownFieldKey.SEVERITY,
  OurLogKnownFieldKey.TIMESTAMP,
  OurLogKnownFieldKey.TIMESTAMP_PRECISE,
  OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE,
  OurLogKnownFieldKey.TEMPLATE,
] as const;

const AlwaysHiddenLogFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.ORGANIZATION_ID,
  OurLogKnownFieldKey.SEVERITY_NUMBER,
  OurLogKnownFieldKey.ITEM_TYPE,
  OurLogKnownFieldKey.TIMESTAMP_PRECISE,
  'project.id',
  'project_id', // these are both aliases that might show up
];

/**
 * These are fields that should be hidden in log details view when receiving all data from the API.
 */
export const HiddenLogDetailFields: OurLogFieldKey[] = [
  ...AlwaysHiddenLogFields,
  OurLogKnownFieldKey.MESSAGE,

  // deprecated/otel fields that clutter the UI
  'sentry.timestamp_nanos',
  'sentry.observed_timestamp_nanos',
  'tags[sentry.trace_flags,number]',
  'span_id',
];

export const DeprecatedLogDetailFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.TIMESTAMP_NANOS,
];

export const HiddenColumnEditorLogFields: OurLogFieldKey[] = [...AlwaysHiddenLogFields];

export const HiddenLogSearchFields: string[] = [...AlwaysHiddenLogFields];

const LOGS_FILTERS: FilterKeySection = {
  value: 'logs_filters',
  label: t('Logs'),
  children: [...SENTRY_LOG_STRING_TAGS, ...SENTRY_LOG_NUMBER_TAGS],
};

export const LOGS_INSTRUCTIONS_URL =
  'https://docs.sentry.io/product/explore/logs/getting-started/';

export const LOGS_FILTER_KEY_SECTIONS: FilterKeySection[] = [LOGS_FILTERS];

/**
 * Query parameter key for controlling the logs drawer state.
 * When this parameter is set to 'true', the logs drawer should open automatically.
 */
export const LOGS_DRAWER_QUERY_PARAM = 'logsDrawer';

export const VIRTUAL_STREAMED_INTERVAL_MS = 250;
export const MINIMUM_INFINITE_SCROLL_FETCH_COOLDOWN_MS = 1000;

export const LOGS_GRID_SCROLL_MIN_ITEM_THRESHOLD = 50; // Items from bottom of table to trigger table fetch.

export const QUANTIZE_MINUTES = 120;
