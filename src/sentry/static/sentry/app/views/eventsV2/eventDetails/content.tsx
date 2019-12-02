import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getMessage, getTitle} from 'app/utils/events';
import {Organization, Event} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import getDynamicText from 'app/utils/getDynamicText';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import NotFound from 'app/components/errors/notFound';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {PageContent} from 'app/styles/organization';

import EventView from '../eventView';
import {hasAggregateField, EventQuery, generateTitle} from '../utils';
import Pagination from './pagination';
import LineGraph from './lineGraph';
import TagsTable from '../tagsTable';
import EventInterfaces from './eventInterfaces';
import LinkedIssue from './linkedIssue';
import DiscoverBreadcrumb from '../breadcrumb';
import {SectionHeading} from '../styles';

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
};

class EventDetailsContent extends AsyncComponent<Props, State & AsyncComponent['state']> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    eventSlug: slugValidator,
    location: PropTypes.object.isRequired,
  };

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {organization, params, location, eventView} = this.props;
    const {eventSlug} = params;

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
    const {organization, location, eventView} = this.props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: organization.id,
    });

    // Having an aggregate field means we want to show pagination/graphs
    const isGroupedView = hasAggregateField(eventView);

    return (
      <div>
        <HeaderBox>
          <DiscoverBreadcrumb
            eventView={eventView}
            event={event}
            organization={organization}
            location={location}
          />
          <EventHeader event={event} />
          <Controller>
            {isGroupedView && (
              <Pagination
                event={event}
                organization={organization}
                eventView={eventView}
              />
            )}
          </Controller>
        </HeaderBox>
        <ContentBox>
          <Main>
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
            <EventInterfaces
              organization={organization}
              event={event}
              projectId={this.projectId}
              eventView={eventView}
            />
          </Main>
          <Side>
            <EventMetadata
              event={event}
              organization={organization}
              projectId={this.projectId}
            />
            {event.groupID && (
              <LinkedIssue groupId={event.groupID} eventId={event.eventID} />
            )}
            <TagsTable tags={event.tags} />
          </Side>
        </ContentBox>
      </div>
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

const ContentBox = styled(PageContent)`
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: 65% auto;
    grid-column-gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: auto 350px;
  }
`;

const Main = styled('div')`
  grid-column: 1/2;
`;

const Side = styled('div')`
  grid-column: 2/3;
`;

const HeaderBox = styled(ContentBox)`
  background-color: ${p => p.theme.white};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  grid-row-gap: ${space(1)};
`;

const Controller = styled('div')`
  grid-row: 1/3;
  grid-column: 2/3;
`;

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
      <StyledMessage>{getMessage(props.event)}</StyledMessage>
    </StyledEventHeader>
  );
};

const StyledEventHeader = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  grid-column: 1/2;
`;

const StyledTitle = styled('span')`
  margin-right: ${space(1)};
`;

const StyledMessage = styled('span')`
  color: ${p => p.theme.gray2};
`;

/**
 * Render metadata about the event and provide a link to the JSON blob
 */
const EventMetadata = (props: {
  event: Event;
  organization: Organization;
  projectId: string;
}) => {
  const {event, organization, projectId} = props;

  const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${
    event.eventID
  }/json/`;

  return (
    <MetaDataID>
      <SectionHeading>{t('Event ID')}</SectionHeading>
      <MetadataContainer data-test-id="event-id">{event.eventID}</MetadataContainer>
      <MetadataContainer>
        <DateTime
          date={getDynamicText({
            value: event.dateCreated || (event.endTimestamp || 0) * 1000,
            fixed: 'Dummy timestamp',
          })}
        />
      </MetadataContainer>
      <MetadataJSON href={eventJsonUrl} className="json-link">
        {t('Preview JSON')} (<FileSize bytes={event.size} />)
      </MetadataJSON>
    </MetaDataID>
  );
};

const MetaDataID = styled('div')`
  margin-bottom: ${space(3)};
`;

const MetadataContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const MetadataJSON = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default withApi(EventDetailsContent);
