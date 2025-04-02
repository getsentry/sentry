import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {type OurLogFieldKey, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export const LogAttributesHumanLabel: Partial<Record<OurLogFieldKey, string>> = {
  [OurLogKnownFieldKey.TIMESTAMP]: t('Timestamp'),
  [OurLogKnownFieldKey.SEVERITY_TEXT]: t('Severity'),
  [OurLogKnownFieldKey.BODY]: t('Message'),
  [OurLogKnownFieldKey.TRACE_ID]: t('Trace'),
};

/**
 * These are required fields are always added to the query when fetching the log table.
 */
export const AlwaysPresentLogFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.PROJECT_ID,
  OurLogKnownFieldKey.TRACE_ID,
  OurLogKnownFieldKey.SEVERITY_NUMBER,
  OurLogKnownFieldKey.SEVERITY_TEXT,
];

/**
 * These are fields that should be hidden in log details view when receiving all data from the API.
 */
export const HiddenLogDetailFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.BODY,
  OurLogKnownFieldKey.ORGANIZATION_ID,
  OurLogKnownFieldKey.ITEM_TYPE,
];

const LOGS_FILTERS: FilterKeySection = {
  value: 'logs_filters',
  label: t('Logs'),
  children: [...SENTRY_LOG_STRING_TAGS, ...SENTRY_LOG_NUMBER_TAGS],
};

export const LOGS_FILTER_KEY_SECTIONS: FilterKeySection[] = [LOGS_FILTERS];
