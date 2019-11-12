import React from 'react';
import PropTypes from 'prop-types';
import {Params} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import styled, {css} from 'react-emotion';
import omit from 'lodash/omit';
import DocumentTitle from 'react-document-title';
import {Location} from 'history';

import {t} from 'app/locale';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import NoProjectMessage from 'app/components/noProjectMessage';
import {Organization, Event} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import LoadingMask from 'app/components/loadingMask';
import ModalDialog from 'app/components/modalDialog';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withOrganization from 'app/utils/withOrganization';

import {EventQuery} from '../utils';
import EventModalContent from '../eventModalContent';
import EventView from '../eventView';
import EventDetailsContent from './content';

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
  params: Params;
};

class EventDetails extends React.Component<Props> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
  };

  getEventSlug = (): string => {
    const {eventSlug} = this.props.params;

    if (typeof eventSlug === 'string') {
      return eventSlug.trim();
    }

    return '';
  };

  getEventView = (): EventView => {
    const {location} = this.props;

    return EventView.fromLocation(location);
  };

  getDocumentTitle = (name: string | undefined): Array<string> => {
    return typeof name === 'string' && String(name).trim().length > 0
      ? [String(name).trim(), t('Discover')]
      : [t('Discover')];
  };

  render() {
    const {organization, location, params} = this.props;
    const eventView = this.getEventView();

    const documentTitle = this.getDocumentTitle(eventView.name).join(' - ');

    return (
      <DocumentTitle title={`${documentTitle} - ${organization.slug} - Sentry`}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <PageContent>
            <NoProjectMessage organization={organization}>
              <EventDetailsContent
                organization={organization}
                location={location}
                params={params}
                eventSlug={this.getEventSlug()}
              />
            </NoProjectMessage>
          </PageContent>
        </React.Fragment>
      </DocumentTitle>
    );
  }
}

type State2 = {
  event: Event;
};

export class EventDetails2 extends AsyncComponent<
  Props,
  State2 & AsyncComponent['state']
> {
  shouldReload = true;

  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
  };

  getEventSlug = (): string => {
    const {eventSlug} = this.props.params;

    if (typeof eventSlug === 'string') {
      return eventSlug.trim();
    }

    return '';
  };

  getEventView(): EventView {
    const {location} = this.props;

    return EventView.fromLocation(location);
  }

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {organization, params, location} = this.props;
    const {eventSlug} = params;
    const eventView = this.getEventView();

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
    return this.getEventSlug().split(':')[0];
  }

  renderBody() {
    const {organization, location} = this.props;
    const {event, reloading} = this.state;

    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        {reloading && <StyledLoadingMask />}
        <EventModalContent
          event={event}
          projectId={this.projectId}
          organization={organization}
          eventView={this.getEventView()}
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

export default withOrganization(EventDetails);

const StyledLoadingMask = styled(LoadingMask)`
  z-index: 999999999;
  opacity: 0.8;
`;
