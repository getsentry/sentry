import {useEffect} from 'react';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {CachesWidget} from 'sentry/views/insights/pages/platform/laravel/cachesWidget';
import {JobsWidget} from 'sentry/views/insights/pages/platform/laravel/jobsWidget';
import {QueriesWidget} from 'sentry/views/insights/pages/platform/laravel/queriesWidget';
import {DurationWidget} from 'sentry/views/insights/pages/platform/shared/durationWidget';
import {IssuesWidget} from 'sentry/views/insights/pages/platform/shared/issuesWidget';
import {PlatformLandingPageLayout} from 'sentry/views/insights/pages/platform/shared/layout';
import {PathsTable} from 'sentry/views/insights/pages/platform/shared/pathsTable';
import {WidgetGrid} from 'sentry/views/insights/pages/platform/shared/styles';
import {TrafficWidget} from 'sentry/views/insights/pages/platform/shared/trafficWidget';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

export function LaravelOverviewPage() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  useEffect(() => {
    trackAnalytics('laravel-insights.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {query, setTransactionFilter} = useTransactionNameQuery();

  return (
    <PlatformLandingPageLayout performanceType={'backend'}>
      <WidgetGrid>
        <WidgetGrid.Position1>
          <TrafficWidget
            title={t('Requests')}
            trafficSeriesName={t('Requests')}
            baseQuery={'span.op:http.server'}
            query={query}
            releases={releases}
          />
        </WidgetGrid.Position1>
        <WidgetGrid.Position2>
          <DurationWidget query={query} releases={releases} />
        </WidgetGrid.Position2>
        <WidgetGrid.Position3>
          <IssuesWidget query={query} />
        </WidgetGrid.Position3>
        <WidgetGrid.Position4>
          <JobsWidget query={query} releases={releases} />
        </WidgetGrid.Position4>
        <WidgetGrid.Position5>
          <QueriesWidget query={query} releases={releases} />
        </WidgetGrid.Position5>
        <WidgetGrid.Position6>
          <CachesWidget query={query} releases={releases} />
        </WidgetGrid.Position6>
      </WidgetGrid>
      <PathsTable handleAddTransactionFilter={setTransactionFilter} query={query} />
    </PlatformLandingPageLayout>
  );
}
