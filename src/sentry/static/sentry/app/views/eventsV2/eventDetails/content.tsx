import React from 'react';
import {Params} from 'react-router/lib/Router';
import DocumentTitle from 'react-document-title';
import {Location} from 'history';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getMessage, getTitle} from 'app/utils/events';
import {Organization, Event} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import {PageHeader} from 'app/styles/organization';
import NotFound from 'app/components/errors/notFound';
import AsyncComponent from 'app/components/asyncComponent';

import EventView from '../eventView';
import {hasAggregateField, EventQuery} from '../utils';
import Pagination from './pagination';
import LineGraph from './lineGraph';
import RelatedEvents from '../relatedEvents';
import TagsTable from '../tagsTable';
import EventInterfaces from '../eventInterfaces';
import LinkedIssuePreview from '../linkedIssuePreview';
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
};

type State = {
  event: Event | undefined;
};

class EventDetailsContent extends AsyncComponent<Props, State & AsyncComponent['state']> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
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

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return this.renderWrapper(<NotFound />);
    }

    return this.renderWrapper(this.renderContent(event));
  }

  renderContent(event: Event) {
    const {organization, location} = this.props;
    const eventView = this.getEventView();

    if (!event) {
      return this.renderWrapper(<NotFound />);
    }

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: organization.id,
    });

    // Having an aggregate field means we want to show pagination/graphs
    const isGroupedView = hasAggregateField(eventView);
    const eventJsonUrl = `/api/0/projects/${organization.slug}/${this.projectId}/events/${
      event.eventID
    }/json/`;

    return (
      <ColumnGrid>
        <HeaderBox>
          <EventHeader event={event} />
          {isGroupedView && (
            <Pagination event={event} organization={organization} eventView={eventView} />
          )}
          {isGroupedView &&
            getDynamicText({
              value: (
                <LineGraph
                  organization={organization}
                  currentEvent={event}
                  location={location}
                  eventView={eventView}
                />
              ),
              fixed: 'events chart',
            })}
        </HeaderBox>
        <ContentColumn>
          <EventInterfaces event={event} projectId={this.projectId} />
        </ContentColumn>
        <SidebarColumn>
          {event.groupID && (
            <LinkedIssuePreview groupId={event.groupID} eventId={event.eventID} />
          )}
          {event.type === 'transaction' && (
            <RelatedEvents
              organization={organization}
              event={event}
              location={location}
              eventView={eventView}
            />
          )}
          <EventMetadata event={event} eventJsonUrl={eventJsonUrl} />
          <SidebarBlock>
            <TagsTable tags={event.tags} />
          </SidebarBlock>
        </SidebarColumn>
      </ColumnGrid>
    );
  }

  renderError(error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );

    if (notFound) {
      return this.renderWrapper(<NotFound />);
    }

    return this.renderWrapper(super.renderError(error, true, true));
  }

  renderLoading() {
    return this.renderWrapper(super.renderLoading());
  }

  renderWrapper(children: React.ReactNode) {
    const {organization, location} = this.props;
    const eventView = this.getEventView();
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

    const titles = [t('Discover')];

    const eventViewName = eventView.name;
    if (typeof eventViewName === 'string' && String(eventViewName).trim().length > 0) {
      titles.push(String(eventViewName).trim());
    }

    const eventTitle = event ? getTitle(event).title : undefined;

    if (eventTitle) {
      titles.push(eventTitle);
    }

    return titles.join(' - ');
  };

  render() {
    const {organization, location, eventView, event, children} = this.props;

    return (
      <DocumentTitle title={`${this.getDocumentTitle()} - ${organization.slug} - Sentry`}>
        <React.Fragment>
          <PageHeader>
            <DiscoverBreadcrumb
              eventView={eventView}
              event={event}
              organization={organization}
              location={location}
            />
          </PageHeader>
          {children}
        </React.Fragment>
      </DocumentTitle>
    );
  }
}

const EventHeader = props => {
  const {title} = getTitle(props.event);
  return (
    <div>
      <OverflowHeader>{title}</OverflowHeader>
      <p>{getMessage(props.event)}</p>
    </div>
  );
};
EventHeader.propTypes = {
  event: SentryTypes.Event.isRequired,
};

const OverflowHeader = styled('h2')`
  line-height: 1.2;
  ${overflowEllipsis}
`;

const MetadataContainer = styled('div')`
  display: flex;
  justify-content: space-between;

  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
`;

/**
 * Render metadata about the event and provide a link to the JSON blob
 */
const EventMetadata = (props: {event: Event; eventJsonUrl: string}) => {
  const {event, eventJsonUrl} = props;

  return (
    <SidebarBlock withSeparator>
      <MetadataContainer data-test-id="event-id">ID {event.eventID}</MetadataContainer>
      <MetadataContainer>
        <DateTime
          date={getDynamicText({
            value: event.dateCreated || (event.endTimestamp || 0) * 1000,
            fixed: 'Dummy timestamp',
          })}
        />
        <ExternalLink href={eventJsonUrl} className="json-link">
          JSON (<FileSize bytes={event.size} />)
        </ExternalLink>
      </MetadataContainer>
    </SidebarBlock>
  );
};
EventMetadata.propTypes = {
  event: SentryTypes.Event.isRequired,
  eventJsonUrl: PropTypes.string.isRequired,
};

const ColumnGrid = styled('div')`
  display: grid;

  grid-template-columns: 70% 28%;
  grid-template-rows: auto;
  grid-column-gap: 2%;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 60% 38%;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    flex-direction: column;
  }
`;

const HeaderBox = styled('div')`
  grid-column: 1 / 3;
`;
const ContentColumn = styled('div')`
  grid-column: 1 / 2;
`;

const SidebarColumn = styled('div')`
  grid-column: 2 / 3;
`;

const SidebarBlock = styled('div')<{withSeparator?: boolean; theme?: any}>`
  margin: 0 0 ${space(2)} 0;
  padding: 0 0 ${space(2)} 0;
  ${p => (p.withSeparator ? `border-bottom: 1px solid ${p.theme.borderLight};` : '')}
`;

export default withApi(EventDetailsContent);
