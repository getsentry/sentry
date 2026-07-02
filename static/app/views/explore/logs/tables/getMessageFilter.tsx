import {defined} from 'sentry/utils/defined';
import {OurLogKnownFieldKey, type OurLogFieldKey} from 'sentry/views/explore/logs/types';

export interface MessageFilter {
  key: string;
  value: string | number | boolean;
}

export function getMessageFilter(
  field: string,
  // A selected-but-absent attribute (e.g. a template-less log's message.template)
  // comes back as null from the EAP response.
  dataRow: Record<OurLogFieldKey, string | number | null>,
  cellValue: string | number | boolean
): MessageFilter {
  if (field === OurLogKnownFieldKey.MESSAGE) {
    const template = dataRow[OurLogKnownFieldKey.TEMPLATE];
    // A template-less log returns `message.template` as null; filtering on it would
    // produce a nonsensical `message.template:null`, so fall back to the message value.
    if (defined(template)) {
      return {key: OurLogKnownFieldKey.TEMPLATE, value: template};
    }
  }

  return {key: field, value: cellValue};
}
