import {FC, Fragment, useEffect, useRef} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SearchBar from 'sentry/components/events/searchBar';
import {GlobalSdkUpdateAlert} from 'sentry/components/globalSdkUpdateAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageHeading from 'sentry/components/pageHeading';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import {GenericQueryBatcher} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import useTeams from 'sentry/utils/useTeams';

import MetricsSearchBar from '../metricsSearchBar';
import {MetricsSwitch, useMetricsSwitch} from '../metricsSwitch';
import Onboarding from '../onboarding';
import {getTransactionSearchQuery} from '../utils';

import {AllTransactionsView} from './views/allTransactionsView';
import {BackendView} from './views/backendView';
import {FrontendOtherView} from './views/frontendOtherView';
import {FrontendPageloadView} from './views/frontendPageloadView';
import {MobileView} from './views/mobileView';
import {
  getDefaultDisplayForPlatform,
  getLandingDisplayFromParam,
  handleLandingDisplayChange,
  LANDING_DISPLAYS,
  LandingDisplayField,
} from './utils';

type Props = {
  eventView: EventView;
  handleSearch: (searchQuery: string) => void;
  handleTrendsClick: () => void;
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
  setError: (msg: string | undefined) => void;
  shouldShowOnboarding: boolean;
};

const fieldToViewMap: Record<LandingDisplayField, FC<Props>> = {
  [LandingDisplayField.ALL]: AllTransactionsView,
  [LandingDisplayField.BACKEND]: BackendView,
  [LandingDisplayField.FRONTEND_OTHER]: FrontendOtherView,
  [LandingDisplayField.FRONTEND_PAGELOAD]: FrontendPageloadView,
  [LandingDisplayField.MOBILE]: MobileView,
};

export function PerformanceLanding(props: Props) {
  const {
    organization,
    location,
    eventView,
    projects,
    handleSearch,
    handleTrendsClick,
    shouldShowOnboarding,
  } = props;

  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

  const hasMounted = useRef(false);
  const paramLandingDisplay = getLandingDisplayFromParam(location);
  const defaultLandingDisplayForProjects = getDefaultDisplayForPlatform(
    projects,
    eventView
  );
  const landingDisplay = paramLandingDisplay ?? defaultLandingDisplayForProjects;

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
  }, [eventView.project.join('.')]);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  const filterString = getTransactionSearchQuery(location, eventView.query);
  const {isMetricsData} = useMetricsSwitch();

  const showOnboarding = shouldShowOnboarding;

  const ViewComponent = fieldToViewMap[landingDisplay.field];

  return (
    <StyledPageContent data-test-id="performance-landing-v3">
      <Layout.Header>
        <Layout.HeaderContent>
          <StyledHeading>{t('Performance')}</StyledHeading>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          {!showOnboarding && (
            <ButtonBar gap={3}>
              <MetricsSwitch onSwitch={() => handleSearch('')} />
              <Button
                priority="primary"
                data-test-id="landing-header-trends"
                onClick={() => handleTrendsClick()}
              >
                {t('View Trends')}
              </Button>
            </ButtonBar>
          )}
        </Layout.HeaderActions>

        <Layout.HeaderNavTabs>
          {LANDING_DISPLAYS.map(({label, field}) => (
            <li key={label} className={landingDisplay.field === field ? 'active' : ''}>
              <a
                href="#"
                data-test-id={`landing-tab-${field}`}
                onClick={() =>
                  handleLandingDisplayChange(
                    field,
                    location,
                    projects,
                    organization,
                    eventView
                  )
                }
              >
                {t(label)}
              </a>
            </li>
          ))}
        </Layout.HeaderNavTabs>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <GlobalSdkUpdateAlert />
          {showOnboarding ? (
            <Onboarding
              organization={organization}
              project={
                props.selection.projects.length > 0
                  ? // If some projects selected, use the first selection
                    projects.find(
                      project => props.selection.projects[0].toString() === project.id
                    ) || projects[0]
                  : // Otherwise, use the first project in the org
                    projects[0]
              }
            />
          ) : (
            <Fragment>
              <SearchContainerWithFilter>
                {isMetricsData ? (
                  <MetricsSearchBar
                    searchSource="performance_landing_metrics"
                    orgSlug={organization.slug}
                    query={filterString}
                    onSearch={handleSearch}
                    maxQueryLength={MAX_QUERY_LENGTH}
                    projectIds={eventView.project}
                  />
                ) : (
                  <SearchBar
                    searchSource="performance_landing"
                    organization={organization}
                    projectIds={eventView.project}
                    query={filterString}
                    fields={generateAggregateFields(
                      organization,
                      [...eventView.fields, {field: 'tps()'}],
                      ['epm()', 'eps()']
                    )}
                    onSearch={handleSearch}
                    maxQueryLength={MAX_QUERY_LENGTH}
                  />
                )}
              </SearchContainerWithFilter>
              {initiallyLoaded ? (
                <TeamKeyTransactionManager.Provider
                  organization={organization}
                  teams={teams}
                  selectedTeams={['myteams']}
                  selectedProjects={eventView.project.map(String)}
                >
                  <GenericQueryBatcher>
                    <ViewComponent {...props} />
                  </GenericQueryBatcher>
                </TeamKeyTransactionManager.Provider>
              ) : (
                <LoadingIndicator />
              )}
            </Fragment>
          )}
        </Layout.Main>
      </Layout.Body>
    </StyledPageContent>
  );
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

const SearchContainerWithFilter = styled('div')`
  display: grid;
  gap: ${space(0)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
  }
`;
