import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreBreadcrumb} from 'sentry/views/explore/components/breadcrumb';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {canUseMetricsEquations} from 'sentry/views/explore/metrics/metricsFlags';
import {MetricsTabOnboarding} from 'sentry/views/explore/metrics/metricsOnboarding';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
import {
  MAX_METRICS_ALLOWED,
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
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
  const hasEquations = canUseMetricsEquations(organization);

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
            <MultiMetricsQueryParamsProvider hasEquations={hasEquations}>
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
            </MultiMetricsQueryParamsProvider>
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
  const hasEquations = canUseMetricsEquations(organization);
  const onboardingProject = useOnboardingProject({property: 'hasTraceMetrics'});

  const hasSavedQueryTitle =
    defined(pageId) && defined(savedQuery) && savedQuery.name.length > 0;

  const addMetricQuery = useAddMetricQuery();
  const metricQueries = useMultiMetricsQueryParams();
  const addEquationQuery = useAddMetricQuery({type: 'equation'});

  // Cannot add metric queries beyond Z
  const isAddMetricDisabled =
    metricQueries.length >= MAX_METRICS_ALLOWED ||
    metricQueries.some(q => q.label === 'Z');

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {hasSavedQueryTitle ? (
          <SentryDocumentTitle
            title={`${savedQuery.name} — ${METRICS_TITLE}`}
            orgSlug={organization?.slug}
          />
        ) : null}
        {hasPageFrameFeature ? (
          title && defined(pageId) ? (
            <TopBar.Slot name="title">
              <ExploreBreadcrumb
                traceItemDataset={TraceItemDataset.TRACEMETRICS}
                savedQueryName={savedQuery?.name}
              />
              <FeatureBadge type="beta" />
              <PageHeadingQuestionTooltip
                docsUrl="https://docs.sentry.io/product/explore/metrics/"
                title={t(
                  'Track critical application signals using counters, gauges, and distributions.'
                )}
                linkLabel={t('Read the Docs')}
              />
            </TopBar.Slot>
          ) : (
            <TopBar.Slot name="title">
              {title ? title : METRICS_TITLE}
              <FeatureBadge type="beta" />
              <PageHeadingQuestionTooltip
                docsUrl="https://docs.sentry.io/product/explore/metrics/"
                title={t(
                  'Track critical application signals using counters, gauges, and distributions.'
                )}
                linkLabel={t('Read the Docs')}
              />
            </TopBar.Slot>
          )
        ) : (
          <Fragment>
            {title && defined(pageId) ? (
              <ExploreBreadcrumb
                traceItemDataset={TraceItemDataset.TRACEMETRICS}
                savedQueryName={savedQuery?.name}
              />
            ) : null}
            <Layout.Title>
              {title ? title : METRICS_TITLE}
              <FeatureBadge type="beta" />
              <PageHeadingQuestionTooltip
                docsUrl="https://docs.sentry.io/product/explore/metrics/"
                title={t(
                  'Track critical application signals using counters, gauges, and distributions.'
                )}
                linkLabel={t('Read the Docs')}
              />
            </Layout.Title>
          </Fragment>
        )}
      </Layout.HeaderContent>
      {hasPageFrameFeature ? (
        <Fragment>
          {defined(onboardingProject) ? null : (
            <TopBar.Slot name="actions">
              <ToolbarVisualizeAddChart
                add={addMetricQuery}
                disabled={isAddMetricDisabled}
                label={t('Add Metric')}
                display="button"
                size="sm"
              />
              {hasEquations && (
                <ToolbarVisualizeAddChart
                  size="sm"
                  display="button"
                  add={addEquationQuery}
                  disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
                  label={t('Add Equation')}
                />
              )}
              <MetricSaveAs size="sm" />
            </TopBar.Slot>
          )}
          <TopBar.Slot name="feedback">
            <FeedbackButton
              feedbackOptions={metricsFeedbackOptions}
              aria-label={t('Give Feedback')}
              tooltipProps={{title: t('Give Feedback')}}
            >
              {null}
            </FeedbackButton>
          </TopBar.Slot>
        </Fragment>
      ) : (
        <Layout.HeaderActions>
          <FeedbackButton feedbackOptions={metricsFeedbackOptions} />
        </Layout.HeaderActions>
      )}
    </Layout.Header>
  );
}
