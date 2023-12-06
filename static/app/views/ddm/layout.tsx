import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackWidget from 'sentry/components/feedback/widget/feedbackWidget';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {hasDDMExperimentalFeature} from 'sentry/utils/metrics/features';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricScratchpad} from 'sentry/views/ddm/scratchpad';
import {ScratchpadSelector} from 'sentry/views/ddm/scratchpadSelector';
import {TraceTable} from 'sentry/views/ddm/traceTable';
import {TrayContent} from 'sentry/views/ddm/trayContent';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';

function MainContent({showTraceTable}: {showTraceTable?: boolean}) {
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('DDM')}
            <PageHeadingQuestionTooltip
              docsUrl="https://develop.sentry.dev/delightful-developer-metrics/"
              title={t('Delightful Developer Metrics.')}
            />
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <GithubFeedbackButton
              href="https://github.com/getsentry/sentry/discussions/58584"
              label={t('Discussion')}
              title={null}
            />
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <FeedbackWidget />
        <Layout.Main fullWidth>
          <PaddedContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
            <ScratchpadSelector />
          </PaddedContainer>
          <MetricScratchpad />
        </Layout.Main>
        {showTraceTable && <TraceTable />}
      </Layout.Body>
    </Fragment>
  );
}

export function DDMLayout() {
  const organization = useOrganization();
  const hasNewLayout = hasDDMExperimentalFeature(organization);

  const measureRef = useRef<HTMLDivElement>(null);
  const {height} = useDimensions({elementRef: measureRef});
  const hasSize = height > 0;

  if (!hasNewLayout) {
    return (
      <Layout.Page>
        <MainContent showTraceTable />
      </Layout.Page>
    );
  }

  return (
    <FullViewport ref={measureRef}>
      {
        // FullViewport as a grid layout with `grid-template-rows: auto 1fr;`
        // therefore we need the empty div so that SplitPanel can span the whole height */
        // TODO(arthur): Check on the styles of FullViewport */
      }
      <div />
      {hasSize && (
        <SplitPanel
          availableSize={height}
          top={{
            content: (
              <ScrollingPage>
                <MainContent />
              </ScrollingPage>
            ),
            default: height * 0.7,
            min: 100,
            // TODO: adjust to accomodate final tray header
            max: height - 16,
          }}
          bottom={<TrayContent />}
        />
      )}
    </FullViewport>
  );
}

const ScrollingPage = styled(Layout.Page)`
  height: 100%;
  overflow: auto;
`;

const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  grid-template: 1fr / 1fr max-content;
  gap: ${space(1)};
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template: 1fr 1fr / 1fr;
  }
`;
