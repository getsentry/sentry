import {SelectValue} from 'sentry/types';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

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

const ISSUE_WIDGET_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.PRIORITY,
  IssueSortOptions.USER,
];

export function generateIssueWidgetOrderOptions(
  includeRelativeChange: boolean
): SelectValue<string>[] {
  const sortOptions = [...ISSUE_WIDGET_SORT_OPTIONS];
  if (includeRelativeChange) {
    sortOptions.push(IssueSortOptions.TREND);
  }
  return sortOptions.map(sortOption => ({
    label: getSortLabel(sortOption),
    value: sortOption,
  }));
}
