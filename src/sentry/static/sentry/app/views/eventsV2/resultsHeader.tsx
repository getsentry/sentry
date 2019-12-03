import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

import {Organization, SavedQuery} from 'app/types';
import {fetchSavedQuery} from 'app/actionCreators/discoverSavedQueries';

import {Client} from 'app/api';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import DiscoverBreadcrumb from './breadcrumb';
import EventInputName from './eventInputName';
import EventView from './eventView';
import SavedQueryButtonGroup from './savedQuery';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  eventView: EventView;
};

type State = {
  savedQuery: SavedQuery | undefined;
  loading: boolean;
};

class ResultsHeader extends React.Component<Props, State> {
  state = {
    savedQuery: undefined,
    loading: true,
  };

  componentDidMount() {
    if (this.props.eventView.id) {
      this.fetchData();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.eventView.id !== this.props.eventView.id && this.props.eventView.id) {
      this.fetchData();
    }
  }

  fetchData() {
    const {api, eventView, organization} = this.props;
    if (typeof eventView.id === 'string') {
      this.setState({loading: true});
      fetchSavedQuery(api, organization.slug, eventView.id).then(savedQuery => {
        this.setState({savedQuery, loading: false});
      });
    }
  }

  render() {
    const {organization, location, eventView} = this.props;
    const {savedQuery, loading} = this.state;

    return (
      <HeaderBox>
        <DiscoverBreadcrumb
          eventView={eventView}
          organization={organization}
          location={location}
        />
        <EventInputName
          savedQuery={savedQuery}
          organization={organization}
          eventView={eventView}
        />
        <Controller>
          <SavedQueryButtonGroup
            location={location}
            organization={organization}
            eventView={eventView}
            savedQuery={savedQuery}
            savedQueryLoading={loading}
          />
        </Controller>
      </HeaderBox>
    );
  }
}

const HeaderBox = styled(PageContent)`
  background-color: ${p => p.theme.white};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  grid-row-gap: ${space(1)};

  /* app container is a flex box */
  flex-grow: 0;
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: 65% auto;
    grid-column-gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: auto 350px;
  }
`;

const Controller = styled('div')`
  justify-self: end;
  grid-row: 1/3;
  grid-column: 2/3;
`;

export default withApi(ResultsHeader);
