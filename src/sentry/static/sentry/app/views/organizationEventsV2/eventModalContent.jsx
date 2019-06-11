import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {INTERFACES} from 'app/components/events/eventEntries';
import {getMessage, getTitle} from 'app/utils/events';
import {objectIsEmpty, toTitleCase} from 'app/utils';
import {t} from 'app/locale';
import DateTime from 'app/components/dateTime';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import EventDevice from 'app/components/events/device';
import EventExtraData from 'app/components/events/extraData';
import EventPackageData from 'app/components/events/packageData';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import NavTabs from 'app/components/navTabs';
import SentryTypes from 'app/sentryTypes';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

import LinkedIssuePreview from './linkedIssuePreview';
import ModalPagination from './modalPagination';
import ModalLineGraph from './modalLineGraph';
import TagsTable from './tagsTable';

const OTHER_SECTIONS = {
  context: EventExtraData,
  packages: EventPackageData,
  device: EventDevice,
};

/**
 * Render the currently active event interface tab.
 * Some but not all interface elements require a projectId.
 */
const ActiveTab = props => {
  const {projectId, event, activeTab} = props;
  if (!activeTab) {
    return null;
  }
  const entry = event.entries.find(item => item.type === activeTab);
  if (INTERFACES[activeTab]) {
    const Component = INTERFACES[activeTab];
    return (
      <Component
        projectId={projectId}
        event={event}
        type={entry.type}
        data={entry.data}
        isShare={false}
      />
    );
  } else if (OTHER_SECTIONS[activeTab]) {
    const Component = OTHER_SECTIONS[activeTab];
    return <Component event={event} isShare={false} />;
  } else {
    /*eslint no-console:0*/
    window.console &&
      console.error &&
      console.error('Unregistered interface: ' + activeTab);

    return (
      <EventDataSection event={event} type={entry.type} title={entry.type}>
        <p>{t('There was an error rendering this data.')}</p>
      </EventDataSection>
    );
  }
};
ActiveTab.propTypes = {
  event: SentryTypes.Event.isRequired,
  activeTab: PropTypes.string,
  projectId: PropTypes.string.isRequired,
};

/**
 * Render the columns and navigation elements inside the event modal view.
 * Controlled by the EventDetails View.
 */
const EventModalContent = props => {
  const {event, activeTab, projectId, organization, onTabChange, location, view} = props;
  const isGroupedView = !!view.data.groupby;
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
                groupId={event.groupID}
                location={location}
              />
            ),
            fixed: 'events chart',
          })}
      </HeaderBox>
      <ContentColumn>
        <NavTabs underlined={true}>
          {event.entries.map(entry => {
            if (!INTERFACES.hasOwnProperty(entry.type)) {
              return null;
            }
            const type = entry.type;
            const classname = type === activeTab ? 'active' : null;
            return (
              <li key={type} className={classname}>
                <a
                  href="#"
                  onClick={evt => {
                    evt.preventDefault();
                    onTabChange(type);
                  }}
                >
                  {toTitleCase(type)}
                </a>
              </li>
            );
          })}
          {Object.keys(OTHER_SECTIONS).map(section => {
            if (objectIsEmpty(event[section])) {
              return null;
            }
            const classname = section === activeTab ? 'active' : null;
            return (
              <li key={section} className={classname}>
                <a
                  href="#"
                  onClick={evt => {
                    evt.preventDefault();
                    onTabChange(section);
                  }}
                >
                  {toTitleCase(section)}
                </a>
              </li>
            );
          })}
        </NavTabs>
        <ErrorBoundary message={t('Could not render event details')}>
          <ActiveTab event={event} activeTab={activeTab} projectId={projectId} />
        </ErrorBoundary>
      </ContentColumn>
      <SidebarColumn>
        {event.groupID && <LinkedIssuePreview groupId={event.groupID} />}
        <EventMetadata event={event} eventJsonUrl={eventJsonUrl} />
        <SidebarBlock>
          <TagsTable tags={event.tags} />
        </SidebarBlock>
      </SidebarColumn>
    </ColumnGrid>
  );
};
EventModalContent.propTypes = {
  ...ActiveTab.propTypes,
  onTabChange: PropTypes.func.isRequired,
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
      <h2>{title}</h2>
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
      <MetadataContainer>ID {event.eventID}</MetadataContainer>
      <MetadataContainer>
        <DateTime
          date={getDynamicText({value: event.dateCreated, fixed: 'Dummy timestamp'})}
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

const MetadataContainer = styled('div')`
  display: flex;
  justify-content: space-between;

  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ColumnGrid = styled('div')`
  display: grid;
  max-height: 100%;
  overflow: auto;

  grid-template-columns: 70% 28%;
  grid-template-rows: auto;
  grid-column-gap: 2%;
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
