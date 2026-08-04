import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/dashboards/data';

const ALL_DASHBOARD_DATA_CATEGORIES = [
  DataCategory.SPANS,
  DataCategory.TRANSACTIONS,
  DataCategory.ERRORS,
  DataCategory.LOG_ITEM,
  DataCategory.TRACE_METRICS,
] as const;

interface DashboardPageFiltersProps {
  children: React.ReactNode;
  skipLoadLastUsed?: boolean;
}

export function DashboardPageFilters({
  children,
  skipLoadLastUsed,
}: DashboardPageFiltersProps) {
  // This ceiling is derived from all dashboard data categories, not the current
  // widgets, so it's always at least as high as the date picker's own limit (which
  // `FiltersBar` derives per dashboard via `useDashboardMaxPickableDays`). A
  // widget-derived ceiling here would move as the dashboard's contents change and
  // reset a selection the picker had already allowed.
  const {maxPickableDays} = useMaxPickableDays({
    dataCategories: ALL_DASHBOARD_DATA_CATEGORIES,
  });

  return (
    <PageFiltersContainer
      disablePersistence
      skipLoadLastUsed={skipLoadLastUsed}
      maxPickableDays={maxPickableDays}
      defaultSelection={{
        datetime: {
          start: null,
          end: null,
          utc: false,
          period: DEFAULT_STATS_PERIOD,
        },
      }}
    >
      {children}
    </PageFiltersContainer>
  );
}
