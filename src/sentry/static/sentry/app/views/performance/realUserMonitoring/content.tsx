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
import {Organization, Project, SelectValue} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import SearchBar from 'app/views/events/searchBar';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';

import TransactionVitals from './transactionVitals';
import TransactionHeader, {Tab} from '../transactionSummary/header';

const FILTER_OPTIONS: SelectValue<string>[] = [
  {label: t('Upper outer fence'), value: 'upper_outer_fence'},
  {label: t('Upper inner fence'), value: 'upper_inner_fence'},
  {label: t('P90'), value: 'p90'},
  {label: t('P95'), value: 'p95'},
  {label: t('P99'), value: 'p99'},
  {label: t('All'), value: 'all'},
];

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

    const queryParams = getParams({
      ...(location.query || {}),
    });

    // reset the zoom parameters
    delete queryParams.startMeasurements;
    delete queryParams.endMeasurements;

    browserHistory.push({
      pathname: location.pathname,
      query: queryParams,
    });
  };

  getActiveFilter() {
    const {location} = this.props;

    const dataFilter = location.query.data_filter
      ? decodeScalar(location.query.data_filter)
      : 'upper_outer_fence';
    return FILTER_OPTIONS.find(item => item.value === dataFilter) || FILTER_OPTIONS[0];
  }

  handleFilterChange = (value: string) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        data_filter: value,
      },
    });
  };

  render() {
    const {transactionName, location, eventView, projects, organization} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query) || '';
    const activeFilter = this.getActiveFilter();

    const isZoomed =
      decodeScalar(location.query.startMeasurements) !== undefined ||
      decodeScalar(location.query.endMeasurements) !== undefined;

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
              <Button
                onClick={this.handleResetView}
                disabled={!isZoomed}
                data-test-id="reset-view"
              >
                {t('Reset View')}
              </Button>
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
  grid-template-columns: auto max-content;
  align-items: center;
  margin-bottom: ${space(3)};
`;

export default RumContent;
