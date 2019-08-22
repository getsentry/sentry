import React from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import {Params} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import {omit} from 'lodash';
import {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import AsyncComponent from 'app/components/asyncComponent';
import ModalDialog from 'app/components/modalDialog';
import NotFound from 'app/components/errors/notFound';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import {Organization, EventView, Event} from 'app/types';

import EventModalContent from './eventModalContent';
import {EventQuery, getQuery} from './utils';

const slugValidator = function(
  props: {[key: string]: any},
  propName: string,
  componentName: string
) {
  const value = props[propName];
  // Accept slugs that look like:
  // * project-slug:deadbeef
  if (value && typeof value === 'string' && !/^(?:[^:]+):(?:[a-f0-9]+)$/.test(value)) {
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

type Props = {
  organization: Organization;
  location: Location;
  eventSlug: string;
  view: EventView;
  params: Params;
};

type State = {
  event: Event;
};

class EventDetails extends AsyncComponent<Props, State & AsyncComponent['state']> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
    view: PropTypes.object.isRequired,
  };

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {organization, eventSlug, view, location} = this.props;
    const query = getQuery(view, location);
    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

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
          event={event}
          projectId={this.projectId}
          organization={organization}
          view={view}
          location={location}
        />
      </ModalDialog>
    );
  }

  renderError(error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        {notFound ? <NotFound /> : super.renderError(error, true, true)}
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
