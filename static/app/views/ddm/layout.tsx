import {Fragment, memo, useRef} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/custom-metrics-empty-state.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SplitPanel, {BaseSplitDivider, DividerProps} from 'sentry/components/splitPanel';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useDDMContext} from 'sentry/views/ddm/context';
import {useMetricsOnboardingSidebar} from 'sentry/views/ddm/ddmOnboarding/useMetricsOnboardingSidebar';
import {MetricScratchpad} from 'sentry/views/ddm/scratchpad';
import {ScratchpadSelector} from 'sentry/views/ddm/scratchpadSelector';
import {TrayContent} from 'sentry/views/ddm/trayContent';

const SIZE_LOCAL_STORAGE_KEY = 'ddm-split-size';

function MainContent() {
  const {metricsMeta, hasCustomMetrics, isLoading} = useDDMContext();
  const hasMetrics = !isLoading && metricsMeta.length > 0;
  const {activateSidebar} = useMetricsOnboardingSidebar();
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Metrics')}
            <PageHeadingQuestionTooltip
              docsUrl="https://develop.sentry.dev/delightful-developer-metrics/"
              title={t('Delightful Developer Metrics.')}
            />
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            {hasMetrics && !hasCustomMetrics && (
              <Button priority="primary" onClick={activateSidebar} size="sm">
                {t('Add Custom Metric')}
              </Button>
            )}
            <FeedbackWidgetButton />
            <GithubFeedbackButton
              href="https://github.com/getsentry/sentry/discussions/58584"
              label={t('Discussion')}
              title={null}
            />
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
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
            <MetricScratchpad />
          ) : (
            <OnboardingPanel image={<EmptyStateImage src={emptyStateImg} />}>
              <h3>{t('Get started with custom metrics')}</h3>
              <p>
                {t(
                  "Send your own metrics to Sentry to track your system's behaviour and profit from the same powerful features as you do with errors, like alerting and dashboards."
                )}
              </p>
              <Button priority="primary" onClick={activateSidebar}>
                {t('Add Custom Metric')}
              </Button>
            </OnboardingPanel>
          )}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export const DDMLayout = memo(() => {
  const measureRef = useRef<HTMLDivElement>(null);
  const {height} = useDimensions({elementRef: measureRef});
  const hasSize = height > 0;

  return (
    <FullViewport ref={measureRef}>
      {
        // FullViewport has a grid layout with `grid-template-rows: auto 1fr;`
        // therefore we need the empty div so that SplitPanel can span the whole height
        // TODO(arthur): Check on the styles of FullViewport
      }
      <div />
      {hasSize && (
        <SplitPanel
          availableSize={height}
          SplitDivider={SplitDivider}
          sizeStorageKey={SIZE_LOCAL_STORAGE_KEY}
          top={{
            content: (
              <ScrollingPage>
                <MainContent />
              </ScrollingPage>
            ),
            default: height * 0.7,
            min: 100,
            max: height - 58,
          }}
          bottom={<TrayContent />}
        />
      )}
    </FullViewport>
  );
});

const SplitDivider = styled((props: DividerProps) => (
  <BaseSplitDivider {...props} icon={<IconGrabbable size="xs" />} />
))<DividerProps>`
  border-top: 1px solid ${$p => $p.theme.border};
`;

const ScrollingPage = styled(Layout.Page)`
  height: 100%;
  overflow: auto;
`;

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
