import {Component, Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import SearchBar from 'sentry/components/events/searchBar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import Teams from 'sentry/utils/teams';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import Charts from '../charts/index';
import {
  getBackendAxisOptions,
  getFrontendAxisOptions,
  getFrontendOtherAxisOptions,
  getMobileAxisOptions,
} from '../data';
import Table from '../table';
import {getTransactionSearchQuery} from '../utils';

import DoubleAxisDisplay from './display/doubleAxisDisplay';
import {
  BACKEND_COLUMN_TITLES,
  FRONTEND_OTHER_COLUMN_TITLES,
  FRONTEND_PAGELOAD_COLUMN_TITLES,
  MOBILE_COLUMN_TITLES,
  REACT_NATIVE_COLUMN_TITLES,
} from './data';
import {
  checkIsReactNative,
  getCurrentLandingDisplay,
  getDefaultDisplayFieldForPlatform,
  getDisplayAxes,
  LANDING_DISPLAYS,
  LandingDisplayField,
  LEFT_AXIS_QUERY_KEY,
  RIGHT_AXIS_QUERY_KEY,
} from './utils';
import {BackendCards, FrontendCards, MobileCards} from './vitalsCards';

type Props = {
  eventView: EventView;
  handleSearch: (searchQuery: string) => void;
  location: Location;
  organization: Organization;
  projects: Project[];
  setError: (msg: string | undefined) => void;
} & WithRouterProps;

type State = {};
class LandingContent extends Component<Props, State> {
  getSummaryConditions(query: string) {
    const parsed = new MutableSearch(query);
    parsed.freeText = [];

    return parsed.formatString();
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
    const searchConditions = new MutableSearch(query);
    searchConditions.removeFilter('transaction.op');

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
        query: searchConditions.formatString(),
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
      case LandingDisplayField.MOBILE:
        return this.renderLandingMobile();
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

  renderLandingMobile = () => {
    const {organization, location, projects, eventView, setError} = this.props;

    const axisOptions = getMobileAxisOptions(organization);
    const {leftAxis, rightAxis} = getDisplayAxes(axisOptions, location);

    // only react native should contain the stall percentage column
    const isReactNative = checkIsReactNative(eventView);
    const columnTitles = isReactNative
      ? REACT_NATIVE_COLUMN_TITLES
      : MOBILE_COLUMN_TITLES;

    return (
      <Fragment>
        <MobileCards
          eventView={eventView}
          organization={organization}
          location={location}
          showStallPercentage={isReactNative}
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

  render() {
    const {organization, location, eventView, projects, handleSearch} = this.props;

    const currentLandingDisplay = getCurrentLandingDisplay(location, projects, eventView);
    const filterString = getTransactionSearchQuery(location, eventView.query);

    return (
      <Fragment>
        <SearchContainer>
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
          <DropdownControl
            buttonProps={{prefix: t('Display')}}
            label={currentLandingDisplay.label}
          >
            {LANDING_DISPLAYS.filter(
              ({isShown}) => !isShown || isShown(organization)
            ).map(({label, field}) => (
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
        <Teams provideUserTeams>
          {({teams, initiallyLoaded}) =>
            initiallyLoaded ? (
              <TeamKeyTransactionManager.Provider
                organization={organization}
                teams={teams}
                selectedTeams={['myteams']}
                selectedProjects={eventView.project.map(String)}
              >
                {this.renderSelectedDisplay(currentLandingDisplay.field)}
              </TeamKeyTransactionManager.Provider>
            ) : (
              <LoadingIndicator />
            )
          }
        </Teams>
      </Fragment>
    );
  }
}

const SearchContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr min-content;
  }
`;

export default withRouter(LandingContent);
