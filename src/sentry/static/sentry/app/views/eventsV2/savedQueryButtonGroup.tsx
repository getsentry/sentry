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

class SavedQueryButtonGroup extends React.Component<Props> {
  isEditingExistingQuery = (): boolean => {
    const {savedQueries, eventView} = this.props;

    const index = savedQueries.findIndex(needle => {
      return needle.id === eventView.id;
    });

    return index >= 0;
  };

  render() {
    const {location, organization, eventView, savedQueries} = this.props;

    return (
      <ButtonGroup>
        <Button icon="icon-trash" />
        <EventsSaveQueryButton
          location={location}
          organization={organization}
          eventView={eventView}
          savedQueries={savedQueries}
          isEditingExistingQuery={this.isEditingExistingQuery()}
        />
      </ButtonGroup>
    );
  }
}

const ButtonGroup = styled('div')`
  > * + * {
    margin-left: 8px;
  }
`;

export default withDiscoverSavedQueries(SavedQueryButtonGroup);
