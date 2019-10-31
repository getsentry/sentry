import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

import SentryTypes from 'app/sentryTypes';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';
import {getMessage, getTitle} from 'app/utils/events';
import {Event, Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';

import EventInterfaces from './eventInterfaces';
import LinkedIssuePreview from './linkedIssuePreview';
import ModalPagination from './modalPagination';
import ModalLineGraph from './modalLineGraph';
import RelatedEvents from './relatedEvents';
import TagsTable from './tagsTable';
import {hasAggregateField} from './utils';
import EventView from './eventView';

type EventModalContentProps = {
  event: Event;
  projectId: string;
  organization: Organization;
  location: Location;
  eventView: EventView;
};

/**
 * Render the columns and navigation elements inside the event modal view.
 * Controlled by the EventDetails View.
 */
class EventModalContent extends React.Component<EventModalContentProps> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    projectId: PropTypes.string.isRequired,
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
  };

  componentDidMount() {
    const {event, organization} = this.props;
    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: organization.id,
    });
  }

  render() {
    const {event, projectId, organization, location, eventView} = this.props;

    // Having an aggregate field means we want to show pagination/graphs
    const isGroupedView = hasAggregateField(eventView);
    const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${
      event.eventID
    }/json/`;

    return (
      <ColumnGrid>
        <HeaderBox>
          <EventHeader event={event} />
          {isGroupedView && <ModalPagination event={event} location={location} />}
          {isGroupedView &&
            getDynamicText({
              value: (
                <ModalLineGraph
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
          <EventInterfaces event={event} projectId={projectId} />
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
}

/**
 * Render the header of the modal content
 */
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

export default EventModalContent;
