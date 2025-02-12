import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export function defaultFields(): string[] {
  return [
    'id',
    'span.op',
    'span.description',
    'span.duration',
    'transaction',
    'timestamp',
  ];
}

export function getFieldsFromLocation(
  location: Location,
  locationDefaultFields: () => string[] = defaultFields
): string[] {
  const fields = decodeList(location.query.field);

  if (fields.length) {
    return fields;
  }

  return locationDefaultFields();
}

export function updateLocationWithFields(
  location: Location,
  fields: string[] | undefined | null
) {
  if (defined(fields)) {
    location.query.field = fields;
  } else if (fields === null) {
    delete location.query.field;
  }
}
