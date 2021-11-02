import {FC, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import SearchBar from 'app/components/events/searchBar';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import NavTabs from 'app/components/navTabs';
import PageHeading from 'app/components/pageHeading';
import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import {MAX_QUERY_LENGTH} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, Team} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import {isActiveSuperuser} from 'app/utils/isActiveSuperuser';
import {OpBreakdownFilterProvider} from 'app/utils/performance/contexts/operationBreakdownFilter';
import withTeams from 'app/utils/withTeams';

import Filter, {SpanOperationBreakdownFilter} from '../transactionSummary/filter';
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
  teams: Team[];
  shouldShowOnboarding: boolean;
  setError: (msg: string | undefined) => void;
  handleSearch: (searchQuery: string) => void;
  handleTrendsClick: () => void;
};

const fieldToViewMap: Record<LandingDisplayField, FC<Props>> = {
  [LandingDisplayField.ALL]: AllTransactionsView,
  [LandingDisplayField.BACKEND]: BackendView,
  [LandingDisplayField.FRONTEND_OTHER]: FrontendOtherView,
  [LandingDisplayField.FRONTEND_PAGELOAD]: FrontendPageloadView,
  [LandingDisplayField.MOBILE]: MobileView,
};

function _PerformanceLanding(props: Props) {
  const {
    organization,
    location,
    eventView,
    projects,
    teams,
    handleSearch,
    handleTrendsClick,
    shouldShowOnboarding,
  } = props;

  const currentLandingDisplay = getCurrentLandingDisplay(location, projects, eventView);
  const filterString = getTransactionSearchQuery(location, eventView.query);

  const isSuperuser = isActiveSuperuser();
  const userTeams = teams.filter(({isMember}) => isMember || isSuperuser);

  const [spanFilter, setSpanFilter] = useState(SpanOperationBreakdownFilter.None);
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
            <Button
              priority="primary"
              data-test-id="landing-header-trends"
              onClick={() => handleTrendsClick()}
            >
              {t('View Trends')}
            </Button>
          )}
        </Layout.HeaderActions>

        <StyledNavTabs>
          {shownLandingDisplays.map(({label, field}) => (
            <li
              key={label}
              className={currentLandingDisplay.field === field ? 'active' : ''}
            >
              <a href="#" onClick={() => handleLandingDisplayChange(field, location)}>
                {t(label)}
              </a>
            </li>
          ))}
        </StyledNavTabs>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <GlobalSdkUpdateAlert />
          <OpBreakdownFilterProvider>
            <SearchContainerWithFilter>
              <Filter
                organization={organization}
                currentFilter={spanFilter}
                onChangeFilter={setSpanFilter}
              />
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
            </SearchContainerWithFilter>
            <TeamKeyTransactionManager.Provider
              organization={organization}
              teams={userTeams}
              selectedTeams={['myteams']}
              selectedProjects={eventView.project.map(String)}
            >
              <ViewComponent {...props} />
            </TeamKeyTransactionManager.Provider>
          </OpBreakdownFilterProvider>
        </Layout.Main>
      </Layout.Body>
    </div>
  );
}

export const PerformanceLanding = withTeams(_PerformanceLanding);

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
    grid-template-columns: min-content 1fr;
  }
`;
