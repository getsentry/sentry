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
  // * project-slug:123:latest
  // * project-slug:123:oldest
  // * project-slug:123:deadbeef
  // * project-slug:deadbeef
  if (value && !/^(?:[^:]+:)?(?:[^:]+):(?:[a-f0-9]+|latest|oldest)$/.test(value)) {
    return new Error(`Invalid value for ${propName} provided to ${componentName}.`);
  }
  return null;
};

const transactionValidator = function(props, propName, componentName) {
  const value = props[propName];
  // Accept slugs that look like:
  // * project-slug:/some/pathname:latest
  // * project-slug:a_bare_string:oldest
  // * project-slug:/some/otherpath:deadbeef
  if (value && !/^(?:[^:]+):(?:[^:]+):(?:[^:]+|latest|oldest)$/.test(value)) {
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
    groupSlug: slugValidator,
    transactionSlug: transactionValidator,
    location: PropTypes.object.isRequired,
    view: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {
      organization,
      eventSlug,
      groupSlug,
      transactionSlug,
      view,
      location,
    } = this.props;
    const query = getQuery(view, location);

    // If we're getting an issue/group use the latest endpoint.
    // We pass the current query/view state to the API so we get an
    // event that matches the current list filters.
    if (groupSlug) {
      const [projectId, groupId, eventId] = groupSlug.toString().split(':');

      let url = `/organizations/${organization.slug}/events/`;
      // latest / oldest have dedicated endpoints
      if (['latest', 'oldest'].includes(eventId)) {
        url += `${eventId}/`;
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

    // If we're looking at a transaction aggregate we need to do a search
    // by transaction to find the latest event for the transaction.
    if (transactionSlug) {
      const [projectId, transactionName, eventId] = transactionSlug.toString().split(':');

      let url = `/organizations/${organization.slug}/events/`;
      // latest / oldest have dedicated endpoints
      if (['latest', 'oldest'].includes(eventId)) {
        url += `${eventId}/`;
      } else {
        url += `${projectId}:${eventId}/`;
      }
      if (query.query) {
        query.query += ` transaction:${transactionName}`;
      } else {
        query.query = `transaction:${transactionName}`;
      }

      return [['event', url, {query}]];
    }

    if (eventSlug) {
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

    throw new Error('No valid datasource property found.');
  }

  onDismiss = () => {
    const {location} = this.props;
    // Remove modal related query parameters.
    const query = omit(location.query, ['transactionSlug', 'groupSlug', 'eventSlug']);

    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };

  get projectId() {
    const source =
      this.props.eventSlug || this.props.groupSlug || this.props.transactionSlug;
    if (!source) {
      throw new Error('Could not determine projectId');
    }
    return source.split(':')[0];
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
