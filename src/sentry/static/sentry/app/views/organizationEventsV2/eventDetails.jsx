import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';

import EventModalContent from './eventModalContent';

class EventDetails extends AsyncComponent {
  static propTypes = {
    params: PropTypes.object,
    eventSlug: PropTypes.string.isRequired,
  };

  getEndpoints() {
    const {orgId} = this.props.params;
    const [projectId, eventId] = this.props.eventSlug.toString().split(':');

    return [['event', `/projects/${orgId}/${projectId}/events/${eventId}/`]];
  }

  onRequestSuccess({data}) {
    // Select the first interface as the active sub-tab
    this.setState({activeTab: data.entries[0].type});
  }

  handleClose = event => {
    event.preventDefault();
    browserHistory.goBack();
  };

  handleTabChange = tab => this.setState({activeTab: tab});

  renderBody() {
    const [projectId, _] = this.props.eventSlug.split(':');
    return (
      <ModalContainer>
        <CloseButton onClick={this.handleClose} size="zero" icon="icon-close" />
        <EventModalContent
          onTabChange={this.handleTabChange}
          event={this.state.event}
          activeTab={this.state.activeTab}
          projectId={projectId}
        />
      </ModalContainer>
    );
  }
}

const ModalContainer = styled('div')`
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  background: #fff;

  margin: ${space(2)};
  padding: ${space(3)};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};

  z-index: ${p => p.theme.zIndex.modal};
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: -10px;
  right: -10px;
  padding: 10px;
  border-radius: 20px;
  box-shadow: ${p => p.theme.dropShadowLight};
`;

export default withApi(EventDetails);
