import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import {LOGS_FIELDS_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {type OurLogFieldKey, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

/**
 * These are the default fields that are shown in the logs table. The query will always add other hidden fields required to render details view etc.
 */
export function defaultLogFields(): OurLogKnownFieldKey[] {
  return [
    OurLogKnownFieldKey.SEVERITY_TEXT,
    OurLogKnownFieldKey.BODY,
    OurLogKnownFieldKey.TIMESTAMP,
  ];
}

export function getLogFieldsFromLocation(location: Location): OurLogFieldKey[] {
  const fields = decodeList(location.query[LOGS_FIELDS_KEY]) as OurLogFieldKey[];

  if (fields.length) {
    return fields;
  }

  return defaultLogFields();
}
