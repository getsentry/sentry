import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {useResultMode} from './hooks/useResultsMode';
import {useUserQuery} from './hooks/useUserQuery';
import {ExploreCharts} from './charts';
import {ExploreTables} from './tables';
import {ExploreToolbar} from './toolbar';

interface ExploreContentProps {
  location: Location;
}

export function ExploreContent({}: ExploreContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [resultsMode] = useResultMode();

  const supportedAggregates = useMemo(() => {
    return resultsMode === 'aggregate' ? ALLOWED_EXPLORE_VISUALIZE_AGGREGATES : [];
  }, [resultsMode]);

  const [userQuery, setUserQuery] = useUserQuery();

  const toolbarExtras = organization.features.includes('visibility-explore-dataset')
    ? ['dataset toggle' as const]
    : [];

  const switchToOldTraceExplorer = useCallback(() => {
    navigate({
      ...location,
      query: {
        ...location.query,
        view: 'trace',
      },
    });
  }, [location, navigate]);

  return (
    <SentryDocumentTitle title={t('Explore')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Title>{t('Explore')}</Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Button onClick={switchToOldTraceExplorer}>
                  {t('Switch to old Trace Explore')}
                </Button>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Body>
            <FilterActions>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <SpanSearchQueryBuilder
                supportedAggregates={supportedAggregates}
                projects={selection.projects}
                initialQuery={userQuery}
                onSearch={setUserQuery}
                searchSource="explore"
              />
            </FilterActions>
            <Side>
              <ExploreToolbar extras={toolbarExtras} />
            </Side>
            <Main fullWidth>
              <ExploreCharts query={userQuery} />
              <ExploreTables />
            </Main>
          </Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const Title = styled(Layout.Title)`
  margin-bottom: ${space(2)};
`;

const FilterActions = styled('div')`
  grid-column: 1 / -1;
  display: grid;
  gap: ${space(2)};
  grid-template-columns: auto;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: auto 1fr;
  }
`;

const Body = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: grid;
    grid-template-columns: 275px minmax(100px, auto);
    align-content: start;
    gap: ${p => (!p.noRowGap ? `${space(3)}` : `0 ${space(3)}`)};
  }
`;

const Main = styled(Layout.Main)`
  grid-column: 2/3;
`;

const Side = styled(Layout.Side)`
  grid-column: 1/2;
`;
