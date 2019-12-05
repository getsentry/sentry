import React from 'react';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';
import uniqBy from 'lodash/uniqBy';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Organization} from 'app/types';
import SearchBar from 'app/views/events/searchBar';
import {Panel} from 'app/components/panels';
import EventsChart from 'app/views/events/eventsChart';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

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
        <Top>
          <StyledSearchBar
            organization={organization}
            projectIds={eventView.project}
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
                  project={eventView.project as number[]}
                  environment={eventView.environment as string[]}
                />
              ),
              fixed: 'events chart',
            })}
          </Panel>
        </Top>
        <Main eventView={eventView}>
          <Table organization={organization} eventView={eventView} location={location} />
        </Main>
        <Side eventView={eventView}>{this.renderTagsTable()}</Side>
      </React.Fragment>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const Top = styled('div')`
  grid-column: 1/3;
`;

const Main = styled('div')<{eventView: EventView}>`
  grid-column: ${p => (p.eventView.tags.length <= 0 ? '1/3' : '1/2')};
`;

const Side = styled('div')<{eventView: EventView}>`
  grid-column: ${p => (p.eventView.tags.length <= 0 ? 'none' : '2/3')};
`;
