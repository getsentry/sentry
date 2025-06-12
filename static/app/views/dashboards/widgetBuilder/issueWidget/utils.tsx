import type {SelectValue} from 'sentry/types/core';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {ColumnType} from './fields';
import {ISSUE_FIELDS} from './fields';

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
          dataType: issueFields[field]!,
        },
      },
    };
  });

  return fieldOptions;
}
