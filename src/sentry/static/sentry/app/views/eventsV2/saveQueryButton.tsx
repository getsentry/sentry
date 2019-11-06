import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import {t} from 'app/locale';
import {extractAnalyticsQueryFields} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {createSavedQuery} from 'app/actionCreators/discoverSavedQueries';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import DropdownControl from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';
import Button from 'app/components/button';
import Input from 'app/components/forms/input';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';

import EventView from './eventView';

type Props = {
  api: Client;
  organization: Organization;
  eventView: EventView;
  location: Location;
  savedQueries: SavedQuery[];
  isEditingExistingQuery: boolean;
};

type State = {
  queryName: string;
};

// Used for resolving the event name for an analytics event
const EVENT_NAME_EXISTING_MAP = {
  request: 'Discoverv2: Request to save a saved query as a new query',
  success: 'Discoverv2: Successfully saved a saved query as a new query',
  failed: 'Discoverv2: Failed to save a saved query as a new query',
};
const EVENT_NAME_NEW_MAP = {
  request: 'Discoverv2: Request to save a new query',
  success: 'Discoverv2: Successfully saved a new query',
  failed: 'Discoverv2: Failed to save a new query',
};

class EventsSaveQueryButton extends React.Component<Props, State> {
  state = {
    queryName: '',
  };

  swallowEvent = (event: React.MouseEvent) => {
    // Stop propagation for the input and container so
    // people can interact with the inputs in the dropdown.
    const capturedElements = ['LI', 'INPUT'];
    if (
      event.target instanceof Element &&
      capturedElements.includes(event.target.nodeName)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  handleSave = () => {
    const {api, eventView, organization, location} = this.props;

    const payload = eventView.toNewQuery();
    if (this.state.queryName) {
      payload.name = this.state.queryName;
    }

    const editingExistingQuery = this.props.isEditingExistingQuery;
    trackAnalyticsEvent({
      ...this.getAnalyticsEventKeyName(editingExistingQuery, 'request'),
      organization_id: organization.id,
      ...extractAnalyticsQueryFields(payload),
    });

    createSavedQuery(api, organization.slug, payload)
      .then(saved => {
        const view = EventView.fromSavedQuery(saved);
        addSuccessMessage(t('Query saved'));

        browserHistory.push({
          pathname: location.pathname,
          query: view.generateQueryStringObject(),
        });

        trackAnalyticsEvent({
          ...this.getAnalyticsEventKeyName(editingExistingQuery, 'success'),
          organization_id: organization.id,
          ...extractAnalyticsQueryFields(payload),
        });
      })
      .catch((err: Error) => {
        trackAnalyticsEvent({
          ...this.getAnalyticsEventKeyName(editingExistingQuery, 'failed'),
          organization_id: organization.id,
          ...extractAnalyticsQueryFields(payload),
          error:
            (err && err.message) ||
            `Could not save a ${editingExistingQuery ? 'existing' : 'new'} query`,
        });
      });
  };

  handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    this.setState({queryName: value});
  };

  getAnalyticsEventKeyName(
    editingExistingQuery: boolean,
    type: 'request' | 'success' | 'failed'
  ) {
    const eventKey =
      (editingExistingQuery
        ? 'discover_v2.save_existing_query_'
        : 'discover_v2.save_new_query_') + type;

    const eventName = editingExistingQuery
      ? EVENT_NAME_EXISTING_MAP[type]
      : EVENT_NAME_NEW_MAP[type];

    return {
      eventKey,
      eventName,
    };
  }

  render() {
    const newQueryLabel = this.props.isEditingExistingQuery
      ? t('Save as...')
      : t('Save query');

    return (
      <DropdownControl
        alignRight
        menuWidth="220px"
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps({isStyled: true})}
            isOpen={isOpen}
            showChevron={false}
          >
            <StyledInlineSvg src="icon-star" size="14" />
            {newQueryLabel}
          </StyledDropdownButton>
        )}
      >
        <SaveQueryContainer onClick={this.swallowEvent}>
          <StyledInput
            type="text"
            placeholder={t('Display name')}
            value={this.state.queryName}
            onChange={this.handleInputChange}
          />
          <StyledSaveButton size="small" onClick={this.handleSave} priority="primary">
            {t('Save')}
          </StyledSaveButton>
        </SaveQueryContainer>
      </DropdownControl>
    );
  }
}

const SaveQueryContainer = styled('li')`
  padding: ${space(1)};
`;

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: 0.33em;
`;

const StyledInput = styled(Input)`
  width: 100%;
  margin-bottom: ${space(1)};
`;

const StyledSaveButton = styled(Button)`
  width: 100%;
`;

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
`;

export default withApi(EventsSaveQueryButton);
