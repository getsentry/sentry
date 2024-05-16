import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import Alert from 'sentry/components/alert';
import FeatureBadge from 'sentry/components/badge/featureBadge';
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
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
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

  const addCustomMetric = useCallback(
    (referrer: 'header' | 'onboarding_panel') => {
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
            showCustomMetricButton={hasCustomMetrics || isEmptyStateDismissed}
            addCustomMetric={() => addCustomMetric('header')}
          />
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <FloatingFeedbackWidget />
        <Layout.Main fullWidth>
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
              <Queries />
              <MetricScratchpad />
              <WidgetDetails />
            </Fragment>
          ) : (
            <OnboardingPanel image={<EmptyStateImage src={emptyStateImg} />}>
              <h3>{t('Get started with custom metrics')}</h3>
              <p>
                {t(
                  "Send your own metrics to Sentry to track your system's behaviour and profit from the same powerful features as you do with errors, like alerting and dashboards."
                )}
              </p>
              <MetricsOnboardingPanelPrimaryAction organization={organization}>
                <ButtonList gap={1}>
                  <Button
                    priority="primary"
                    onClick={() => addCustomMetric('onboarding_panel')}
                  >
                    {t('Add Custom Metric')}
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
