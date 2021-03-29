import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import NotFound from 'app/components/errors/notFound';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import {BorderlessEventEntries} from 'app/components/events/eventEntries';
import EventMessage from 'app/components/events/eventMessage';
import EventMetadata from 'app/components/events/eventMetadata';
import EventVitals from 'app/components/events/eventVitals';
import * as SpanEntryContext from 'app/components/events/interfaces/spans/context';
import OpsBreakdown from 'app/components/events/opsBreakdown';
import RootSpanStatus from 'app/components/events/rootSpanStatus';
import FileSize from 'app/components/fileSize';
import * as Layout from 'app/components/layouts/thirds';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import TagsTable from 'app/components/tagsTable';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Event, EventTag} from 'app/types/event';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {FIELD_TAGS} from 'app/utils/discover/fields';
import {eventDetailsRoute} from 'app/utils/discover/urls';
import {getMessage} from 'app/utils/events';
import * as QuickTraceContext from 'app/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'app/utils/performance/quickTrace/quickTraceQuery';
import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';
import Projects from 'app/utils/projects';
import EventMetas from 'app/views/performance/transactionDetails/eventMetas';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';

import DiscoverBreadcrumb from '../breadcrumb';
import {generateTitle, getExpandedResults} from '../utils';

import LinkedIssue from './linkedIssue';

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
  eventSlug: string;
  eventView: EventView;
};

type State = {
  event: Event | undefined;
  isSidebarVisible: boolean;
} & AsyncComponent['state'];

class EventDetailsContent extends AsyncComponent<Props, State> {
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

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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

  generateTagKey = (tag: EventTag) => {
    // Some tags may be normalized from context, but not all of them are.
    // This supports a user making a custom tag with the same name as one
    // that comes from context as all of these are also tags.
    if (tag.key in FIELD_TAGS) {
      return `tags[${tag.key}]`;
    }
    return tag.key;
  };

  generateTagUrl = (tag: EventTag) => {
    const {eventView, organization} = this.props;
    const {event} = this.state;
    if (!event) {
      return '';
    }
    const eventReference = {...event};
    if (eventReference.id) {
      delete (eventReference as any).id;
    }
    const tagKey = this.generateTagKey(tag);
    const nextView = getExpandedResults(eventView, {[tagKey]: tag.value}, eventReference);
    return nextView.getResultsViewUrlTarget(organization.slug);
  };

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return <NotFound />;
    }

    return this.renderContent(event);
  }

  renderContent(event: Event) {
    const {organization, location, eventView} = this.props;
    const {isSidebarVisible} = this.state;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
    });

    const transactionName = event.tags.find(tag => tag.key === 'transaction')?.value;
    const transactionSummaryTarget =
      event.type === 'transaction' && transactionName
        ? transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionName,
            projectID: event.projectID,
            query: location.query,
          })
        : null;

    const eventJsonUrl = `/api/0/projects/${organization.slug}/${this.projectId}/events/${event.eventID}/json/`;

    const renderContent = (results?: QuickTraceQueryChildrenProps) => (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <DiscoverBreadcrumb
              eventView={eventView}
              event={event}
              organization={organization}
              location={location}
            />
            <EventHeader event={event} />
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <Button onClick={this.toggleSidebar}>
                {isSidebarVisible ? 'Hide Details' : 'Show Details'}
              </Button>
              {results && (
                <Button icon={<IconOpen />} href={eventJsonUrl} external>
                  {t('JSON')} (<FileSize bytes={event.size} />)
                </Button>
              )}
              {transactionSummaryTarget && (
                <Feature organization={organization} features={['performance-view']}>
                  {({hasFeature}) => (
                    <Button
                      disabled={!hasFeature}
                      priority="primary"
                      to={transactionSummaryTarget}
                    >
                      {t('Go to Summary')}
                    </Button>
                  )}
                </Feature>
              )}
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          {results && (
            <Layout.Main fullWidth>
              <EventMetas
                quickTrace={results}
                event={event}
                organization={organization}
                projectId={this.projectId}
                location={location}
                errorDest="discover"
                transactionDest="discover"
              />
            </Layout.Main>
          )}
          <Layout.Main fullWidth={!isSidebarVisible}>
            <Projects orgId={organization.slug} slugs={[this.projectId]}>
              {({projects, initiallyLoaded}) =>
                initiallyLoaded ? (
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
                    <QuickTraceContext.Provider value={results}>
                      <BorderlessEventEntries
                        organization={organization}
                        event={event}
                        project={projects[0] as Project}
                        location={location}
                        showExampleCommit={false}
                        showTagSummary={false}
                        api={this.api}
                      />
                    </QuickTraceContext.Provider>
                  </SpanEntryContext.Provider>
                ) : (
                  <LoadingIndicator />
                )
              }
            </Projects>
          </Layout.Main>
          {isSidebarVisible && (
            <Layout.Side>
              {results === undefined && (
                <React.Fragment>
                  <EventMetadata
                    event={event}
                    organization={organization}
                    projectId={this.projectId}
                  />
                  <RootSpanStatus event={event} />
                  <OpsBreakdown event={event} />
                </React.Fragment>
              )}
              <EventVitals event={event} />
              {event.groupID && (
                <LinkedIssue groupId={event.groupID} eventId={event.eventID} />
              )}
              <TagsTable
                generateUrl={this.generateTagUrl}
                event={event}
                query={eventView.query}
              />
            </Layout.Side>
          )}
        </Layout.Body>
      </React.Fragment>
    );

    const hasQuickTraceView =
      (event.type === 'transaction' &&
        organization.features.includes('trace-view-quick')) ||
      organization.features.includes('trace-view-summary');

    if (hasQuickTraceView) {
      return (
        <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
          {results => renderContent(results)}
        </QuickTraceQuery>
      );
    }

    return renderContent();
  }

  renderError(error: Error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    const permissionDenied = Object.values(this.state.errors).find(
      resp => resp && resp.status === 403
    );

    if (notFound) {
      return <NotFound />;
    }
    if (permissionDenied) {
      return (
        <LoadingError message={t('You do not have permission to view that event.')} />
      );
    }

    return super.renderError(error, true, true);
  }

  getEventSlug = (): string => {
    const {eventSlug} = this.props.params;

    if (typeof eventSlug === 'string') {
      return eventSlug.trim();
    }

    return '';
  };

  renderComponent() {
    const {eventView, organization} = this.props;
    const {event} = this.state;
    const eventSlug = this.getEventSlug();
    const projectSlug = eventSlug.split(':')[0];

    const title = generateTitle({eventView, event, organization});

    return (
      <SentryDocumentTitle
        title={title}
        orgSlug={organization.slug}
        projectSlug={projectSlug}
      >
        {super.renderComponent()}
      </SentryDocumentTitle>
    );
  }
}

const EventHeader = ({event}: {event: Event}) => {
  const message = getMessage(event);
  return (
    <EventHeaderContainer data-test-id="event-header">
      <TitleWrapper>
        <EventOrGroupTitle data={event} />
      </TitleWrapper>
      {message && (
        <MessageWrapper>
          <EventMessage message={message} />
        </MessageWrapper>
      )}
    </EventHeaderContainer>
  );
};

const EventHeaderContainer = styled('div')`
  max-width: ${p => p.theme.breakpoints[0]};
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 20px;
`;

const MessageWrapper = styled('div')`
  margin-top: ${space(1)};
`;

export default EventDetailsContent;
