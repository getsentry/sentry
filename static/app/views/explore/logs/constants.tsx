import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {type OurLogFieldKey, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export const LogAttributesHumanLabel: Partial<Record<OurLogFieldKey, string>> = {
  [OurLogKnownFieldKey.TIMESTAMP]: t('Timestamp'),
  [OurLogKnownFieldKey.SEVERITY]: t('Severity'),
  [OurLogKnownFieldKey.MESSAGE]: t('Message'),
  [OurLogKnownFieldKey.TRACE_ID]: t('Trace'),
};

export const LOG_INGEST_DELAY = 10_000;

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
] as const;

const AlwaysHiddenLogFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.ORGANIZATION_ID,
  OurLogKnownFieldKey.ITEM_TYPE,
  OurLogKnownFieldKey.PROJECT,
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

export const HiddenColumnEditorLogFields: OurLogFieldKey[] = [...AlwaysHiddenLogFields];

const LOGS_FILTERS: FilterKeySection = {
  value: 'logs_filters',
  label: t('Logs'),
  children: [...SENTRY_LOG_STRING_TAGS, ...SENTRY_LOG_NUMBER_TAGS],
};

export const LOGS_INSTRUCTIONS_URL =
  'https://docs.sentry.io/product/explore/logs/getting-started/';

export const LOGS_FILTER_KEY_SECTIONS: FilterKeySection[] = [LOGS_FILTERS];

export const VIRTUAL_STREAMED_INTERVAL_MS = 333;

export const LOGS_GRID_SCROLL_MIN_ITEM_THRESHOLD = 100; // Items from bottom of table to trigger table fetch.
