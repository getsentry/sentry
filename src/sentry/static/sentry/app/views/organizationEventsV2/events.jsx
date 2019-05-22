import React from 'react';
import styled from 'react-emotion';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import SearchBar from 'app/views/organizationEvents/searchBar';
import AsyncComponent from 'app/components/asyncComponent';

import Table from './table';
import Tags from './tags';
import {getQuery} from './utils';

export default class Events extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };

  getEndpoints() {
    const {organization, view} = this.props;
    return [
      [
        'events',
        `/organizations/${organization.slug}/events/`,
        {
          query: getQuery(view),
        },
      ],
    ];
  }

  renderBody() {
    const {organization, view} = this.props;
    const {events} = this.state;

    return (
      <Container>
        <div>
          <StyledSearchBar organization={organization} />
          <Table view={view} organization={organization} data={events} />
        </div>
        <Tags view={view} />
      </Container>
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
