import styled from '@emotion/styled';
import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

import {ExploreCharts} from './charts';
import {ExploreTables} from './tables';
import {ExploreToolbar} from './toolbar';

interface ExploreContentProps {
  location: Location;
}

export function ExploreContent({}: ExploreContentProps) {
  const organization = useOrganization();
  return (
    <SentryDocumentTitle title={t('Explore')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <StyledTitle>{t('Explore')}</StyledTitle>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              {/* TODO: search bar */}
            </Layout.HeaderContent>
          </Layout.Header>
          <StyledBody>
            <StyledSide>
              <ExploreToolbar />
            </StyledSide>
            <StyledMain fullWidth>
              <ExploreCharts />
              <ExploreTables />
            </StyledMain>
          </StyledBody>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const StyledTitle = styled(Layout.Title)`
  margin-bottom: ${space(2)};
`;

const StyledBody = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: grid;
    grid-template-columns: 275px minmax(100px, auto);
    align-content: start;
    gap: ${p => (!p.noRowGap ? `${space(3)}` : `0 ${space(3)}`)};
  }
`;

const StyledMain = styled(Layout.Main)`
  grid-column: 2/3;
`;

const StyledSide = styled(Layout.Side)`
  grid-column: 1/2;
`;
