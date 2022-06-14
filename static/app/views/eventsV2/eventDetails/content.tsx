import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import EventMessage from 'sentry/components/events/eventMessage';
import EventVitals from 'sentry/components/events/eventVitals';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import FileSize from 'sentry/components/fileSize';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TagsTable from 'sentry/components/tagsTable';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Event, EventTag} from 'sentry/types/event';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {formatTagKey} from 'sentry/utils/discover/fields';
import {eventDetailsRoute} from 'sentry/utils/discover/urls';
import {getMessage} from 'sentry/utils/events';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import TraceMetaQuery, {
  TraceMetaQueryChildrenProps,
} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';
import EventMetas from 'sentry/views/performance/transactionDetails/eventMetas';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import DiscoverBreadcrumb from '../breadcrumb';
import {generateTitle, getExpandedResults} from '../utils';

import LinkedIssue from './linkedIssue';

type Props = Pick<
  RouteComponentProps<{eventSlug: string}, {}>,
  'params' | 'location' | 'route' | 'router'
> & {
  eventSlug: string;
  eventView: EventView;
  organization: Organization;
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
    errors: {},
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
    const tagKey = formatTagKey(tag.key);
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
    const {organization, location, eventView, route, router} = this.props;
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

    const renderContent = (
      results?: QuickTraceQueryChildrenProps,
      metaResults?: TraceMetaQueryChildrenProps
    ) => (
      <Fragment>
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
              <Button
                icon={<IconOpen />}
                href={eventJsonUrl}
                external
                onClick={() =>
                  trackAdvancedAnalyticsEvent(
                    'performance_views.event_details.json_button_click',
                    {
                      organization,
                    }
                  )
                }
              >
                {t('JSON')} (<FileSize bytes={event.size} />)
              </Button>
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
          <Layout.Main fullWidth>
            <EventMetas
              quickTrace={results ?? null}
              meta={metaResults?.meta ?? null}
              event={event}
              organization={organization}
              projectId={this.projectId}
              location={location}
              errorDest="discover"
              transactionDest="discover"
            />
          </Layout.Main>
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
                        router={router}
                        route={route}
                        isBorderless
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
      </Fragment>
    );

    const hasQuickTraceView = organization.features.includes('performance-view');

    if (hasQuickTraceView) {
      const traceId = event.contexts?.trace?.trace_id ?? '';
      const {start, end} = getTraceTimeRangeFromEvent(event);

      return (
        <TraceMetaQuery
          location={location}
          orgSlug={organization.slug}
          traceId={traceId}
          start={start}
          end={end}
        >
          {metaResults => (
            <QuickTraceQuery
              event={event}
              location={location}
              orgSlug={organization.slug}
            >
              {results => renderContent(results, metaResults)}
            </QuickTraceQuery>
          )}
        </TraceMetaQuery>
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

    return super.renderError(error, true);
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
        {super.renderComponent() as React.ReactChild}
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
