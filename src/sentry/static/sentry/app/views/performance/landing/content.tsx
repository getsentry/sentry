import React from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import SearchBar from 'app/views/events/searchBar';

import Charts from '../charts/index';
import {getBackendAxisOptions, getFrontendAxisOptions} from '../data';
import Table from '../table';
import {getTransactionSearchQuery} from '../utils';

import DoubleAxisDisplay from './display/doubleAxisDisplay';
import {FRONTEND_COLUMN_TITLES} from './data';
import {
  getCurrentLandingDisplay,
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
  setError: (msg: string | undefined) => void;
  handleSearch: (searchQuery: string) => void;
} & WithRouterProps;

type State = {};
class LandingContent extends React.Component<Props, State> {
  getSummaryConditions(query: string) {
    const parsed = tokenizeSearch(query);
    parsed.query = [];

    return stringifyQueryObject(parsed);
  }

  handleLandingDisplayChange = (field: string) => {
    const {location} = this.props;

    const newQuery = {...location.query};

    delete newQuery[LEFT_AXIS_QUERY_KEY];
    delete newQuery[RIGHT_AXIS_QUERY_KEY];

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...newQuery,
        landingDisplay: field,
      },
    });
  };

  renderLandingV2() {
    const {organization, location, eventView, projects, handleSearch} = this.props;

    const currentLandingDisplay = getCurrentLandingDisplay(location, eventView, projects);
    const filterString = getTransactionSearchQuery(location);
    const summaryConditions = this.getSummaryConditions(filterString);

    return (
      <React.Fragment>
        <SearchContainer>
          <StyledSearchBar
            organization={organization}
            projectIds={eventView.project}
            query={filterString}
            fields={generateAggregateFields(
              organization,
              [...eventView.fields, {field: 'tps()'}],
              ['epm()', 'eps()']
            )}
            onSearch={handleSearch}
          />
          <ProjectTypeDropdown>
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
          </ProjectTypeDropdown>
        </SearchContainer>
        {this.renderSelectedDisplay(currentLandingDisplay.field, summaryConditions)}
      </React.Fragment>
    );
  }

  renderSelectedDisplay(display, summaryConditions) {
    switch (display) {
      case LandingDisplayField.ALL:
        return this.renderLandingAll(summaryConditions);
      case LandingDisplayField.FRONTEND:
        return this.renderLandingFrontend(summaryConditions);
      case LandingDisplayField.BACKEND:
        return this.renderLandingBackend(summaryConditions);
      default:
        throw new Error(`Unknown display: ${display}`);
    }
  }

  renderLandingFrontend = summaryConditions => {
    const {organization, location, projects, eventView, setError} = this.props;

    const axisOptions = getFrontendAxisOptions(organization);
    const {leftAxis, rightAxis} = getDisplayAxes(axisOptions, location);

    return (
      <React.Fragment>
        <FrontendCards
          eventView={eventView}
          organization={organization}
          location={location}
          projects={projects}
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
          summaryConditions={summaryConditions}
          columnTitles={FRONTEND_COLUMN_TITLES}
        />
      </React.Fragment>
    );
  };

  renderLandingBackend = summaryConditions => {
    const {organization, location, projects, eventView, setError} = this.props;

    const axisOptions = getBackendAxisOptions(organization);
    const {leftAxis, rightAxis} = getDisplayAxes(axisOptions, location);

    return (
      <React.Fragment>
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
          summaryConditions={summaryConditions}
        />
      </React.Fragment>
    );
  };

  renderLandingAll = summaryConditions => {
    const {organization, location, router, projects, eventView, setError} = this.props;

    return (
      <React.Fragment>
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
          summaryConditions={summaryConditions}
        />
      </React.Fragment>
    );
  };

  renderLandingV1 = () => {
    const {
      organization,
      location,
      router,
      projects,
      eventView,
      setError,
      handleSearch,
    } = this.props;

    const filterString = getTransactionSearchQuery(location, eventView.query);
    const summaryConditions = this.getSummaryConditions(filterString);

    return (
      <React.Fragment>
        <StyledSearchBar
          organization={organization}
          projectIds={eventView.project}
          query={filterString}
          fields={generateAggregateFields(
            organization,
            [...eventView.fields, {field: 'tps()'}],
            ['epm()', 'eps()']
          )}
          onSearch={handleSearch}
        />
        <Feature features={['performance-vitals-overview']}>
          <FrontendCards
            eventView={eventView}
            organization={organization}
            location={location}
            projects={projects}
            frontendOnly
          />
        </Feature>
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
          summaryConditions={summaryConditions}
        />
      </React.Fragment>
    );
  };

  render() {
    const {organization} = this.props;

    return (
      <div>
        <Feature
          organization={organization}
          features={['performance-landing-v2']}
          renderDisabled={this.renderLandingV1}
        >
          {this.renderLandingV2()}
        </Feature>
      </div>
    );
  }
}

const SearchContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
`;

const ProjectTypeDropdown = styled('div')`
  margin-left: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-bottom: ${space(2)};
`;

export default withRouter(LandingContent);
