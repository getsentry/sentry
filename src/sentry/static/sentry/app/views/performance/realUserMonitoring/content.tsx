import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import SearchBar from 'app/views/events/searchBar';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';

import TransactionVitals from './transactionVitals';
import TransactionHeader, {Tab} from '../transactionSummary/header';
import {FILTER_OPTIONS, WEB_VITAL_DETAILS} from './constants';

const ZOOM_KEYS = Object.values(WebVital).reduce((zoomKeys: string[], vital) => {
  const vitalSlug = WEB_VITAL_DETAILS[vital].slug;
  zoomKeys.push(`${vitalSlug}Start`);
  zoomKeys.push(`${vitalSlug}End`);
  return zoomKeys;
}, []);

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  projects: Project[];
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
};

class RumContent extends React.Component<Props, State> {
  state: State = {
    incompatibleAlertNotice: null,
  };

  handleSearch = (query: string) => {
    const {location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    delete queryParams.cursor;

    browserHistory.push({
      pathname: location.pathname,
      query: queryParams,
    });
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, _errors) => {
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  handleResetView = () => {
    const {location} = this.props;

    const query = {...location.query};
    // reset all zoom parameters when resetting the view
    ZOOM_KEYS.forEach(key => delete query[key]);

    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };

  getActiveFilter() {
    const {location} = this.props;

    const dataFilter = location.query.dataFilter
      ? decodeScalar(location.query.dataFilter)
      : FILTER_OPTIONS[0].value;
    return FILTER_OPTIONS.find(item => item.value === dataFilter) || FILTER_OPTIONS[0];
  }

  handleFilterChange = (value: string) => {
    const {location} = this.props;

    const query = {
      ...location.query,
      cursor: undefined,
      dataFilter: value,
    };
    // reset all zoom parameters when changing the filter
    ZOOM_KEYS.forEach(key => delete query[key]);

    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };

  render() {
    const {transactionName, location, eventView, projects, organization} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query) || '';
    const activeFilter = this.getActiveFilter();

    const isZoomed = ZOOM_KEYS.map(key => location.query[key]).some(
      value => value !== undefined
    );

    return (
      <React.Fragment>
        <TransactionHeader
          eventView={eventView}
          location={location}
          organization={organization}
          projects={projects}
          transactionName={transactionName}
          currentTab={Tab.RealUserMonitoring}
          handleIncompatibleQuery={this.handleIncompatibleQuery}
        />
        <Layout.Body>
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main fullWidth>
            <StyledActions>
              <StyledSearchBar
                organization={organization}
                projectIds={eventView.project}
                query={query}
                fields={eventView.fields}
                onSearch={this.handleSearch}
              />
              <DropdownControl
                buttonProps={{prefix: t('Filter')}}
                label={activeFilter.label}
              >
                {FILTER_OPTIONS.map(({label, value}) => (
                  <DropdownItem
                    key={value}
                    onSelect={this.handleFilterChange}
                    eventKey={value}
                    isActive={value === activeFilter.value}
                  >
                    {label}
                  </DropdownItem>
                ))}
              </DropdownControl>
              <Button
                onClick={this.handleResetView}
                disabled={!isZoomed}
                data-test-id="reset-view"
              >
                {t('Reset View')}
              </Button>
            </StyledActions>
            <TransactionVitals
              organization={organization}
              location={location}
              eventView={eventView}
              dataFilter={activeFilter.value}
            />
          </Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledActions = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: auto max-content max-content;
  align-items: center;
  margin-bottom: ${space(3)};
`;

export default RumContent;
