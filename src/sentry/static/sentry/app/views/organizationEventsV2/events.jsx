import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {omit, isEqual} from 'lodash';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import SearchBar from 'app/views/organizationEvents/searchBar';
import AsyncComponent from 'app/components/asyncComponent';
import Pagination from 'app/components/pagination';
import {Panel} from 'app/components/panels';
import EventsChart from 'app/views/organizationEvents/eventsChart';
import getDynamicText from 'app/utils/getDynamicText';

import {getParams} from 'app/views/organizationEvents/utils/getParams';

import Table from './table';
import Tags from './tags';
import {getQuery} from './utils';

const CHART_AXIS_OPTIONS = [
  {label: 'Count', value: 'event_count'},
  {label: 'Users', value: 'user_count'},
];

export default class Events extends AsyncComponent {
  static propTypes = {
    router: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };

  shouldReload = true;

  componentDidUpdate(prevProps, prevContext) {
    // Do not update if we are just opening/closing the modal
    const locationHasChanged = !isEqual(
      omit(prevProps.location.query, 'eventSlug'),
      omit(this.props.location.query, 'eventSlug')
    );

    if (locationHasChanged) {
      super.componentDidUpdate(prevProps, prevContext);
    }
  }

  getEndpoints() {
    const {location, organization, view} = this.props;
    return [
      [
        'data',
        `/organizations/${organization.slug}/events/`,
        {
          query: getQuery(view, location),
        },
      ],
    ];
  }

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

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, view, location, router} = this.props;
    const {data, dataPageLinks, loading} = this.state;
    const query = location.query.query || '';

    return (
      <React.Fragment>
        <Panel>
          {getDynamicText({
            value: (
              <EventsChart
                router={router}
                query={query}
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
          <div>
            <Table
              view={view}
              organization={organization}
              data={data}
              isLoading={loading}
              onSearch={this.handleSearch}
              location={location}
            />
            <Pagination pageLinks={dataPageLinks} />
          </div>
          <Tags view={view} organization={organization} location={location} />
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
