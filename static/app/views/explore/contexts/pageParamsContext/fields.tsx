import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';
import {SpanFields} from 'sentry/views/insights/types';

export function defaultFields(organization?: Organization): string[] {
  if (organization?.features.includes('performance-otel-friendly-ui')) {
    return [
      SpanFields.ID,
      SpanFields.NAME,
      SpanFields.SPAN_DURATION,
      SpanFields.TIMESTAMP,
    ];
  }

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
  organization?: Organization
): string[] {
  const fields = decodeList(location.query.field);

  if (fields.length) {
    return fields;
  }

  return defaultFields(organization);
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

export function isDefaultFields(location: Location): boolean {
  return decodeList(location.query.field).length === 0;
}
