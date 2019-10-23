import React from 'react';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import {omit} from 'lodash';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import SearchBar from 'app/views/events/searchBar';
import {Panel} from 'app/components/panels';
import EventsChart from 'app/views/events/eventsChart';
import getDynamicText from 'app/utils/getDynamicText';

import {getParams} from 'app/views/events/utils/getParams';

import Table from './table';
import Tags from './tags';
import EventView from './eventView';

const CHART_AXIS_OPTIONS = [
  {label: 'Count', value: 'event_count'},
  {label: 'Users', value: 'user_count'},
];

type EventsProps = {
  router: ReactRouter.InjectedRouter;
  location: Location;
  organization: Organization;
  eventView: EventView;
};

export default class Events extends React.Component<EventsProps> {
  handleSearch = query => {
    const {router, location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    router.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  render() {
    const {organization, eventView, location, router} = this.props;
    const query = location.query.query || '';

    return (
      <React.Fragment>
        <Panel>
          {getDynamicText({
            value: (
              <EventsChart
                router={router}
                query={eventView.getEventsAPIPayload(location).query}
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
          <Table organization={organization} location={location} />
          <Tags eventView={eventView} organization={organization} location={location} />
        </Container>
      </React.Fragment>
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
