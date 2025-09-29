import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {MetricsPageDataProvider} from 'sentry/views/explore/contexts/metrics/metricsPageData';
import {MetricsPageParamsProvider} from 'sentry/views/explore/contexts/metrics/metricsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParamsProvider';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTabContent';
import {metricsPickableDays} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

interface MetricsTabProps extends PickableDays {
  organization?: any;
  project?: any;
}

function MetricsTabOnboarding(props: MetricsTabProps) {
  // TODO: Implement onboarding for metrics
  return <MetricsTabContent {...props} />;
}

function MetricsHeader() {
  const pageId = useQueryParamsId();
  const title = useQueryParamsTitle();
  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {title && defined(pageId) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.TRACEMETRICS} />
        ) : null}

        <Layout.Title>{title ? title : t('Metrics')}</Layout.Title>
      </Layout.HeaderContent>
    </Layout.Header>
  );
}

export default function MetricsContent() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} = metricsPickableDays();

  const onboardingProject = useOnboardingProject({property: 'hasLogs'});

  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        maxPickableDays={maxPickableDays}
        defaultSelection={{
          datetime: {
            period: defaultPeriod,
            start: null,
            end: null,
            utc: null,
          },
        }}
      >
        <MetricsQueryParamsProvider source="location">
          <MetricsPageParamsProvider
            value={{analyticsPageSource: LogsAnalyticsPageSource.EXPLORE_METRICS}}
          >
            <Layout.Page>
              <MetricsHeader />
              <TraceItemAttributeProvider
                traceItemType={TraceItemDataset.TRACEMETRICS}
                enabled
              >
                <MetricsPageDataProvider>
                  {defined(onboardingProject) ? (
                    <MetricsTabOnboarding
                      organization={organization}
                      project={onboardingProject}
                      defaultPeriod={defaultPeriod}
                      maxPickableDays={maxPickableDays}
                      relativeOptions={relativeOptions}
                    />
                  ) : (
                    <MetricsTabContent
                      defaultPeriod={defaultPeriod}
                      maxPickableDays={maxPickableDays}
                      relativeOptions={relativeOptions}
                    />
                  )}
                </MetricsPageDataProvider>
              </TraceItemAttributeProvider>
            </Layout.Page>
          </MetricsPageParamsProvider>
        </MetricsQueryParamsProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
