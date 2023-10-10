import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import {GithubFeedbackTooltip} from 'sentry/components/githubFeedbackTooltip';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {ScratchpadSelector} from 'sentry/views/ddm/metricScratchpad';
import MetricScratchpad from 'sentry/views/ddm/metricWidget';

function DDM() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('DDM')} orgSlug={organization.slug}>
      <PageFiltersContainer disablePersistence>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                <GithubFeedbackTooltip
                  href="https://github.com/getsentry/sentry/discussions/54956"
                  title={tct(
                    "[strong:Delightful Developer Metrics] is our new awesome feature that let's you easily explore your data.",
                    {strong: <strong />}
                  )}
                >
                  <span>{t('DDM')}</span>
                </GithubFeedbackTooltip>
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io"
                  title={t('Delightful Developer Metrics.')}
                />
                <FeatureBadge type="alpha" />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <GithubFeedbackButton href="https://github.com/getsentry/sentry/discussions/54956" />
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
              <MetricScratchpad />
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
