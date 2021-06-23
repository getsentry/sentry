import * as React from 'react';
import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Alert from 'app/components/alert';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {getCurrentLandingDisplay, LandingDisplayField} from '../../landing/utils';
import Filter, {filterToSearchConditions, SpanOperationBreakdownFilter} from '../filter';
import TransactionHeader, {Tab} from '../header';

import EventsTable from './eventsTable';
import {EventsDisplayFilterName, getEventsFilterOptions} from './utils';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  projects: Project[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  onChangeSpanOperationBreakdownFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  eventsDisplayFilter: EventsDisplayFilterName;
  onChangeEventsDisplayFilter: (eventsDisplayFilter: EventsDisplayFilterName) => void;
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
  error: string | undefined;
};

class EventsPageContent extends React.Component<Props, State> {
  state: State = {
    incompatibleAlertNotice: null,
    error: undefined,
  };

  handleCellAction = (column: TableColumn<React.ReactText>) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location} = this.props;

      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      // no need to include transaction as its already in the query params
      searchConditions.removeTag('transaction');

      updateQuery(searchConditions, action, column, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: stringifyQueryObject(searchConditions),
        },
      });
    };
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, _errors) => {
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  renderError() {
    const {error} = this.state;

    if (!error) {
      return null;
    }

    return (
      <StyledAlert type="error" icon={<IconFlag size="md" />}>
        {error}
      </StyledAlert>
    );
  }

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  render() {
    let {eventView} = this.props;
    const {
      location,
      organization,
      projects,
      transactionName,
      spanOperationBreakdownFilter,
      eventsDisplayFilter,
      onChangeEventsDisplayFilter,
    } = this.props;
    const {incompatibleAlertNotice} = this.state;
    const transactionsListTitles = [
      t('event id'),
      t('user'),
      t('operation duration'),
      t('total duration'),
      t('trace id'),
      t('timestamp'),
    ];

    const spanOperationBreakdownConditions = filterToSearchConditions(
      spanOperationBreakdownFilter,
      location
    );

    if (spanOperationBreakdownConditions) {
      eventView = eventView.clone();
      eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
      transactionsListTitles.splice(2, 1, t(`${spanOperationBreakdownFilter} duration`));
    }

    return (
      <Fragment>
        <TransactionHeader
          eventView={eventView}
          location={location}
          organization={organization}
          projects={projects}
          transactionName={transactionName}
          currentTab={Tab.Events}
          hasWebVitals={
            getCurrentLandingDisplay(location, projects, eventView).field ===
            LandingDisplayField.FRONTEND_PAGELOAD
          }
          handleIncompatibleQuery={this.handleIncompatibleQuery}
        />
        <Layout.Body>
          <StyledSdkUpdatesAlert />
          {this.renderError()}
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main fullWidth>
            <Search
              {...this.props}
              onChangeEventsDisplayFilter={onChangeEventsDisplayFilter}
              eventsDisplayFilter={eventsDisplayFilter}
            />
            <StyledTable>
              <EventsTable
                eventView={eventView}
                organization={organization}
                location={location}
                setError={this.setError}
                columnTitles={transactionsListTitles}
                transactionName={transactionName}
              />
            </StyledTable>
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }
}

const Search = (props: Props) => {
  const {
    eventView,
    location,
    organization,
    spanOperationBreakdownFilter,
    onChangeSpanOperationBreakdownFilter,
    eventsDisplayFilter,
    onChangeEventsDisplayFilter,
  } = props;

  const handleSearch = (query: string) => {
    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  const query = decodeScalar(location.query.query, '');

  const eventsFilterOptions = getEventsFilterOptions(spanOperationBreakdownFilter, 1000);

  return (
    <SearchWrapper>
      <Filter
        organization={organization}
        currentFilter={spanOperationBreakdownFilter}
        onChangeFilter={onChangeSpanOperationBreakdownFilter}
      />
      <StyledSearchBar
        organization={organization}
        projectIds={eventView.project}
        query={query}
        fields={eventView.fields}
        onSearch={handleSearch}
      />
      <LatencyDropdown>
        {/* TODO */}
        <DropdownControl
          buttonProps={{prefix: t('Display')}}
          label={eventsFilterOptions[eventsDisplayFilter].label}
        >
          {/* TODO */}
          {Object.entries(eventsFilterOptions).map(([name, {label}]) => {
            return (
              <DropdownItem
                key={name}
                onSelect={onChangeEventsDisplayFilter}
                eventKey={name}
                data-test-id={name}
                isActive={eventsDisplayFilter === name}
              >
                {label}
              </DropdownItem>
            );
          })}
        </DropdownControl>
      </LatencyDropdown>
    </SearchWrapper>
  );
};

const SearchWrapper = styled('div')`
  display: flex;
  width: 100%;
  margin-bottom: ${space(3)};
`;

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledTable = styled('div')`
  flex-grow: 1;
`;

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

const LatencyDropdown = styled('div')`
  margin-left: ${space(1)};
  flex-grow: 0;
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default EventsPageContent;
