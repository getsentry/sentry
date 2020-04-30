import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {EventQuery} from 'app/actionCreators/events';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getMessage, getTitle} from 'app/utils/events';
import {Organization, Event} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import getDynamicText from 'app/utils/getDynamicText';
import {SectionHeading} from 'app/components/charts/styles';
import DateTime from 'app/components/dateTime';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import LoadingError from 'app/components/loadingError';
import NotFound from 'app/components/errors/notFound';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import EventEntries from 'app/components/events/eventEntries';
import {DataSection} from 'app/components/events/styles';
import Projects from 'app/utils/projects';
import EventView from 'app/utils/discover/eventView';
import {ContentBox, HeaderBox} from 'app/utils/discover/styles';
import ProjectBadge from 'app/components/idBadge/projectBadge';

import {generateTitle} from '../utils';
import Pagination from './pagination';
import LineGraph from './lineGraph';
import TagsTable from '../tagsTable';
import LinkedIssue from './linkedIssue';
import DiscoverBreadcrumb from '../breadcrumb';
import OpsBreakdown from './transaction/opsBreakdown';

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
      organization_id: parseInt(organization.id, 10),
    });

    // Having an aggregate field means we want to show pagination/graphs
    const isGroupedView = eventView.hasAggregateField();
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
          <Controller>
            <StyledButton size="small" onClick={this.toggleSidebar}>
              {isSidebarVisible ? 'Hide Details' : 'Show Details'}
            </StyledButton>
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
          <div style={{gridColumn: isSidebarVisible ? '1/2' : '1/3'}}>
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
            <Projects orgId={organization.slug} slugs={[this.projectId]}>
              {({projects}) => (
                <StyledEventEntries
                  organization={organization}
                  event={event}
                  project={projects[0]}
                  location={location}
                  showExampleCommit={false}
                  showTagSummary={false}
                  eventView={eventView}
                />
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
            <TagsTable eventView={eventView} event={event} organization={organization} />
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

/**
 * Render metadata about the event and provide a link to the JSON blob
 */
const EventMetadata = (props: {
  event: Event;
  organization: Organization;
  projectId: string;
}) => {
  const {event, organization, projectId} = props;

  const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${event.eventID}/json/`;

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
      <Projects orgId={organization.slug} slugs={[projectId]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === projectId);
          return (
            <StyledProjectBadge
              project={project ? project : {slug: projectId}}
              avatarSize={16}
            />
          );
        }}
      </Projects>
      <MetadataJSON href={eventJsonUrl} className="json-link">
        {t('Preview JSON')} (<FileSize bytes={event.size} />)
      </MetadataJSON>
    </MetaDataID>
  );
};

const Controller = styled('div')`
  display: flex;
  justify-content: flex-end;
  grid-row: 2/3;
  grid-column: 2/3;
`;

const StyledButton = styled(Button)`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: block;
    width: 110px;
  }
`;

const StyledEventHeader = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray2};
  grid-column: 1/2;
  align-self: center;
  ${overflowEllipsis};
`;

const StyledTitle = styled('span')`
  color: ${p => p.theme.gray4};
  margin-right: ${space(1)};
`;

const MetaDataID = styled('div')`
  margin-bottom: ${space(4)};
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

const StyledEventEntries = styled(EventEntries)`
  & ${/* sc-selector */ DataSection} {
    padding: ${space(3)} 0 0 0;
  }
  & ${/* sc-selector */ DataSection}:first-child {
    padding-top: 0;
    border-top: none;
  }
`;

const StyledProjectBadge = styled(ProjectBadge)`
  margin-bottom: ${space(2)};
`;

export default withApi(EventDetailsContent);
