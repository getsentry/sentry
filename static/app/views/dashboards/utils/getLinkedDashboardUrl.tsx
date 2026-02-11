import type {LocationDescriptor} from 'history';
import pick from 'lodash/pick';
import qs from 'query-string';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {FieldKind} from 'sentry/utils/fields';
import type {
  DashboardFilters,
  GlobalFilter,
  LinkedDashboard,
  WidgetQuery,
} from 'sentry/views/dashboards/types';
import {DashboardFilterKeys, WidgetType} from 'sentry/views/dashboards/types';

interface GetLinkedDashboardUrlOptions {
  field: string;
  linkedDashboard: LinkedDashboard;
  organizationSlug: string;
  value: string;
  dashboardFilters?: DashboardFilters;
  locationQuery?: Record<string, any>;
  projectIdOverride?: string | number;
  widgetType?: WidgetType;
}

/**
 * Given a linked dashboard and a table field and the associated value,
 * builds a URL to a linked dashboard, applying a temporary global filter for the clicked field value.
 * Preserves existing global filters and page filter params (project, environment, time range).
 */
export function getLinkedDashboardUrl({
  linkedDashboard,
  organizationSlug,
  field,
  value,
  widgetType = WidgetType.SPANS,
  dashboardFilters,
  locationQuery,
  projectIdOverride,
}: GetLinkedDashboardUrlOptions): LocationDescriptor | undefined {
  // Skip if no valid dashboard ID (dashboardId '-1' is used for prebuilt dashboard placeholders)
  if (!linkedDashboard.dashboardId || linkedDashboard.dashboardId === '-1') {
    return undefined;
  }

  const datasetsToApplyFiltersTo = [
    widgetType,
    ...(linkedDashboard.additionalGlobalFilterDatasetTargets ?? []),
  ];

  // Preserve existing global filters, excluding any for the field being clicked
  // to avoid duplicates
  const existingFilters = dashboardFilters?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [];
  const newTemporaryFilters: GlobalFilter[] = existingFilters.filter(
    filter =>
      Boolean(filter.value) &&
      !(filter.tag.key === field && datasetsToApplyFiltersTo.includes(filter.dataset))
  );

  // Format the value as a proper filter condition string (bracket syntax e.g. field:[value])
  const formattedValue = new MutableSearch('')
    .addFilterValueList(field, [value])
    .toString();

  // Add temporary filters for each dataset
  datasetsToApplyFiltersTo.forEach(dataset => {
    newTemporaryFilters.push({
      dataset,
      tag: {key: field, name: field, kind: FieldKind.TAG},
      value: formattedValue,
      isTemporary: true,
    });
  });

  // Preserve project, environment, and time range query params
  const filterParams: Record<string, any> = locationQuery
    ? pick(locationQuery, [
        'release',
        'environment',
        'project',
        'statsPeriod',
        'start',
        'end',
      ])
    : {};

  // Override project if provided (e.g., from table row data)
  if (projectIdOverride) {
    filterParams.project = projectIdOverride;
  }

  const url = `/organizations/${organizationSlug}/dashboard/${linkedDashboard.dashboardId}/?${qs.stringify(
    {
      [DashboardFilterKeys.GLOBAL_FILTER]: newTemporaryFilters.map(filter =>
        JSON.stringify(filter)
      ),
      ...filterParams,
    }
  )}`;

  return url;
}

export function findLinkedDashboardForField(
  query: WidgetQuery | undefined,
  field: string | undefined
): LinkedDashboard | undefined {
  if (!query || !field) {
    return undefined;
  }

  return query.linkedDashboards?.find(ld => ld.field === field);
}
