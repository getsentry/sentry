import {Component, Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import TeamSelector, {
  getSelectedTeamIdsFromLocation,
  getSelectedTeams,
} from 'app/components/performance/teamSelector';
import {MAX_QUERY_LENGTH} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, Team} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import withTeams from 'app/utils/withTeams';

import Charts from '../charts/index';
import {
  getBackendAxisOptions,
  getFrontendAxisOptions,
  getFrontendOtherAxisOptions,
} from '../data';
import Table from '../table';
import {getTransactionSearchQuery} from '../utils';

import DoubleAxisDisplay from './display/doubleAxisDisplay';
import {
  BACKEND_COLUMN_TITLES,
  FRONTEND_OTHER_COLUMN_TITLES,
  FRONTEND_PAGELOAD_COLUMN_TITLES,
} from './data';
import {
  getCurrentLandingDisplay,
  getDefaultDisplayFieldForPlatform,
  getDisplayAxes,
  LANDING_DISPLAYS,
  LandingDisplayField,
  LEFT_AXIS_QUERY_KEY,
  RIGHT_AXIS_QUERY_KEY,
} from './utils';
import {BackendCards, FrontendCards} from './vitalsCards';

type Props = {
  organization: Organization;
  eventView: EventView;
  location: Location;
  projects: Project[];
  teams: Team[];
  setError: (msg: string | undefined) => void;
  handleSearch: (searchQuery: string) => void;
} & WithRouterProps;

class LandingContent extends Component<Props> {
  getSummaryConditions(query: string) {
    const parsed = tokenizeSearch(query);
    parsed.query = [];

    return stringifyQueryObject(parsed);
  }

