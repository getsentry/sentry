import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {DisplayType} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import type {ColumnType} from './fields';
import {ISSUE_AGGREGATIONS, ISSUE_SERIES_FIELDS, ISSUE_TABLE_FIELDS} from './fields';

export function generateIssueWidgetFieldOptions(
  organization: Organization,
  displayType: DisplayType = DisplayType.TABLE
): Record<string, SelectValue<FieldValue>> {
  const issueFields: Record<string, ColumnType> = isChartDisplayType(displayType)
    ? ISSUE_SERIES_FIELDS
    : ISSUE_TABLE_FIELDS;
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

  let aggregateOptions: Record<string, SelectValue<FieldValue>> = {};
  if (displayType !== DisplayType.TABLE) {
    aggregateOptions = generateFieldOptions({
      organization,
      tagKeys: [],
      fieldKeys: [],
      aggregations: ISSUE_AGGREGATIONS,
    });
  }

  return {...fieldOptions, ...aggregateOptions};
}
