import {useMemo} from 'react';

import {DataCategory} from 'sentry/types/core';
import {
  useMaxPickableDays,
  type MaxPickableDaysOptions,
} from 'sentry/utils/useMaxPickableDays';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';

/**
 * Maps widget types to data categories for determining max pickable days
 */
function getDataCategoryFromWidgetType(widgetType: WidgetType): DataCategory {
  switch (widgetType) {
    case WidgetType.SPANS:
      return DataCategory.SPANS;
    case WidgetType.TRANSACTIONS:
      return DataCategory.TRANSACTIONS;
    case WidgetType.TRACEMETRICS:
      return DataCategory.TRACE_METRICS;
    case WidgetType.LOGS:
      return DataCategory.LOG_ITEM;
    case WidgetType.ERRORS:
    case WidgetType.DISCOVER:
    case WidgetType.ISSUE:
    case WidgetType.RELEASE:
    case WidgetType.METRICS:
    default:
      // For error-like widgets, use TRANSACTIONS as a safe default
      // since it has the most permissive date range
      return DataCategory.TRANSACTIONS;
  }
}

function toDataCategoryTuple(
  categories: Iterable<DataCategory>
): [DataCategory, ...DataCategory[]] {
  // Return as tuple with at least one element (required by useMaxPickableDays)
  const categoriesArray = Array.from(new Set(categories));
  return categoriesArray.length > 0
    ? (categoriesArray as [DataCategory, ...DataCategory[]])
    : [DataCategory.TRANSACTIONS];
}

/**
 * Every data category a dashboard widget can query, so the ceiling covers any
 * widget the dashboard could hold rather than the ones it holds right now.
 */
export const ALL_DASHBOARD_DATA_CATEGORIES = toDataCategoryTuple(
  Object.values(WidgetType).map(getDataCategoryFromWidgetType)
);

function getDataCategoriesFromWidgets(
  widgets: Widget[]
): [DataCategory, ...DataCategory[]] {
  return toDataCategoryTuple(
    widgets.map(widget =>
      getDataCategoryFromWidgetType(widget.widgetType ?? WidgetType.DISCOVER)
    )
  );
}

export function useDashboardMaxPickableDays(
  widgets: Widget[] | undefined
): MaxPickableDaysOptions {
  const dataCategories = useMemo(() => {
    if (!widgets || widgets.length === 0) {
      // Default to TRANSACTIONS if no widgets
      return [DataCategory.TRANSACTIONS] as [DataCategory, ...DataCategory[]];
    }

    return getDataCategoriesFromWidgets(widgets);
  }, [widgets]);

  return useMaxPickableDays({dataCategories});
}
