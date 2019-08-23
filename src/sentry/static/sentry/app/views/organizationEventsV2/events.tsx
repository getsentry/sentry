import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {omit, isEqual} from 'lodash';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {Organization, EventView} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import SearchBar from 'app/views/events/searchBar';
import AsyncComponent from 'app/components/asyncComponent';
import Pagination from 'app/components/pagination';
import {Panel} from 'app/components/panels';
import EventsChart from 'app/views/events/eventsChart';
import getDynamicText from 'app/utils/getDynamicText';

import {getParams} from 'app/views/events/utils/getParams';

import Table from './table';
import Discover2Table from './discover2table';
import Tags from './tags';
import {getQuery, EventQuery} from './utils';
import {MODAL_QUERY_KEYS} from './data';

const CHART_AXIS_OPTIONS = [
  {label: 'Count', value: 'event_count'},
  {label: 'Users', value: 'user_count'},
];

type EventsProps = {
  router: ReactRouter.InjectedRouter;
  location: Location;
  organization: Organization;
  view: EventView;
};

export default class Events extends React.Component<EventsProps> {
  static propTypes = {
    router: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };

  handleSearch = query => {
    const {router, location} = this.props;
    router.push({
      pathname: location.pathname,
      query: getParams({
        ...(location.query || {}),
        query,
      }),
    });
  };

  render() {
    const {organization, view, location, router} = this.props;
    const query = location.query.query || '';

    return (
      <React.Fragment>
        <Panel>
          {getDynamicText({
            value: (
              <EventsChart
                router={router}
                query={getQuery(view, location).query}
                organization={organization}
                showLegend
                yAxisOptions={CHART_AXIS_OPTIONS}
              />
            ),
            fixed: 'events chart',
          })}
        </Panel>
        <StyledSearchBar
          organization={organization}
          query={query}
          onSearch={this.handleSearch}
        />
        <Container>
          <Discover2Table organization={organization} location={location} />
          <EventsTable organization={organization} location={location} view={view} />
          <Tags view={view} organization={organization} location={location} />
        </Container>
      </React.Fragment>
    );
  }
}

type EventsTableProps = {
  location: Location;
  organization: Organization;
  view: EventView;
};

// TODO: refactor this
export class EventsTable extends AsyncComponent<EventsTableProps> {
  static propTypes = {
    location: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };

  shouldReload = false;

  componentDidUpdate(prevProps: EventsTableProps, prevContext) {
    // Do not update if we are just opening/closing the modal
    const locationHasChanged = !isEqual(
      omit(prevProps.location.query, MODAL_QUERY_KEYS),
      omit(this.props.location.query, MODAL_QUERY_KEYS)
    );

    if (locationHasChanged) {
      super.componentDidUpdate(prevProps, prevContext);
    }
  }

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {location, organization, view} = this.props;

    return [
      [
        'data',
        `/organizations/${organization.slug}/eventsv2/`,
        {
          query: getQuery(view, location),
        },
      ],
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, view, location} = this.props;
    const {data, dataPageLinks, loading} = this.state;

    return (
      <div>
        <Table
          view={view}
          organization={organization}
          data={data}
          isLoading={loading}
          location={location}
        />
        <Pagination pageLinks={dataPageLinks} />
      </div>
    );
  }
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: auto 300px;
  grid-gap: ${space(2)};
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;
