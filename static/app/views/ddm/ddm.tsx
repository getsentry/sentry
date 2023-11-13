import {useEffect} from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackWidget from 'sentry/components/feedback/widget/feedbackWidget';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricScratchpad} from 'sentry/views/ddm/scratchpad';
import {ScratchpadSelector} from 'sentry/views/ddm/scratchpadSelector';
import {TraceTable} from 'sentry/views/ddm/traceTable';

function DDM() {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('ddm.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle title={t('DDM')} orgSlug={organization.slug}>
      <PageFiltersContainer disablePersistence>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('DDM')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io"
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
              <TraceTable />
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  grid-template: 1fr / 1fr max-content;
  gap: ${space(1)};
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template: 1fr 1fr / 1fr;
  }
`;

export default DDM;
