import styled from '@emotion/styled';
import type {Location} from 'history';

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
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {useUserQuery} from './hooks/useUserQuery';
import {ExploreCharts} from './charts';
import {ExploreTables} from './tables';
import {ExploreToolbar} from './toolbar';

interface ExploreContentProps {
  location: Location;
}

export function ExploreContent({}: ExploreContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [userQuery, setUserQuery] = useUserQuery();

  const toolbarExtras = organization.features.includes('visibility-explore-dataset')
    ? ['dataset toggle' as const]
    : [];

  return (
    <SentryDocumentTitle title={t('Explore')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <HeaderContent>
              <Title>{t('Explore')}</Title>
              <FilterActions>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                <SpanSearchQueryBuilder
                  projects={selection.projects}
                  initialQuery={userQuery}
                  onSearch={setUserQuery}
                  searchSource="explore"
                />
              </FilterActions>
            </HeaderContent>
          </Layout.Header>
          <Body>
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

const HeaderContent = styled(Layout.HeaderContent)`
  overflow: visible;
`;

const Title = styled(Layout.Title)`
  margin-bottom: ${space(2)};
`;

const FilterActions = styled('div')`
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
