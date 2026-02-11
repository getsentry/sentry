import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

/**
 * These are the default fields that are shown in the logs table (aside from static columns like severity). The query will always add other hidden fields required to render details view etc.
 */
export function defaultLogFields(): OurLogKnownFieldKey[] {
  return [OurLogKnownFieldKey.TIMESTAMP, OurLogKnownFieldKey.MESSAGE];
}
