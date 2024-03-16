import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import {Button} from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
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
import useOrganization from 'sentry/utils/useOrganization';
import {useDDMContext} from 'sentry/views/ddm/context';
import {useMetricsOnboardingSidebar} from 'sentry/views/ddm/ddmOnboarding/useMetricsOnboardingSidebar';
import {PageHeaderActions} from 'sentry/views/ddm/pageHeaderActions';
import {Queries} from 'sentry/views/ddm/queries';
import {MetricScratchpad} from 'sentry/views/ddm/scratchpad';
import {WidgetDetails} from 'sentry/views/ddm/widgetDetails';

export const MetricsLayout = memo(() => {
  const organization = useOrganization();
  const {hasMetrics} = useDDMContext();
  const {activateSidebar} = useMetricsOnboardingSidebar();

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
          <PageHeaderActions
            showCustomMetricButton={hasMetrics}
            addCustomMetric={() => addCustomMetric('header')}
          />
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <FloatingFeedbackWidget />
        <Layout.Main fullWidth>
          <PaddedContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </PaddedContainer>
          {hasMetrics ? (
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
              <Button
                priority="primary"
                onClick={() => addCustomMetric('onboarding_panel')}
              >
                {t('Add Custom Metric')}
              </Button>
            </OnboardingPanel>
          )}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
});

const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: space-between;
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
