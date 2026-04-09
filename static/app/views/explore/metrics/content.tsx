import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreBreadcrumb} from 'sentry/views/explore/components/breadcrumb';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MetricsTabOnboarding} from 'sentry/views/explore/metrics/metricsOnboarding';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {
  getIdFromLocation,
  getTitleFromLocation,
  ID_KEY,
  TITLE_KEY,
} from 'sentry/views/explore/queryParams/savedQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const METRICS_TITLE = t('Application Metrics');

export default function MetricsContent() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject({property: 'hasTraceMetrics'});
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.TRACE_METRICS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);
  return (
    <SentryDocumentTitle title={METRICS_TITLE} orgSlug={organization?.slug}>
      <PageFiltersContainer
        maxPickableDays={datePageFilterProps.maxPickableDays}
        defaultSelection={
          datePageFilterProps.defaultPeriod
            ? {
                datetime: {
                  period: datePageFilterProps.defaultPeriod,
                  start: null,
                  end: null,
                  utc: null,
                },
              }
            : undefined
        }
      >
        <AnalyticsArea name="explore.metrics">
          <Stack flex={1}>
            <MetricsHeader />
            {defined(onboardingProject) ? (
              <MetricsTabOnboarding
                organization={organization}
                project={onboardingProject}
                datePageFilterProps={datePageFilterProps}
              />
            ) : (
              <MetricsTabContent datePageFilterProps={datePageFilterProps} />
            )}
          </Stack>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const metricsFeedbackOptions = {
  messagePlaceholder: t('How can we make metrics work better for you?'),
  tags: {
    ['feedback.source']: 'metrics-listing',
    ['feedback.owner']: 'performance',
  },
};

function MetricsHeader() {
  const location = useLocation();
  const pageId = getIdFromLocation(location, ID_KEY);
  const title = getTitleFromLocation(location, TITLE_KEY);
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(pageId);
  const hasPageFrameFeature = useHasPageFrameFeature();

  const hasSavedQueryTitle =
    defined(pageId) && defined(savedQuery) && savedQuery.name.length > 0;

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {hasSavedQueryTitle ? (
          <SentryDocumentTitle
            title={`${savedQuery.name} — ${METRICS_TITLE}`}
            orgSlug={organization?.slug}
          />
        ) : null}
        {title && defined(pageId) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.TRACEMETRICS} />
        ) : null}
        <Layout.Title>
          {title ? title : METRICS_TITLE}
          <FeatureBadge type="beta" />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        {hasPageFrameFeature ? (
          <TopBar.Slot name="feedback">
            <FeedbackButton feedbackOptions={metricsFeedbackOptions}>
              {null}
            </FeedbackButton>
          </TopBar.Slot>
        ) : (
          <FeedbackButton feedbackOptions={metricsFeedbackOptions} />
        )}
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
