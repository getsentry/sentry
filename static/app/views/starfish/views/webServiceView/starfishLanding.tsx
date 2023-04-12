import {Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useTeams from 'sentry/utils/useTeams';

import {StarfishView} from './starfishView';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  router: InjectedRouter;
  selection: PageFilters;
  withStaticFilters: boolean;
};

export function StarfishLanding(props: Props) {
  const {organization, eventView} = props;

  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

  const pageFilters: React.ReactNode = (
    <PageFilterBar condensed>
      <DatePageFilter alignDropdown="left" />
    </PageFilterBar>
  );

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Starfish')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <Fragment>
              <SearchContainerWithFilterAndMetrics>
                {pageFilters}
              </SearchContainerWithFilterAndMetrics>

              {initiallyLoaded ? (
                <TeamKeyTransactionManager.Provider
                  organization={organization}
                  teams={teams}
                  selectedTeams={['myteams']}
                  selectedProjects={eventView.project.map(String)}
                >
                  <StarfishView {...props} />
                </TeamKeyTransactionManager.Provider>
              ) : (
                <LoadingIndicator />
              )}
            </Fragment>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const SearchContainerWithFilterAndMetrics = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
