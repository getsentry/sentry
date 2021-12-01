import {FC} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SearchBar from 'sentry/components/events/searchBar';
import GlobalSdkUpdateAlert from 'sentry/components/globalSdkUpdateAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import PageHeading from 'sentry/components/pageHeading';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import {GenericQueryBatcher} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import useTeams from 'sentry/utils/useTeams';

import MetricsSearchBar from '../metricsSearchBar';
import {MetricsSwitch} from '../metricsSwitch';
import {getTransactionSearchQuery} from '../utils';

import {AllTransactionsView} from './views/allTransactionsView';
import {BackendView} from './views/backendView';
import {FrontendOtherView} from './views/frontendOtherView';
import {FrontendPageloadView} from './views/frontendPageloadView';
import {MobileView} from './views/mobileView';
import {
  getCurrentLandingDisplay,
  handleLandingDisplayChange,
  LANDING_DISPLAYS,
  LandingDisplayField,
} from './utils';

type Props = {
  organization: Organization;
  eventView: EventView;
  location: Location;
  projects: Project[];
  shouldShowOnboarding: boolean;
  setError: (msg: string | undefined) => void;
  handleSearch: (searchQuery: string) => void;
  handleTrendsClick: () => void;
  isMetricsData?: boolean;
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
    isMetricsData,
  } = props;

  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

  const currentLandingDisplay = getCurrentLandingDisplay(location, projects, eventView);
  const filterString = getTransactionSearchQuery(location, eventView.query);

  const showOnboarding = shouldShowOnboarding;

  const shownLandingDisplays = LANDING_DISPLAYS.filter(
    ({isShown}) => !isShown || isShown(organization)
  );

  const ViewComponent = fieldToViewMap[currentLandingDisplay.field];

  return (
    <div data-test-id="performance-landing-v3">
      <Layout.Header>
        <Layout.HeaderContent>
          <StyledHeading>{t('Performance')}</StyledHeading>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          {!showOnboarding && (
            <ButtonBar gap={3}>
              <MetricsSwitch />
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

        <StyledNavTabs>
          {shownLandingDisplays.map(({label, field}) => (
            <li
              key={label}
              className={currentLandingDisplay.field === field ? 'active' : ''}
            >
              <a
                href="#"
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
        </StyledNavTabs>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <GlobalSdkUpdateAlert />
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
        </Layout.Main>
      </Layout.Body>
    </div>
  );
}

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
  /* Makes sure the tabs are pushed into another row */
  width: 100%;
`;

const SearchContainerWithFilter = styled('div')`
  display: grid;
  grid-gap: ${space(0)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
  }
`;
