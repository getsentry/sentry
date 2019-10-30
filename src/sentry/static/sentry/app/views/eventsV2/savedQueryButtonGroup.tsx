import React from 'react';
import {Location} from 'history';

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
    <EventsSaveQueryButton
      location={location}
      organization={organization}
      eventView={eventView}
      savedQueries={savedQueries}
    />
  );
};

export default withDiscoverSavedQueries(SavedQueryButtonGroup);
