import {Params} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import styled, {css} from 'react-emotion';
import {omit} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {Location} from 'history';
import {Organization, Event} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import LoadingMask from 'app/components/loadingMask';
import ModalDialog from 'app/components/modalDialog';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import {EventQuery} from './utils';
import EventModalContent from './eventModalContent';
import EventView from './eventView';

const slugValidator = function(
  props: {[key: string]: any},
  propName: string,
  componentName: string
) {
  const value = props[propName];
  // Accept slugs that look like:
  // * project-slug:deadbeef
  if (value && typeof value === 'string' && !/^(?:[^:]+):(?:[a-f0-9-]+)$/.test(value)) {
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
  params: Params;
  eventView: EventView;
};

type State = {
  event: Event;
};

class EventDetails extends AsyncComponent<Props, State & AsyncComponent['state']> {
  shouldReload = true;

  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
  };

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {organization, eventSlug, eventView, location} = this.props;
    const query = eventView.getEventsAPIPayload(location);
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
    const {organization, eventView, location} = this.props;
    const {event, reloading} = this.state;

    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        {reloading && <StyledLoadingMask />}
        <EventModalContent
          event={event}
          projectId={this.projectId}
          organization={organization}
          eventView={eventView}
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

export default EventDetails;

const StyledLoadingMask = styled(LoadingMask)`
  z-index: 999999999;
  opacity: 0.8;
`;
