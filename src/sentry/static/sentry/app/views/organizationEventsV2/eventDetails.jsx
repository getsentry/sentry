import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import {omit} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import AsyncComponent from 'app/components/asyncComponent';
import InlineSvg from 'app/components/inlineSvg';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';

import EventModalContent from './eventModalContent';
import {getQuery} from './utils';

const slugValidator = function(props, propName, componentName) {
  const value = props[propName];
  // Accept slugs that look like:
  // * project-slug:123:latest
  // * project-slug:123:oldest
  // * project-slug:123:deadbeef
  // * project-slug:deadbeef
  if (value && !/^(?:[^:]+:)?(?:[^:]+):(?:[a-f0-9]+|latest|oldest)$/.test(value)) {
    return new Error(`Invalid value for ${propName} provided to ${componentName}.`);
  }
  return null;
};

class EventDetails extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    groupSlug: slugValidator,
    location: PropTypes.object.isRequired,
    view: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {organization, eventSlug, groupSlug, view, location} = this.props;
    const query = getQuery(view, location);

    // If we're getting an issue/group use the latest endpoint.
    // We pass the current query/view state to the API so we get an
    // event that matches the current list filters.
    if (groupSlug) {
      const [projectId, groupId, eventId] = groupSlug.toString().split(':');

      let url = `/organizations/${organization.slug}/events/`;
      // latest / oldest have dedicated endpoints
      if (['latest', 'oldest'].includes(eventId)) {
        url += 'latest/';
      } else {
        url += `${projectId}:${eventId}/`;
      }
      if (query.query) {
        query.query += ` issue.id:${groupId}`;
      } else {
        query.query = `issue.id:${groupId}`;
      }

      return [['event', url, {query}]];
    }

    // Get a specific event. This could be coming from
    // a paginated group or standalone event.
    const [projectId, eventId] = eventSlug.toString().split(':');
    return [
      [
        'event',
        `/organizations/${organization.slug}/events/${projectId}:${eventId}/`,
        {query},
      ],
    ];
  }

  onRequestSuccess({data}) {
    // Select the first interface as the active sub-tab
    this.setState({activeTab: data.entries[0].type});
  }

  handleClose = event => {
    event.preventDefault();
    const {location} = this.props;
    // Remove modal related query parameters.
    const query = omit(location.query, ['groupSlug', 'eventSlug']);

    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };

  handleTabChange = tab => this.setState({activeTab: tab});

  get projectId() {
    if (this.props.eventSlug) {
      const [projectId] = this.props.eventSlug.split(':');
      return projectId;
    }
    if (this.props.groupSlug) {
      const [projectId] = this.props.groupSlug.split(':');
      return projectId;
    }
    throw new Error('Could not determine projectId');
  }

  componentDidMount() {
    document.body.style.overflow = 'hidden';
  }

  componentWillUnmount() {
    document.body.style.overflow = 'auto';
  }

  renderBody() {
    const {organization, view, location} = this.props;
    const {event, activeTab} = this.state;

    return (
      <ModalContainer>
        <CloseButton onClick={this.handleClose} size={30} />
        <EventModalContent
          onTabChange={this.handleTabChange}
          event={event}
          activeTab={activeTab}
          projectId={this.projectId}
          organization={organization}
          view={view}
          location={location}
        />
      </ModalContainer>
    );
  }

  renderLoading() {
    return (
      <ModalContainer>
        <CloseButton onClick={this.handleClose} size={30} />
        {super.renderLoading()}
      </ModalContainer>
    );
  }
}

const ModalContainer = styled('div')`
  position: fixed;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
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
