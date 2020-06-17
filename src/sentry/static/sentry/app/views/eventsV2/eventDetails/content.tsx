import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import * as SpanEntryContext from 'app/components/events/interfaces/spans/context';
import {EventQuery} from 'app/actionCreators/events';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getMessage, getTitle} from 'app/utils/events';
import {Organization, Event, EventTag} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import OpsBreakdown from 'app/components/events/opsBreakdown';
import EventMetadata from 'app/components/events/eventMetadata';
import LoadingError from 'app/components/loadingError';
import NotFound from 'app/components/errors/notFound';
import TagsTable from 'app/components/tagsTable';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import Projects from 'app/utils/projects';
import EventView from 'app/utils/discover/eventView';
import {eventDetailsRoute} from 'app/utils/discover/urls';
import {ContentBox, HeaderBox, HeaderBottomControls} from 'app/utils/discover/styles';

import {generateTitle, getExpandedResults} from '../utils';
import LinkedIssue from './linkedIssue';
import DiscoverBreadcrumb from '../breadcrumb';

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

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
  api: Client;
  eventSlug: string;
  eventView: EventView;
};

type State = {
  event: Event | undefined;
  isSidebarVisible: boolean;
} & AsyncComponent['state'];

class EventDetailsContent extends AsyncComponent<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
  };

  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],
    event: undefined,

    // local state
    isSidebarVisible: true,
  };

  toggleSidebar = () => {
    this.setState({isSidebarVisible: !this.state.isSidebarVisible});
  };

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {organization, params, location, eventView} = this.props;
    const {eventSlug} = params;

    const query = eventView.getEventsAPIPayload(location);

    // Fields aren't used, reduce complexity by omitting from query entirely
    query.field = [];

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    // Get a specific event. This could be coming from
    // a paginated group or standalone event.
    return [['event', url, {query}]];
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  generateTagUrl = (tag: EventTag) => {
    const {eventView, organization} = this.props;
    const {event} = this.state;
    if (!event) {
      return '';
    }
    const eventReference = {...event};
    if (eventReference.id) {
      delete eventReference.id;
    }

    const nextView = getExpandedResults(
      eventView,
      {[tag.key]: tag.value},
      eventReference
    );
    return nextView.getResultsViewUrlTarget(organization.slug);
  };

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return this.renderWrapper(<NotFound />);
    }

    return this.renderWrapper(this.renderContent(event));
  }

  renderContent(event: Event) {
    const {api, organization, location, eventView} = this.props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
    });

    const {isSidebarVisible} = this.state;

    return (
      <React.Fragment>
        <HeaderBox>
          <DiscoverBreadcrumb
            eventView={eventView}
            event={event}
            organization={organization}
            location={location}
          />
          <EventHeader event={event} />
          <HeaderBottomControls>
            <StyledButton size="small" onClick={this.toggleSidebar}>
              {isSidebarVisible ? 'Hide Details' : 'Show Details'}
            </StyledButton>
          </HeaderBottomControls>
        </HeaderBox>
        <ContentBox>
          <div style={{gridColumn: isSidebarVisible ? '1/2' : '1/3'}}>
            <Projects orgId={organization.slug} slugs={[this.projectId]}>
              {({projects}) => (
                <SpanEntryContext.Provider
                  value={{
                    getViewChildTransactionTarget: childTransactionProps => {
                      const childTransactionLink = eventDetailsRoute({
                        eventSlug: childTransactionProps.eventSlug,
                        orgSlug: organization.slug,
                      });

                      return {
                        pathname: childTransactionLink,
                        query: eventView.generateQueryStringObject(),
                      };
                    },
                  }}
                >
                  <BorderlessEventEntries
                    api={api}
                    organization={organization}
                    event={event}
                    project={projects[0]}
                    location={location}
                    showExampleCommit={false}
                    showTagSummary={false}
                  />
                </SpanEntryContext.Provider>
              )}
            </Projects>
          </div>
          <div style={{gridColumn: '2/3', display: isSidebarVisible ? '' : 'none'}}>
            <EventMetadata
              event={event}
              organization={organization}
              projectId={this.projectId}
            />
            <OpsBreakdown event={event} />
            {event.groupID && (
              <LinkedIssue groupId={event.groupID} eventId={event.eventID} />
            )}
            <TagsTable
              generateUrl={this.generateTagUrl}
              event={event}
              query={eventView.query}
            />
          </div>
        </ContentBox>
      </React.Fragment>
    );
  }

  renderError(error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    const permissionDenied = Object.values(this.state.errors).find(
      resp => resp && resp.status === 403
    );

    if (notFound) {
      return this.renderWrapper(<NotFound />);
    }
    if (permissionDenied) {
      return this.renderWrapper(
        <LoadingError message={t('You do not have permission to view that event.')} />
      );
    }

    return this.renderWrapper(super.renderError(error, true, true));
  }

  renderLoading() {
    return this.renderWrapper(super.renderLoading());
  }

  renderWrapper(children: React.ReactNode) {
    const {organization, location, eventView} = this.props;
    const {event} = this.state;

    return (
      <EventDetailsWrapper
        organization={organization}
        location={location}
        eventView={eventView}
        event={event}
      >
        {children}
      </EventDetailsWrapper>
    );
  }
}

type EventDetailsWrapperProps = {
  organization: Organization;
  location: Location;
  eventView: EventView;
  event: Event | undefined;
  children: React.ReactNode;
};

class EventDetailsWrapper extends React.Component<EventDetailsWrapperProps> {
  getDocumentTitle = (): string => {
    const {event, eventView} = this.props;

    return generateTitle({
      eventView,
      event,
    });
  };

  render() {
    const {organization, children} = this.props;

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} objSlug={organization.slug}>
        <React.Fragment>{children}</React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

const EventHeader = (props: {event: Event}) => {
  const {title} = getTitle(props.event);

  const message = getMessage(props.event);

  return (
    <StyledEventHeader data-test-id="event-header">
      <StyledTitle>
        {title}
        {message && message.length > 0 ? ':' : null}
      </StyledTitle>
      <span>{getMessage(props.event)}</span>
    </StyledEventHeader>
  );
};

const StyledButton = styled(Button)`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: block;
    width: 110px;
  }
`;

const StyledEventHeader = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray500};
  grid-column: 1/2;
  align-self: center;
  ${overflowEllipsis};
`;

const StyledTitle = styled('span')`
  color: ${p => p.theme.gray700};
  margin-right: ${space(1)};
  align-self: center;
`;

export default withApi(EventDetailsContent);
