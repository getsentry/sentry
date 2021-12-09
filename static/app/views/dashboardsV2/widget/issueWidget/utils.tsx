import {SelectValue} from 'sentry/types';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {ColumnType, ISSUE_FIELDS} from './fields';

export function generateIssueWidgetFieldOptions(
  issueFields: Record<string, ColumnType> = ISSUE_FIELDS
) {
  const fieldKeys = Object.keys(issueFields).sort();
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  fieldKeys.forEach(field => {
    fieldOptions[`field:${field}`] = {
      label: field,
      value: {
        kind: FieldValueKind.FIELD,
        meta: {
          name: field,
          dataType: issueFields[field],
        },
      },
    };
  });

  return fieldOptions;
}
