import type {SelectValue} from 'sentry/types/core';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

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

export const ISSUE_WIDGET_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.TRENDS,
  IssueSortOptions.USER,
];

export function generateIssueWidgetOrderOptions(): Array<SelectValue<string>> {
  const sortOptions = [...ISSUE_WIDGET_SORT_OPTIONS];
  return sortOptions.map(sortOption => ({
    label: getSortLabel(sortOption),
    value: sortOption,
  }));
}
