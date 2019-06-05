import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import InlineSvg from 'app/components/inlineSvg';
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
    const {orgId} = this.props.params;
    const [projectId, _] = this.props.eventSlug.split(':');
    return (
      <ModalContainer>
        <CloseButton onClick={this.handleClose} size={30} />
        <EventModalContent
          onTabChange={this.handleTabChange}
          event={this.state.event}
          activeTab={this.state.activeTab}
          projectId={projectId}
          orgId={orgId}
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

  margin: ${space(3)};
  padding: ${space(3)};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};

  z-index: ${p => p.theme.zIndex.modal};
`;

const CircleButton = styled('button')`
  background: #fff;
  border-radius: ${p => p.size / 2}px;
  padding: ${p => p.size / 4}px;
  line-height: ${p => p.size * 0.4}px;
  height: ${p => p.size}px;
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.borderDark};

  position: absolute;
  top: -${p => p.size / 2}px;
  right: -${p => p.size / 2}px;
`;

const CloseButton = props => {
  const iconSize = props.size * 0.4;
  return (
    <CircleButton size={props.size} onClick={props.onClick}>
      <InlineSvg src="icon-close" size={`${iconSize}px`} />
    </CircleButton>
  );
};
CloseButton.propTypes = {
  onClick: PropTypes.func,
  size: PropTypes.number.isRequired,
};

export default withApi(EventDetails);
