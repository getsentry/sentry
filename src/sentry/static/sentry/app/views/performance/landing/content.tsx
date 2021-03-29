import React from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';

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
  setError: (msg: string | undefined) => void;
  handleSearch: (searchQuery: string) => void;
} & WithRouterProps;

type State = {};
class LandingContent extends React.Component<Props, State> {
  componentDidMount() {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.landingv2.content',
      eventName: 'Performance Views: Landing V2 Content',
      organization_id: parseInt(organization.id, 10),
    });
  }

  _haveTrackedLandingV2?: boolean;

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
        landingDisplay: field,
      },
    });
  };

  renderLandingV2() {
    const {organization, location, eventView, projects, handleSearch} = this.props;

    if (!this._haveTrackedLandingV2) {
      trackAnalyticsEvent({
        eventKey: 'performance_views.landingv2.new_landing',
        eventName: 'Performance Views: Landing V2 New Landing',
        organization_id: parseInt(organization.id, 10),
      });
      this._haveTrackedLandingV2 = true;
    }

    const currentLandingDisplay = getCurrentLandingDisplay(location, projects, eventView);
    const filterString = getTransactionSearchQuery(location, eventView.query);

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
            omitTags={[`user_misery_prototype(${organization.apdexThreshold})`]}
            onSearch={handleSearch}
            maxQueryLength={MAX_QUERY_LENGTH}
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
        {this.renderSelectedDisplay(currentLandingDisplay.field)}
      </React.Fragment>
    );
  }

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
      <React.Fragment>
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
      </React.Fragment>
    );
  };

  renderLandingBackend = () => {
    const {organization, location, projects, eventView, setError} = this.props;

    const axisOptions = getBackendAxisOptions(organization);
    const {leftAxis, rightAxis} = getDisplayAxes(axisOptions, location);

    const columnTitles = BACKEND_COLUMN_TITLES;

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
          summaryConditions={eventView.getQueryWithAdditionalConditions()}
          columnTitles={columnTitles}
        />
      </React.Fragment>
    );
  };

  renderLandingAll = () => {
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
          summaryConditions={eventView.getQueryWithAdditionalConditions()}
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
          maxQueryLength={MAX_QUERY_LENGTH}
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
        <Feature organization={organization} features={['performance-landing-v2']}>
          {({hasFeature}) =>
            hasFeature ? this.renderLandingV2() : this.renderLandingV1()
          }
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
