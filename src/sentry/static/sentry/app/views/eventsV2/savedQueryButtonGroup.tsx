import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';

import EventView from './eventView';
import EventsSaveQueryButton from './saveQueryButton';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
};

const SavedQueryButtonGroup = (props: Props) => {
  const {location, organization, eventView} = props;

  return (
    <EventsSaveQueryButton
      location={location}
      organization={organization}
      eventView={eventView}
    />
  );
};

export default SavedQueryButtonGroup;
