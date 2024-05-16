import {Fragment, memo, useCallback} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import Banner from 'sentry/components/banner';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics/constants';
import {canSeeMetricsPage} from 'sentry/utils/metrics/features';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import BackgroundSpace from 'sentry/views/discover/backgroundSpace';
import {
  MetricsOnboardingPanelPrimaryAction,
  MetricsSubscriptionAlert,
} from 'sentry/views/metrics/billing';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {useMetricsOnboardingSidebar} from 'sentry/views/metrics/ddmOnboarding/useMetricsOnboardingSidebar';
import {IntervalSelect} from 'sentry/views/metrics/intervalSelect';
import {PageHeaderActions} from 'sentry/views/metrics/pageHeaderActions';
import {Queries} from 'sentry/views/metrics/queries';
import {MetricScratchpad} from 'sentry/views/metrics/scratchpad';
import {WidgetDetails} from 'sentry/views/metrics/widgetDetails';

export const MetricsLayout = memo(() => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const selectedProjects = pageFilters.selection.projects.join();
  const {hasCustomMetrics, hasPerformanceMetrics, isHasMetricsLoading} =
    useMetricsContext();
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

  if (!canSeeMetricsPage(organization)) {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  return (
    <Fragment>
      <MetricsSubscriptionAlert organization={organization} />
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
          <PageHeaderActions
            showCustomMetricButton={
              hasCustomMetrics || (isEmptyStateDismissed && isBannerDismissed)
            }
            addCustomMetric={() => addCustomMetric('header')}
          />
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <FloatingFeedbackWidget />
        <Layout.Main fullWidth>
          {isEmptyStateDismissed && !hasCustomMetrics && (
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

          <FilterContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
            <IntervalSelect />
          </FilterContainer>
          {isHasMetricsLoading ? (
            <LoadingIndicator />
          ) : hasCustomMetrics || isEmptyStateDismissed ? (
            <Fragment>
              <GuideAnchor target="metrics_onboarding" />
              <Queries />
              <MetricScratchpad />
              <WidgetDetails />
            </Fragment>
          ) : (
            <OnboardingPanel image={<EmptyStateImage src={emptyStateImg} />}>
              <h3>{t('Track and solve what matters')}</h3>
              <p>
                {t(
                  'Create custom metrics to track and visualize the data points you care about over time, like processing time, checkout conversion rate, or user signups. See correlated trace exemplars and metrics if used together with Performance Monitoring.'
                )}
              </p>
              <MetricsOnboardingPanelPrimaryAction organization={organization}>
                <ButtonList gap={1}>
                  <Button
                    priority="primary"
                    onClick={() => addCustomMetric('onboarding_panel')}
                  >
                    {t('Set Up Custom Metric')}
                  </Button>
                  <Button href={METRICS_DOCS_URL} external>
                    {t('Read Docs')}
                  </Button>
                  {hasPerformanceMetrics && (
                    <Button onClick={viewPerformanceMetrics}>
                      {t('View Performance Metrics')}
                    </Button>
                  )}
                </ButtonList>
              </MetricsOnboardingPanelPrimaryAction>
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
`;
