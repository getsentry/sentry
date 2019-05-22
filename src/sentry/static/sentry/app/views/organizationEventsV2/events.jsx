import React from 'react';
import styled from 'react-emotion';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import SearchBar from 'app/views/organizationEvents/searchBar';

import Table from './table';
import Tags from './tags';

export default class Events extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };
  render() {
    const {organization, view} = this.props;
    return (
      <Container>
        <div>
          <StyledSearchBar organization={organization} />
          <Table view={view} organization={organization} />
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
