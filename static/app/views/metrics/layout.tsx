import {Fragment, memo, useCallback} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import Banner from 'sentry/components/banner';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics/constants';
import {
  hasCustomMetrics,
  hasCustomMetricsExtractionRules,
} from 'sentry/utils/metrics/features';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import BackgroundSpace from 'sentry/views/discover/backgroundSpace';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {useMetricsOnboardingSidebar} from 'sentry/views/metrics/ddmOnboarding/useMetricsOnboardingSidebar';
import {IntervalSelect} from 'sentry/views/metrics/intervalSelect';
import {MetricsApiChangeAlert} from 'sentry/views/metrics/metricsApiChangeAlert';
import {MetricsStopIngestionAlert} from 'sentry/views/metrics/metricsIngestionStopAlert';
import {PageHeaderActions} from 'sentry/views/metrics/pageHeaderActions';
import {Queries} from 'sentry/views/metrics/queries';
import {MetricScratchpad} from 'sentry/views/metrics/scratchpad';
import {WidgetDetails} from 'sentry/views/metrics/widgetDetails';

function showEmptyState({
  organization,
  isEmptyStateDismissed,
  hasPerformanceMetrics,
  hasSentCustomMetrics,
}: {
  hasPerformanceMetrics: boolean;
  hasSentCustomMetrics: boolean;
  isEmptyStateDismissed: boolean;
  organization: Organization;
}) {
  if (hasCustomMetricsExtractionRules(organization)) {
    return !hasSentCustomMetrics && !hasPerformanceMetrics;
  }
  return !isEmptyStateDismissed && !hasSentCustomMetrics;
}

export const MetricsLayout = memo(() => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const selectedProjects = pageFilters.selection.projects.join();

  const {
    hasCustomMetrics: hasSentCustomMetrics,
    hasPerformanceMetrics,
    isHasMetricsLoading,
  } = useMetricsContext();
  const virtualMetrics = useVirtualMetricsContext();

  const isLoading = isHasMetricsLoading || virtualMetrics.isLoading;

  const {activateSidebar} = useMetricsOnboardingSidebar();
  const {dismiss: emptyStateDismiss, isDismissed: isEmptyStateDismissed} =
    useDismissAlert({
      key: `${organization.id}:${selectedProjects}:metrics-empty-state-dismissed`,
    });
  const theme = useTheme();
  const isSmallBanner = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const [isBannerDismissed] = useLocalStorageState('metrics-banner-dismissed', false);

  const addCustomMetric = useCallback(
    (referrer: 'header' | 'onboarding_panel' | 'banner') => {
      Sentry.metrics.increment('ddm.add_custom_metric', 1, {
        tags: {
          referrer,
        },
      });
      trackAnalytics('ddm.open-onboarding', {
        organization,
        source: referrer,
      });
      activateSidebar();
    },
    [activateSidebar, organization]
  );

  const viewPerformanceMetrics = useCallback(() => {
    Sentry.metrics.increment('ddm.view_performance_metrics', 1);
    trackAnalytics('ddm.view_performance_metrics', {
      organization,
    });
    emptyStateDismiss();
  }, [emptyStateDismiss, organization]);

  const showOnboardingPanel = showEmptyState({
    organization,
    isEmptyStateDismissed,
    hasPerformanceMetrics,
    hasSentCustomMetrics,
  });

  if (!hasCustomMetrics(organization)) {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Metrics')}
            <PageHeadingQuestionTooltip
              docsUrl={METRICS_DOCS_URL}
              title={t(
                'Metrics help you track and visualize the data points you care about, making it easier to monitor your application health and identify issues.'
              )}
            />
            <FeatureBadge type="beta" />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          {!showOnboardingPanel ? (
            <PageHeaderActions
              showAddMetricButton={
                hasCustomMetricsExtractionRules(organization) ||
                hasSentCustomMetrics ||
                (isEmptyStateDismissed && isBannerDismissed)
              }
              addCustomMetric={() => addCustomMetric('header')}
            />
          ) : null}
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <FloatingFeedbackWidget />
        <Layout.Main fullWidth>
          {isEmptyStateDismissed &&
            !hasSentCustomMetrics &&
            !hasCustomMetricsExtractionRules(organization) && (
              <Banner
                title={t('Custom Metrics')}
                subtitle={t(
                  "Track your system's behaviour and profit from the same powerful features as you do with errors, like alerting and dashboards."
                )}
                backgroundComponent={<BackgroundSpace />}
                dismissKey="metrics"
              >
                <Button
                  size={isSmallBanner ? 'xs' : undefined}
                  translucentBorder
                  onClick={() => addCustomMetric('banner')}
                >
                  {t('Set Up')}
                </Button>
              </Banner>
            )}

          {hasCustomMetricsExtractionRules(organization) ? (
            !isLoading && hasSentCustomMetrics ? (
              <MetricsStopIngestionAlert />
            ) : null
          ) : (
            <MetricsApiChangeAlert />
          )}

          <FilterContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
            <IntervalSelect />
          </FilterContainer>

          {isLoading ? (
            <LoadingIndicator />
          ) : !showOnboardingPanel ? (
            <Fragment>
              <GuideAnchor target="metrics_onboarding" />
              <Queries />
              <MetricScratchpad />
              <WidgetDetails />
            </Fragment>
          ) : (
            <OnboardingPanel image={<EmptyStateImage src={emptyStateImg} />}>
              <h3>{t('Track and solve what matters')}</h3>
              {hasCustomMetricsExtractionRules(organization) ? (
                <Fragment>
                  <p>
                    {tct(
                      'Query and plot metrics extracted from your span data to visualise trends and identify anomalies. To get started, you need to enable [link:tracing].',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/" />
                        ),
                      }
                    )}
                  </p>
                  <LinkButton
                    priority="primary"
                    href="https://docs.sentry.io/product/performance/getting-started/"
                    external
                  >
                    {t('Set Up Tracing')}
                  </LinkButton>
                </Fragment>
              ) : (
                <Fragment>
                  <p>
                    {t(
                      'Create custom metrics to track and visualize the data points you care about over time, like processing time, checkout conversion rate, or user signups. See correlated trace exemplars and metrics if used together with Performance Monitoring.'
                    )}
                  </p>
                  <ButtonList gap={1}>
                    <Button
                      priority="primary"
                      onClick={() => addCustomMetric('onboarding_panel')}
                    >
                      {t('Set Up Custom Metric')}
                    </Button>
                    <LinkButton href={METRICS_DOCS_URL} external>
                      {t('Read Docs')}
                    </LinkButton>
                    {hasPerformanceMetrics && (
                      <Button onClick={viewPerformanceMetrics}>
                        {t('View Performance Metrics')}
                      </Button>
                    )}
                  </ButtonList>
                </Fragment>
              )}
            </OnboardingPanel>
          )}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
});

const FilterContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const EmptyStateImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    user-select: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 220px;
    margin-top: auto;
    margin-bottom: auto;
    transform: translateX(-50%);
    left: 50%;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    transform: translateX(-60%);
    width: 280px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    transform: translateX(-75%);
    width: 320px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  grid-auto-flow: row;
  gap: ${space(1)};
`;
