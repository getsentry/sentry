import React from 'react';
import {Location} from 'history';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';

import space from 'app/styles/space';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {extractAnalyticsQueryFields} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Button from 'app/components/button';
import {Organization} from 'app/types';
import {
  deleteSavedQuery,
  updateSavedQuery,
} from 'app/actionCreators/discoverSavedQueries';
import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';
import withApi from 'app/utils/withApi';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';
import {addSuccessMessage} from 'app/actionCreators/indicator';

import EventView from './eventView';
import EventsSaveQueryButton from './saveQueryButton';

type Props = {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
  savedQueries: SavedQuery[];
};

class SavedQueryButtonGroup extends React.Component<Props> {
  getExistingSavedQuery = (): EventView | undefined => {
    const {savedQueries, eventView} = this.props;

    const index = savedQueries.findIndex(needle => {
      return needle.id === eventView.id;
    });

    if (index < 0) {
      return undefined;
    }

    const savedQuery = savedQueries[index];

    return EventView.fromSavedQuery(savedQuery);
  };

  isEditingExistingQuery = (): boolean => {
    const {eventView} = this.props;

    const isValidId = typeof eventView.id === 'string';

    return !!this.getExistingSavedQuery() && isValidId;
  };

  deleteQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isEditingExistingQuery()) {
      return;
    }

    const {organization, api, eventView} = this.props;

    deleteSavedQuery(api, organization.slug, eventView.id!).then(() => {
      addSuccessMessage(t('Query deleted'));

      // redirect to the primary discover2 page

      browserHistory.push({
        pathname: location.pathname,
        query: {},
      });

      trackAnalyticsEvent({
        eventKey: 'discover_v2.delete_query',
        eventName: 'Discoverv2: Deleting a saved query',
        organization_id: organization.id,
        ...extractAnalyticsQueryFields(eventView.toNewQuery()),
      });
    });
  };

  renderDeleteButton = () => {
    if (!this.isEditingExistingQuery()) {
      return null;
    }

    return <Button icon="icon-trash" onClick={this.deleteQuery} />;
  };

  handleSaveQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isEditingExistingQuery()) {
      return;
    }

    const {organization, api, eventView} = this.props;

    const payload = eventView.toNewQuery();

    updateSavedQuery(api, organization.slug, payload).then(_saved => {
      addSuccessMessage(t('Query updated'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_query',
        eventName: 'Discoverv2: Updating a saved query',
        organization_id: organization.id,
        ...extractAnalyticsQueryFields(payload),
      });
      // NOTE: there is no need to convert _saved into an EventView and push it
      //       to the browser history, since this.props.eventView already
      //       derives from location.
    });
  };

  isQueryModified = (): boolean => {
    const previousSavedQuery = this.getExistingSavedQuery();

    if (!previousSavedQuery) {
      return false;
    }

    const {eventView} = this.props;

    return !eventView.isEqualTo(previousSavedQuery);
  };

  renderSaveButton = () => {
    if (!this.isEditingExistingQuery()) {
      return null;
    }

    return (
      <Button disabled={!this.isQueryModified()} onClick={this.handleSaveQuery}>
        {t('Update query')}
      </Button>
    );
  };

  render() {
    const {location, organization, eventView, savedQueries} = this.props;

    return (
      <ButtonGroup>
        {this.renderDeleteButton()}
        <EventsSaveQueryButton
          location={location}
          organization={organization}
          eventView={eventView}
          savedQueries={savedQueries}
          isEditingExistingQuery={this.isEditingExistingQuery()}
        />
        {this.renderSaveButton()}
      </ButtonGroup>
    );
  }
}

const ButtonGroup = styled('div')`
  display: flex;

  > * + * {
    margin-left: ${space(1)};
  }
`;

export default withApi(withDiscoverSavedQueries(SavedQueryButtonGroup));
