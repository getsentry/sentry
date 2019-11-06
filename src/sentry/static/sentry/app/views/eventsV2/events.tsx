import React from 'react';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import {omit, uniqBy} from 'lodash';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Organization} from 'app/types';
import space from 'app/styles/space';
import SearchBar from 'app/views/events/searchBar';
import {Panel} from 'app/components/panels';
import EventsChart from 'app/views/events/eventsChart';
import getDynamicText from 'app/utils/getDynamicText';

import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';

import Table from './table';
import Tags from './tags';
import EventView, {Field} from './eventView';

const CHART_AXIS_OPTIONS = [
  {label: 'count', value: 'count(id)'},
  {label: 'users', value: 'count_unique(user)'},
];

type EventsProps = {
  router: ReactRouter.InjectedRouter;
  location: Location;
  organization: Organization;
  eventView: EventView;
};

export default class Events extends React.Component<EventsProps> {
  handleSearch = (query: string) => {
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

  handleYAxisChange = (value: string) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      yAxis: value,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    trackAnalyticsEvent({
      eventKey: 'discover_v2.y_axis_change',
      eventName: "Discoverv2: Change chart's y axis",
      organization_id: this.props.organization.id,
      y_axis_value: value,
    });
  };

  renderTagsTable = () => {
    const {organization, eventView, location} = this.props;

    if (eventView.tags.length <= 0) {
      return null;
    }

    return <Tags eventView={eventView} organization={organization} location={location} />;
  };

  render() {
    const {organization, eventView, location, router} = this.props;
    const query = location.query.query || '';

    // Make option set and add the default options in.
    const yAxisOptions = uniqBy(
      eventView
        .getAggregateFields()
        // Exclude last_seen and latest_event as they don't produce useful graphs.
        .filter(
          (field: Field) => ['last_seen', 'latest_event'].includes(field.field) === false
        )
        .map((field: Field) => {
          return {label: field.title, value: field.field};
        })
        .concat(CHART_AXIS_OPTIONS),
      'value'
    );

    return (
      <React.Fragment>
        <StyledSearchBar
          organization={organization}
          query={query}
          onSearch={this.handleSearch}
        />
        <Panel>
          {getDynamicText({
            value: (
              <EventsChart
                router={router}
                query={eventView.getEventsAPIPayload(location).query}
                organization={organization}
                showLegend
                yAxisOptions={yAxisOptions}
                yAxisValue={eventView.yAxis}
                onYAxisChange={this.handleYAxisChange}
              />
            ),
            fixed: 'events chart',
          })}
        </Panel>
        <Container hasTags={eventView.tags.length > 0}>
          <Table organization={organization} eventView={eventView} location={location} />
          {this.renderTagsTable()}
        </Container>
      </React.Fragment>
    );
  }
}

const Container = styled('div')<{hasTags: boolean}>`
  display: grid;
  grid-gap: ${space(2)};

  ${props => {
    if (props.hasTags) {
      return 'grid-template-columns: auto 300px;';
    }

    return 'grid-template-columns: auto;';
  }};
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;
