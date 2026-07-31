import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/dashboards/data';
import {useDashboardMaxPickableDays} from 'sentry/views/dashboards/hooks/useDashboardMaxPickableDays';
import type {Widget} from 'sentry/views/dashboards/types';

interface DashboardPageFiltersProps {
  children: React.ReactNode;
  widgets: Widget[];
  skipLoadLastUsed?: boolean;
}

export function DashboardPageFilters({
  children,
  widgets,
  skipLoadLastUsed,
}: DashboardPageFiltersProps) {
  const {maxPickableDays, maxDateRange} = useDashboardMaxPickableDays(widgets);

  return (
    <PageFiltersContainer
      disablePersistence
      skipLoadLastUsed={skipLoadLastUsed}
      maxPickableDays={maxPickableDays}
      maxDateRange={maxDateRange}
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
