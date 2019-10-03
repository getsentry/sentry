import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import {t} from 'app/locale';
import {
  createSavedQuery,
  updateSavedQuery,
} from 'app/actionCreators/discoverSavedQueries';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import DropdownControl from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';
import Button from 'app/components/button';
import Input from 'app/components/forms/input';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import EventView from './eventView';

type Props = {
  api: Client;
  organization: Organization;
  eventView: EventView;
  location: Location;
  isEditing: boolean;
};

type State = {
  queryName: string;
};

class EventsSaveQueryButton extends React.Component<Props, State> {
  state = {
    queryName: '',
  };

  componentDidUpdate(prevProps: Props) {
    // Going from one query to another whilst not leaving edit mode
    if (
      (this.props.isEditing === true &&
        this.props.eventView.id !== prevProps.eventView.id) ||
      this.props.isEditing !== prevProps.isEditing
    ) {
      const queryName =
        this.props.isEditing === true ? this.props.eventView.name || '' : '';

      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({queryName});
    }
  }

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
    const {api, eventView, organization, location, isEditing} = this.props;

    const payload = eventView.toNewQuery();
    if (this.state.queryName) {
      payload.name = this.state.queryName;
    }
    let promise;
    if (isEditing) {
      promise = updateSavedQuery(api, organization.slug, payload);
    } else {
      promise = createSavedQuery(api, organization.slug, payload);
    }
    promise.then(saved => {
      const view = EventView.fromSavedQuery(saved);
      addSuccessMessage(t('Query saved'));

      browserHistory.push({
        pathname: location.pathname,
        query: view.generateQueryStringObject(),
      });
    });
  };

  handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    this.setState({queryName: value});
  };

  render() {
    const {isEditing} = this.props;
    const buttonText = isEditing ? t('Update') : t('Save');

    return (
      <DropdownControl
        alignRight={true}
        menuWidth="220px"
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps({isStyled: true})}
            isOpen={isOpen}
            showChevron={false}
          >
            <StyledInlineSvg src="icon-bookmark" size="14" />
            {t('Save Search')}
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
          <Button size="small" onClick={this.handleSave} priority="primary">
            {buttonText}
          </Button>
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

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
`;

export default withApi(EventsSaveQueryButton);
