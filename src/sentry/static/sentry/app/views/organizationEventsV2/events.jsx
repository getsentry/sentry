import React from 'react';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import styled from 'react-emotion';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import SearchBar from 'app/views/organizationEvents/searchBar';
import AsyncComponent from 'app/components/asyncComponent';
import Pagination from 'app/components/pagination';
import {Panel} from 'app/components/panels';
import EventsChart from 'app/views/organizationEvents/eventsChart';

import {getParams} from 'app/views/organizationEvents/utils/getParams';

import Table from './table';
import Tags from './tags';
import {getQuery} from './utils';

class Events extends AsyncComponent {
  static propTypes = {
    router: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };

  state = {
    zoomed: false,
  };

  getEndpoints() {
    const {organization, view} = this.props;
    return [
      [
        'data',
        `/organizations/${organization.slug}/events/`,
        {
          query: getQuery(view),
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

  handleZoom = () => this.setState({zoomed: true});

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
          <EventsChart
            router={router}
            query={location.query.query}
            organization={organization}
            onZoom={this.handleZoom}
          />
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
            />
            <Pagination pageLinks={dataPageLinks} />
          </div>
          <Tags view={view} />
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

export default withRouter(Events);
