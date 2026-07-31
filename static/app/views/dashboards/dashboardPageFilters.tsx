import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/dashboards/data';
import {ALL_DASHBOARD_DATA_CATEGORIES} from 'sentry/views/dashboards/hooks/useDashboardMaxPickableDays';

interface DashboardPageFiltersProps {
  children: React.ReactNode;
  skipLoadLastUsed?: boolean;
}

export function DashboardPageFilters({
  children,
  skipLoadLastUsed,
}: DashboardPageFiltersProps) {
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
