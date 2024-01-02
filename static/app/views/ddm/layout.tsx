import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics';
import {hasDDMExperimentalFeature} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';
import {useDDMContext} from 'sentry/views/ddm/context';
import {useDashboardImport} from 'sentry/views/ddm/dashboardImportModal';
import {useMetricsOnboardingSidebar} from 'sentry/views/ddm/ddmOnboarding/useMetricsOnboardingSidebar';
import {MetricScratchpad} from 'sentry/views/ddm/scratchpad';
import {ScratchpadSelector} from 'sentry/views/ddm/scratchpadSelector';
import ShareButton from 'sentry/views/ddm/shareButton';
import {WidgetDetails} from 'sentry/views/ddm/widgetDetails';

export const DDMLayout = memo(() => {
  const organization = useOrganization();
  const {metricsMeta, hasCustomMetrics, isLoading} = useDDMContext();
  const hasMetrics = !isLoading && metricsMeta.length > 0;
  const {activateSidebar} = useMetricsOnboardingSidebar();

  const importDashboard = useDashboardImport();
  const addCustomMetric = useCallback(
    (referrer: string) => {
      Sentry.metrics.increment('ddm.add_custom_metric', 1, {
        tags: {
          referrer,
        },
      });
      activateSidebar();
    },
    [activateSidebar]
  );

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Metrics')}
            <PageHeadingQuestionTooltip
              docsUrl={METRICS_DOCS_URL}
              title={t('Delightful Developer Metrics.')}
            />
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            {hasMetrics && !hasCustomMetrics && (
              <Button
                priority="primary"
                onClick={() => addCustomMetric('header')}
                size="sm"
              >
                {t('Add Custom Metric')}
              </Button>
            )}
            <ShareButton />
            <GithubFeedbackButton
              href="https://github.com/getsentry/sentry/discussions/58584"
              label={t('Discussion')}
              title={null}
            />
            {hasDDMExperimentalFeature(organization) && (
              <Button
                size="sm"
                icon={<IconDownload size="xs" />}
                onClick={importDashboard}
              >
                {t('Import Dashboard')}
              </Button>
            )}
          </ButtonBar>
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
            <ScratchpadSelector />
          </PaddedContainer>
          {isLoading ? (
            <LoadingIndicator />
          ) : hasMetrics ? (
            <Fragment>
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
