import React from 'react';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import {omit} from 'lodash';
import {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import AsyncComponent from 'app/components/asyncComponent';
import ModalDialog from 'app/components/modalDialog';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';
import space from 'app/styles/space';

import EventModalContent from './eventModalContent';
import {getQuery} from './utils';

const slugValidator = function(props, propName, componentName) {
  const value = props[propName];
  // Accept slugs that look like:
  // * project-slug:deadbeef:latest
  // * project-slug:deadbeef:oldest
  // * project-slug:deadbeef
  if (value && !/^(?:[^:]+):(?:[a-f0-9]+)(?:\:latest|oldest)?$/.test(value)) {
    return new Error(`Invalid value for ${propName} provided to ${componentName}.`);
  }
  return null;
};

const modalStyles = css`
  top: 0px;
  left: 0px;
  right: 0px;

  margin: ${space(3)};
  padding: ${space(3)};

  @media (max-width: ${theme.breakpoints[1]}) {
    margin: ${space(2)};
  }
`;

class EventDetails extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
    view: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {organization, eventSlug, view, location} = this.props;
    const query = getQuery(view, location);

    // Check the eventid for the latest/oldest keyword and use that to choose
    // the endpoint as oldest/latest have special endpoints.
    const [projectId, eventId, keyword] = eventSlug.toString().split(':');

    let url = `/organizations/${organization.slug}/events/`;
    // TODO the latest/oldest links are currently broken as they require a
    // new endpoint that works with the upcoming discover2 queries.
    if (['latest', 'oldest'].includes(keyword)) {
      url += `${keyword}/`;
    } else {
      url += `${projectId}:${eventId}/`;
    }

    // Get a specific event. This could be coming from
    // a paginated group or standalone event.
    return [['event', url, {query}]];
  }

  onDismiss = () => {
    const {location} = this.props;
    // Remove modal related query parameters.
    const query = omit(location.query, ['eventSlug']);

    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  renderBody() {
    const {organization, view, location} = this.props;
    const {event} = this.state;

    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        <EventModalContent
          onTabChange={this.handleTabChange}
          event={event}
          projectId={this.projectId}
          organization={organization}
          view={view}
          location={location}
        />
      </ModalDialog>
    );
  }

  renderLoading() {
    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        {super.renderLoading()}
      </ModalDialog>
    );
  }
}

export default withApi(EventDetails);
