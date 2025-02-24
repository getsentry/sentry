import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import {type OurLogFieldKey, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

function defaultLogFields(): OurLogKnownFieldKey[] {
  return [
    OurLogKnownFieldKey.SEVERITY_TEXT,
    OurLogKnownFieldKey.SEVERITY_NUMBER,
    OurLogKnownFieldKey.BODY,
    OurLogKnownFieldKey.TIMESTAMP,
  ];
}

export function getLogFieldsFromLocation(location: Location): OurLogFieldKey[] {
  const fields = decodeList(location.query.field) as OurLogFieldKey[];

  if (fields.length) {
    return fields;
  }

  return defaultLogFields();
}
