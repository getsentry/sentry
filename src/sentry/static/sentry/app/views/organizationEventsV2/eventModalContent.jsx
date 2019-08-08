import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';
import {getMessage, getTitle} from 'app/utils/events';

import EventInterfaces from './eventInterfaces';
import LinkedIssuePreview from './linkedIssuePreview';
import ModalPagination from './modalPagination';
import ModalLineGraph from './modalLineGraph';
import RelatedEvents from './relatedEvents';
import TagsTable from './tagsTable';
import TransanctionView from './transactionView';

/**
 * Render the columns and navigation elements inside the event modal view.
 * Controlled by the EventDetails View.
 */
const EventModalContent = props => {
  const {event, projectId, organization, location, view} = props;
  const isGroupedView = !!view.data.groupby;
  const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${
    event.eventID
  }/json/`;

  return (
    <ColumnGrid>
      <HeaderBox>
        <EventHeader event={event} />
        {isGroupedView && (
          <ModalPagination view={view} event={event} location={location} />
        )}
        {isGroupedView &&
          getDynamicText({
            value: (
              <ModalLineGraph
                organization={organization}
                currentEvent={event}
                location={location}
                view={view}
              />
            ),
            fixed: 'events chart',
          })}
      </HeaderBox>
      <ContentColumn>
        {event.type === 'transaction' ? (
          <TransanctionView event={event} />
        ) : (
          <EventInterfaces event={event} projectId={projectId} />
        )}
      </ContentColumn>
      <SidebarColumn>
        {event.groupID && (
          <LinkedIssuePreview groupId={event.groupID} eventId={event.eventID} />
        )}
        {event.type === 'transaction' && (
          <RelatedEvents organization={organization} event={event} location={location} />
        )}
        <EventMetadata event={event} eventJsonUrl={eventJsonUrl} />
        <SidebarBlock>
          <TagsTable tags={event.tags} />
        </SidebarBlock>
      </SidebarColumn>
    </ColumnGrid>
  );
};
EventModalContent.propTypes = {
  event: SentryTypes.Event.isRequired,
  projectId: PropTypes.string.isRequired,
  organization: SentryTypes.Organization.isRequired,
  view: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
};

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
const EventMetadata = props => {
  const {event, eventJsonUrl} = props;

  return (
    <SidebarBlock withSeparator>
      <MetadataContainer data-test-id="event-id">ID {event.eventID}</MetadataContainer>
      <MetadataContainer>
        <DateTime
          date={getDynamicText({
            value: event.dateCreated || event.endTimestamp * 1000,
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

const SidebarBlock = styled('div')`
  margin: 0 0 ${space(2)} 0;
  padding: 0 0 ${space(2)} 0;
  ${p => (p.withSeparator ? `border-bottom: 1px solid ${p.theme.borderLight};` : '')}
`;

export default EventModalContent;
