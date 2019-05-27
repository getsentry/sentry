import React from 'react';
import {withRouter} from 'react-router';
import styled from 'react-emotion';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import SearchBar from 'app/views/organizationEvents/searchBar';
import AsyncComponent from 'app/components/asyncComponent';
import Pagination from 'app/components/pagination';

import {getParams} from 'app/views/organizationEvents/utils/getParams';

import Table from './table';
import Tags from './tags';
import {getQuery} from './utils';

class Events extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
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

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, view, location} = this.props;
    const {data, dataPageLinks, loading} = this.state;
    const query = location.query.query || '';

    return (
      <div>
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

export default withRouter(Events);
