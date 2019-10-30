import React from 'react';
import {Location} from 'history';
import styled from 'react-emotion';

import Button from 'app/components/button';
import {Organization} from 'app/types';
import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';

import EventView from './eventView';
import EventsSaveQueryButton from './saveQueryButton';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  savedQueries: SavedQuery[];
};

const SavedQueryButtonGroup = (props: Props) => {
  const {location, organization, eventView, savedQueries} = props;

  return (
    <ButtonGroup>
      <Button icon="icon-trash" />
      <EventsSaveQueryButton
        location={location}
        organization={organization}
        eventView={eventView}
        savedQueries={savedQueries}
      />
    </ButtonGroup>
  );
};

const ButtonGroup = styled('div')`
  > * + * {
    margin-left: 8px;
  }
`;

export default withDiscoverSavedQueries(SavedQueryButtonGroup);
