import {useMemo} from 'react';

import {DataCategory} from 'sentry/types/core';
import {
  useMaxPickableDays,
  type MaxPickableDaysOptions,
} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';

/**
 * Maps widget types to data categories for determining max pickable days
 */
function getDataCategoriesFromWidgets(
  widgets: Widget[]
): [DataCategory, ...DataCategory[]] {
  const categories = new Set<DataCategory>();

  for (const widget of widgets) {
    const widgetType = widget.widgetType ?? WidgetType.ERRORS;

    switch (widgetType) {
      case WidgetType.SPANS:
        categories.add(DataCategory.SPANS);
        break;
      case WidgetType.TRANSACTIONS:
        categories.add(DataCategory.TRANSACTIONS);
        break;
      case WidgetType.TRACEMETRICS:
        categories.add(DataCategory.TRACE_METRICS);
        break;
      case WidgetType.LOGS:
        categories.add(DataCategory.LOG_ITEM);
        break;
      case WidgetType.ERRORS:
      case WidgetType.ISSUE:
      case WidgetType.RELEASE:
      case WidgetType.METRICS:
      default:
        // For error-like widgets, use TRANSACTIONS as a safe default
        // since it has the most permissive date range
        categories.add(DataCategory.TRANSACTIONS);
        break;
    }
  }

  // Return as tuple with at least one element (required by useMaxPickableDays)
  const categoriesArray = Array.from(categories);
  return categoriesArray.length > 0
    ? (categoriesArray as [DataCategory, ...DataCategory[]])
    : [DataCategory.TRANSACTIONS];
}

// Trace metrics are capped at 30 days. Selected organizations can query their
// downsampled retention on dashboards, but only back 90 days, because downsampled
// retention for trace metrics may be removed.
const TRACE_METRICS_EXTENDED_MAX_PICKABLE_DAYS = 90;

export function useDashboardMaxPickableDaysForDataCategories(
  dataCategories: readonly [DataCategory, ...DataCategory[]]
): MaxPickableDaysOptions {
  const organization = useOrganization();
  const maxPickableDaysOptions = useMaxPickableDays({dataCategories});

  const hasExtendedTraceMetricsRange =
    organization.features.includes('dashboards-tracemetrics-90-day-range') &&
    dataCategories.includes(DataCategory.TRACE_METRICS);

  return useMemo(() => {
    if (
      !hasExtendedTraceMetricsRange ||
      maxPickableDaysOptions.maxPickableDays >= TRACE_METRICS_EXTENDED_MAX_PICKABLE_DAYS
    ) {
      return maxPickableDaysOptions;
    }

    return {
      ...maxPickableDaysOptions,
      maxPickableDays: TRACE_METRICS_EXTENDED_MAX_PICKABLE_DAYS,
      maxUpgradableDays: Math.max(
        maxPickableDaysOptions.maxUpgradableDays,
        TRACE_METRICS_EXTENDED_MAX_PICKABLE_DAYS
      ),
    };
  }, [hasExtendedTraceMetricsRange, maxPickableDaysOptions]);
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

  return useDashboardMaxPickableDaysForDataCategories(dataCategories);
}
