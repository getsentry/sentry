import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import OverviewApiLatencyChartWidget from 'sentry/views/insights/common/components/widgets/overviewApiLatencyChartWidget';
import OverviewRequestsChartWidget from 'sentry/views/insights/common/components/widgets/overviewRequestsChartWidget';
import {CachesWidget} from 'sentry/views/insights/pages/platform/laravel/cachesWidget';
import {JobsWidget} from 'sentry/views/insights/pages/platform/laravel/jobsWidget';
import {QueriesWidget} from 'sentry/views/insights/pages/platform/laravel/queriesWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {PathsTable} from 'sentry/views/insights/pages/platform/shared/pathsTable';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';

export function LaravelOverviewPage() {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('laravel-insights.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PlatformLandingPageLayout performanceType={'backend'}>
      <WidgetGrid>
        <WidgetGrid.Position1>
          <OverviewRequestsChartWidget />
        </WidgetGrid.Position1>
        <WidgetGrid.Position2>
          <OverviewApiLatencyChartWidget />
        </WidgetGrid.Position2>
        <WidgetGrid.Position3>
          <IssuesWidget />
        </WidgetGrid.Position3>
        <WidgetGrid.Position4>
          <JobsWidget />
        </WidgetGrid.Position4>
        <WidgetGrid.Position5>
          <QueriesWidget />
        </WidgetGrid.Position5>
        <WidgetGrid.Position6>
          <CachesWidget />
        </WidgetGrid.Position6>
      </WidgetGrid>
      <PathsTable />
    </PlatformLandingPageLayout>
  );
}
