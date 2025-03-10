import {t} from 'sentry/locale';
import {type OurLogFieldKey, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export const LogAttributesHumanLabel: Record<OurLogFieldKey, string> = {
  [OurLogKnownFieldKey.TIMESTAMP]: t('Timestamp'),
  [OurLogKnownFieldKey.SEVERITY_TEXT]: t('Severity'),
  [OurLogKnownFieldKey.BODY]: t('Message'),
};

/**
 * These are required fields are always added to the query when fetching the log table.
 */
export const AlwaysPresentLogFields: OurLogFieldKey[] = [
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.PROJECT_ID,
  OurLogKnownFieldKey.SEVERITY_NUMBER,
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
