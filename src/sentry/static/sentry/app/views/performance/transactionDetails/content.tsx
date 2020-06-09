import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
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
import OpsBreakdown from 'app/components/events/opsBreakdown';
import {DataSection} from 'app/components/events/styles';
import Projects from 'app/utils/projects';
import {ContentBox, HeaderBox} from 'app/utils/discover/styles';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {decodeScalar} from 'app/utils/queryString';

//import TagsTable from '../tagsTable';

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

  getEndpoints(): Array<[string, string]> {
    const {organization, params} = this.props;
    const {eventSlug} = params;

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    return [['event', url]];
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
    const {organization, location, eventSlug} = this.props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'performance.event_details',
      eventName: 'Performance: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
    });

    const {isSidebarVisible} = this.state;
    const transactionName = decodeScalar(location.query.transaction);

    return (
      <React.Fragment>
        <HeaderBox>
          <Breadcrumb
            organization={organization}
            location={location}
            transactionName={transactionName}
            eventSlug={eventSlug}
          />
          <Controller>
            <StyledButton size="small" onClick={this.toggleSidebar}>
              {isSidebarVisible ? 'Hide Details' : 'Show Details'}
            </StyledButton>
          </Controller>
          <StyledTitle data-test-id="event-header">{event.title}</StyledTitle>
        </HeaderBox>
        <ContentBox>
          <div style={{gridColumn: isSidebarVisible ? '1/2' : '1/3'}}>
            <Projects orgId={organization.slug} slugs={[this.projectId]}>
              {({projects}) => (
                <StyledEventEntries
                  organization={organization}
                  event={event}
                  project={projects[0]}
                  location={location}
                  showExampleCommit={false}
                  showTagSummary={false}
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
            {/* TODO show tagstable again.
            <TagsTable eventView={eventView} event={event} organization={organization} />
              */}
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
    const {organization} = this.props;

    return (
      <SentryDocumentTitle
        title={t('Performance - Event Details')}
        objSlug={organization.slug}
      >
        <React.Fragment>{children}</React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

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

const StyledTitle = styled('span')`
  color: ${p => p.theme.gray700};
  font-size: ${p => p.theme.headerFontSize};
  grid-column: 1 / 2;
`;

const MetaDataID = styled('div')`
  margin-bottom: ${space(4)};
`;

const MetadataContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  color: ${p => p.theme.gray600};
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
