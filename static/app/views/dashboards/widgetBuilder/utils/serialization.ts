import {
  explodeField,
  generateFieldAsString,
  type Column,
  type Sort,
} from 'sentry/utils/discover/fields';
import {WidgetType, type LinkedDashboard} from 'sentry/views/dashboards/types';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';

/**
 * Takes fields in the field and function format and coverts
 * them into a list of strings compatible with query params
 */
export function serializeFields(fields: Column[]): string[] {
  return fields.map(field => {
    if (field.alias) {
      return JSON.stringify({
        field: generateFieldAsString(field),
        alias: field.alias,
      });
    }
    return generateFieldAsString(field);
  });
}

export function serializeLinkedDashboards(
  linkedDashboards: LinkedDashboard[] = []
): string[] {
  return linkedDashboards.map(linkedDashboard => {
    return JSON.stringify({
      dashboardId: linkedDashboard.dashboardId,
      field: linkedDashboard.field,
    } satisfies LinkedDashboard);
  });
}

export function serializeSorts(dataset?: WidgetType) {
  return function (sorts: Sort[]): string[] {
    return sorts.map(sort => {
      const field = normalizeSortField(sort.field);
      // All issue fields do not use '-' regardless of order
      if (dataset === WidgetType.ISSUE) {
        return field;
      }
      const direction = sort.kind === 'desc' ? '-' : '';
      return `${direction}${field}`;
    });
  };
}

export function normalizeSortField(field: string): string {
  const parsedField = explodeField({field});
  return parsedField.kind === 'function' ? generateFieldAsString(parsedField) : field;
}

export function serializeThresholds(thresholds: ThresholdsConfig | null): string {
  return JSON.stringify(thresholds);
}
