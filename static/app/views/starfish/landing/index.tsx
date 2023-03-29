import {Fragment, useEffect, useRef} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {GenericQueryBatcher} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useTeams from 'sentry/utils/useTeams';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';
import {MetricsDataSwitcherAlert} from 'sentry/views/performance/landing/metricsDataSwitcherAlert';

import Onboarding from '../onboarding';

import {StarfishView} from './views/starfishView';

type Props = {
  eventView: EventView;
  location: Location;
  onboardingProject: Project | undefined;
  organization: Organization;
  projects: Project[];
  router: InjectedRouter;
  selection: PageFilters;
  setError: (msg: string | undefined) => void;
  withStaticFilters: boolean;
};

export function StarfishLanding(props: Props) {
  const {organization, location, eventView, projects, onboardingProject} = props;

  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

  const hasMounted = useRef(false);
  const showOnboarding = onboardingProject !== undefined;

  useEffect(() => {
    if (hasMounted.current) {
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          landingDisplay: undefined,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventView.project.join('.')]);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  let pageFilters: React.ReactNode = (
    <PageFilterBar condensed>
      <ProjectPageFilter />
      <EnvironmentPageFilter />
      <DatePageFilter alignDropdown="left" />
    </PageFilterBar>
  );

  if (showOnboarding) {
    pageFilters = <SearchContainerWithFilter>{pageFilters}</SearchContainerWithFilter>;
  }

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Starfish')}
              <PageHeadingQuestionTooltip
                docsUrl="https://docs.sentry.io/product/performance/"
                title={t(
                  'Your main view for transaction data with graphs that visualize transactions or trends, as well as a table where you can drill down on individual transactions.'
                )}
              />
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body data-test-id="performance-landing-body">
          <Layout.Main fullWidth>
            <MetricsCardinalityProvider
              sendOutcomeAnalytics
              organization={organization}
              location={location}
            >
              <MetricsDataSwitcher
                organization={organization}
                eventView={eventView}
                location={location}
              >
                {metricsDataSide => {
                  return (
                    <MEPSettingProvider
                      location={location}
                      forceTransactions={metricsDataSide.forceTransactionsOnly}
                    >
                      <MetricsDataSwitcherAlert
                        organization={organization}
                        eventView={eventView}
                        projects={projects}
                        location={location}
                        router={props.router}
                        {...metricsDataSide}
                      />
                      <PageErrorAlert />
                      {showOnboarding ? (
                        <Fragment>
                          {pageFilters}
                          <Onboarding
                            organization={organization}
                            project={onboardingProject}
                          />
                        </Fragment>
                      ) : (
                        <Fragment>
                          {initiallyLoaded ? (
                            <TeamKeyTransactionManager.Provider
                              organization={organization}
                              teams={teams}
                              selectedTeams={['myteams']}
                              selectedProjects={eventView.project.map(String)}
                            >
                              <GenericQueryBatcher>
                                <StarfishView {...props} />
                              </GenericQueryBatcher>
                            </TeamKeyTransactionManager.Provider>
                          ) : (
                            <LoadingIndicator />
                          )}
                        </Fragment>
                      )}
                    </MEPSettingProvider>
                  );
                }}
              </MetricsDataSwitcher>
            </MetricsCardinalityProvider>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const SearchContainerWithFilter = styled('div')`
  display: grid;
  grid-template-rows: auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr;
  }
`;
