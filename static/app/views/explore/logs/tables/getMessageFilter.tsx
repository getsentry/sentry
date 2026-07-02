import {defined} from 'sentry/utils/defined';
import {OurLogKnownFieldKey, type OurLogFieldKey} from 'sentry/views/explore/logs/types';

export interface MessageFilter {
  key: string;
  value: string | number | boolean;
}

export function getMessageFilter(
  field: string,
  dataRow: Record<OurLogFieldKey, string | number | null>,
  cellValue: string | number | boolean
): MessageFilter {
  if (field === OurLogKnownFieldKey.MESSAGE) {
    const template = dataRow[OurLogKnownFieldKey.TEMPLATE];
    if (defined(template)) {
      return {key: OurLogKnownFieldKey.TEMPLATE, value: template};
    }
  }

  return {key: field, value: cellValue};
}
