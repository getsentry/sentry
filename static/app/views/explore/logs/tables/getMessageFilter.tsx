import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

export interface MessageFilter {
  key: string;
  value: string | number | boolean;
}

export function getMessageFilter(
  field: string,
  dataRow: OurLogsResponseItem,
  cellValue: string | number | boolean
): MessageFilter {
  if (field === OurLogKnownFieldKey.MESSAGE) {
    const template = dataRow[OurLogKnownFieldKey.TEMPLATE];
    if (template !== undefined) {
      return {key: OurLogKnownFieldKey.TEMPLATE, value: template};
    }
  }

  return {key: field, value: cellValue};
}