  handleLandingDisplayChange = (field: string) => {
    const {location, organization, eventView, projects} = this.props;

    const newQuery = {...location.query};

    delete newQuery[LEFT_AXIS_QUERY_KEY];
    delete newQuery[RIGHT_AXIS_QUERY_KEY];

    const defaultDisplay = getDefaultDisplayFieldForPlatform(projects, eventView);
    const currentDisplay = decodeScalar(location.query.landingDisplay);

    // Transaction op can affect the display and show no results if it is explicitly set.
    const query = decodeScalar(location.query.query, '');
    const searchConditions = tokenizeSearch(query);
    searchConditions.removeTag('transaction.op');

    trackAnalyticsEvent({
      eventKey: 'performance_views.landingv2.display_change',
      eventName: 'Performance Views: Landing v2 Display Change',
      organization_id: parseInt(organization.id, 10),
      change_to_display: field,
      default_display: defaultDisplay,
      current_display: currentDisplay,
      is_default: defaultDisplay === currentDisplay,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...newQuery,
        query: stringifyQueryObject(searchConditions),
        landingDisplay: field,
      },
    });
  };

  renderSelectedDisplay(display) {
    switch (display) {
      case LandingDisplayField.ALL:
        return this.renderLandingAll();
      case LandingDisplayField.FRONTEND_PAGELOAD:
        return this.renderLandingFrontend(true);
      case LandingDisplayField.FRONTEND_OTHER:
        return this.renderLandingFrontend(false);
      case LandingDisplayField.BACKEND:
        return this.renderLandingBackend();
      default:
        throw new Error(`Unknown display: ${display}`);
    }
  }

  renderLandingFrontend = isPageload => {
    const {organization, location, projects, eventView, setError} = this.props;

    const columnTitles = isPageload
      ? FRONTEND_PAGELOAD_COLUMN_TITLES
      : FRONTEND_OTHER_COLUMN_TITLES;

    const axisOptions = isPageload
      ? getFrontendAxisOptions(organization)
      : getFrontendOtherAxisOptions(organization);
    const {leftAxis, rightAxis} = getDisplayAxes(axisOptions, location);

    return (
      <Fragment>
        {isPageload && (
          <FrontendCards
            eventView={eventView}
            organization={organization}
            location={location}
            projects={projects}
          />
        )}
        <DoubleAxisDisplay
          eventView={eventView}
          organization={organization}
          location={location}
          axisOptions={axisOptions}
          leftAxis={leftAxis}
          rightAxis={rightAxis}
        />
        <Table
          eventView={eventView}
          projects={projects}
          organization={organization}
          location={location}
          setError={setError}
          summaryConditions={eventView.getQueryWithAdditionalConditions()}
          columnTitles={columnTitles}
        />
      </Fragment>
    );
  };

  renderLandingBackend = () => {
    const {organization, location, projects, eventView, setError} = this.props;

    const axisOptions = getBackendAxisOptions(organization);
    const {leftAxis, rightAxis} = getDisplayAxes(axisOptions, location);

    const columnTitles = BACKEND_COLUMN_TITLES;

    return (
      <Fragment>
        <BackendCards
          eventView={eventView}
          organization={organization}
          location={location}
        />
        <DoubleAxisDisplay
          eventView={eventView}
          organization={organization}
          location={location}
          axisOptions={axisOptions}
          leftAxis={leftAxis}
          rightAxis={rightAxis}
        />
        <Table
          eventView={eventView}
          projects={projects}
          organization={organization}
          location={location}
          setError={setError}
          summaryConditions={eventView.getQueryWithAdditionalConditions()}
          columnTitles={columnTitles}
        />
      </Fragment>
    );
  };

  renderLandingAll = () => {
    const {organization, location, router, projects, eventView, setError} = this.props;

    return (
      <Fragment>
        <Charts
          eventView={eventView}
          organization={organization}
          location={location}
          router={router}
        />
        <Table
          eventView={eventView}
          projects={projects}
          organization={organization}
          location={location}
          setError={setError}
          summaryConditions={eventView.getQueryWithAdditionalConditions()}
        />
      </Fragment>
    );
  };

  handleTeamChange = (activeFilters: Set<string>) => {
    const {location} = this.props;

    const newQuery = {
      ...location.query,
      team: [...activeFilters],
    };

    if (activeFilters.size <= 0) {
      delete newQuery.team;
    }

    browserHistory.push({
      ...location,
      query: newQuery,
    });
  };

  render() {
    const {organization, location, eventView, projects, teams, handleSearch} = this.props;
    const currentLandingDisplay = getCurrentLandingDisplay(location, projects, eventView);
    const filterString = getTransactionSearchQuery(location, eventView.query);

    const userTeams = teams.filter(({isMember}) => isMember);
    const selectedTeamIds = getSelectedTeamIdsFromLocation(location);
    const selectedTeamIdSet = new Set(selectedTeamIds);
    const selectedTeams = getSelectedTeams(teams, selectedTeamIdSet);

    const hasTeamKeyTransactions = organization.features.includes(
      'team-key-transactions'
    );

    return (
      <Fragment>
        <SearchContainer hasTeamSelector={hasTeamKeyTransactions}>
          {hasTeamKeyTransactions && (
            <TeamSelector
              teams={userTeams}
              selectedTeams={selectedTeamIdSet}
              handleChangeFilter={this.handleTeamChange}
            />
          )}
          <SearchBar
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
          <DropdownControl
            buttonProps={{prefix: t('Display')}}
            label={currentLandingDisplay.label}
          >
            {LANDING_DISPLAYS.map(({label, field}) => (
              <DropdownItem
                key={field}
                onSelect={this.handleLandingDisplayChange}
                eventKey={field}
                data-test-id={field}
                isActive={field === currentLandingDisplay.field}
              >
                {label}
              </DropdownItem>
            ))}
          </DropdownControl>
        </SearchContainer>
        {hasTeamKeyTransactions ? (
          <TeamKeyTransactionManager.Provider
            organization={organization}
            teams={selectedTeams}
            selectedTeams={selectedTeamIds}
            selectedProjects={eventView.project.map(String)}
          >
            {this.renderSelectedDisplay(currentLandingDisplay.field)}
          </TeamKeyTransactionManager.Provider>
        ) : (
          this.renderSelectedDisplay(currentLandingDisplay.field)
        )}
      </Fragment>
    );
  }
}

const SearchContainer = styled('div')<{hasTeamSelector: boolean}>`
  display: grid;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: ${p =>
      p.hasTeamSelector ? 'min-content 1fr min-content' : '1fr min-content'};
  }
`;

export default withRouter(withTeams(LandingContent));
