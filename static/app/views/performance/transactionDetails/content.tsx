import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import NotFound from 'sentry/components/errors/notFound';
import EventCustomPerformanceMetrics, {
  EventDetailPageSource,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import EventMetadata from 'sentry/components/events/eventMetadata';
import EventVitals from 'sentry/components/events/eventVitals';
import getUrlFromEvent from 'sentry/components/events/interfaces/request/getUrlFromEvent';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import RootSpanStatus from 'sentry/components/events/rootSpanStatus';
import FileSize from 'sentry/components/fileSize';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TagsTable} from 'sentry/components/tagsTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Event, EventTag, EventTransaction} from 'sentry/types/event';
import {formatTagKey} from 'sentry/utils/discover/fields';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import Projects from 'sentry/utils/projects';
import {appendTagCondition, decodeScalar} from 'sentry/utils/queryString';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';
import {getSelectedProjectPlatforms} from '../utils';

import EventMetas from './eventMetas';
import FinishSetupAlert from './finishSetupAlert';

type Props = Pick<RouteComponentProps<{eventSlug: string}, {}>, 'params' | 'location'> &
  WithRouteAnalyticsProps & {
    eventSlug: string;
    organization: Organization;
    projects: Project[];
  };

type State = {
  event: Event | undefined;
  isSidebarVisible: boolean;
} & DeprecatedAsyncComponent['state'];

class EventDetailsContent extends DeprecatedAsyncComponent<Props, State> {
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

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, params} = this.props;
    const {eventSlug} = params;

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    return [['event', url]];
  }

  onLoadAllEndpointsSuccess() {
    const {location, projects} = this.props;
    const {event} = this.state;
    this.props.setEventNames(
      'performance.event_details',
      'Performance: Opened Event Details'
    );
    this.props.setRouteAnalyticsParams({
      event_type: event?.type,
      project_platforms: getSelectedProjectPlatforms(location, projects),
      ...getAnalyticsDataForEvent(event),
    });
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  generateTagUrl = (tag: EventTag) => {
    const {location, organization} = this.props;
    const {event} = this.state;
    if (!event) {
      return '';
    }
    const query = decodeScalar(location.query.query, '');
    const newQuery = {
      ...location.query,
      query: appendTagCondition(query, formatTagKey(tag.key), tag.value),
    };
    return transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: event.title,
      projectID: event.projectID,
      query: newQuery,
    });
  };

  renderBody() {
    const {event} = this.state;
    const {organization} = this.props;

    if (!event) {
      return <NotFound />;
    }
    const isSampleTransaction = event.tags.some(
      tag => tag.key === 'sample_event' && tag.value === 'yes'
    );

    return (
      <Fragment>
        {isSampleTransaction && (
          <FinishSetupAlert organization={organization} projectId={this.projectId} />
        )}
        {this.renderContent(event)}
      </Fragment>
    );
  }

  renderContent(event: Event) {
    const {organization, location, eventSlug} = this.props;

    const {isSidebarVisible} = this.state;
    const transactionName = event.title;
    const query = decodeScalar(location.query.query, '');

    const eventJsonUrl = `/api/0/projects/${organization.slug}/${this.projectId}/events/${event.eventID}/json/`;
    const traceId = event.contexts?.trace?.trace_id ?? '';
    const {start, end} = getTraceTimeRangeFromEvent(event);

    const hasProfilingFeature = organization.features.includes('profiling');

    const profileId = (event as EventTransaction).contexts?.profile?.profile_id ?? null;

    const originatingUrl = getUrlFromEvent(event);

    return (
      <TraceMetaQuery
        location={location}
        orgSlug={organization.slug}
        traceId={traceId}
        start={start}
        end={end}
      >
        {metaResults => (
          <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
            {results => (
              <TransactionProfileIdProvider
                projectId={event.projectID}
                transactionId={event.type === 'transaction' ? event.id : undefined}
                timestamp={event.dateReceived}
              >
                <Layout.Header>
                  <Layout.HeaderContent>
                    <Breadcrumb
                      organization={organization}
                      location={location}
                      transaction={{
                        project: event.projectID,
                        name: transactionName,
                      }}
                      eventSlug={eventSlug}
                    />
                    <Layout.Title data-test-id="event-header">
                      <Tooltip showOnlyOnOverflow skipWrapper title={transactionName}>
                        <EventTitle>{event.title}</EventTitle>
                      </Tooltip>
                      {originatingUrl && (
                        <Button
                          aria-label={t('Go to originating URL')}
                          size="zero"
                          icon={<IconOpen />}
                          href={originatingUrl}
                          external
                          translucentBorder
                          borderless
                        />
                      )}
                    </Layout.Title>
                  </Layout.HeaderContent>
                  <Layout.HeaderActions>
                    <ButtonBar gap={1}>
                      <Button size="sm" onClick={this.toggleSidebar}>
                        {isSidebarVisible ? 'Hide Details' : 'Show Details'}
                      </Button>
                      {results && (
                        <Button
                          size="sm"
                          icon={<IconOpen />}
                          href={eventJsonUrl}
                          external
                        >
                          {t('JSON')} (<FileSize bytes={event.size} />)
                        </Button>
                      )}
                      {hasProfilingFeature && (
                        <TransactionToProfileButton projectSlug={this.projectId} />
                      )}
                    </ButtonBar>
                  </Layout.HeaderActions>
                </Layout.Header>
                <Layout.Body>
                  {results && (
                    <Layout.Main fullWidth>
                      <EventMetas
                        quickTrace={results}
                        meta={metaResults?.meta ?? null}
                        event={event}
                        organization={organization}
                        projectId={this.projectId}
                        location={location}
                        errorDest="issue"
                        transactionDest="performance"
                      />
                    </Layout.Main>
                  )}
                  <Layout.Main fullWidth={!isSidebarVisible}>
                    <Projects orgId={organization.slug} slugs={[this.projectId]}>
                      {({projects: _projects}) => (
                        <SpanEntryContext.Provider
                          value={{
                            getViewChildTransactionTarget: childTransactionProps => {
                              return getTransactionDetailsUrl(
                                organization.slug,
                                childTransactionProps.eventSlug,
                                childTransactionProps.transaction,
                                location.query
                              );
                            },
                          }}
                        >
                          <QuickTraceContext.Provider value={results}>
                            {hasProfilingFeature ? (
                              <ProfilesProvider
                                orgSlug={organization.slug}
                                projectSlug={this.projectId}
                                profileId={profileId || ''}
                              >
                                <ProfileContext.Consumer>
                                  {profiles => (
                                    <ProfileGroupProvider
                                      type="flamechart"
                                      input={
                                        profiles?.type === 'resolved'
                                          ? profiles.data
                                          : null
                                      }
                                      traceID={profileId || ''}
                                    >
                                      <BorderlessEventEntries
                                        organization={organization}
                                        event={event}
                                        project={_projects[0] as Project}
                                        showTagSummary={false}
                                        location={location}
                                      />
                                    </ProfileGroupProvider>
                                  )}
                                </ProfileContext.Consumer>
                              </ProfilesProvider>
                            ) : (
                              <BorderlessEventEntries
                                organization={organization}
                                event={event}
                                project={_projects[0] as Project}
                                showTagSummary={false}
                                location={location}
                              />
                            )}
                          </QuickTraceContext.Provider>
                        </SpanEntryContext.Provider>
                      )}
                    </Projects>
                  </Layout.Main>
                  {isSidebarVisible && (
                    <Layout.Side>
                      {results === undefined && (
                        <Fragment>
                          <EventMetadata
                            event={event}
                            organization={organization}
                            projectId={this.projectId}
                          />
                          <RootSpanStatus event={event} />
                        </Fragment>
                      )}
                      <EventVitals event={event} />
                      <EventCustomPerformanceMetrics
                        event={event}
                        location={location}
                        organization={organization}
                        source={EventDetailPageSource.PERFORMANCE}
                      />
                      <TagsTable
                        event={event}
                        query={query}
                        generateUrl={this.generateTagUrl}
                      />
                    </Layout.Side>
                  )}
                </Layout.Body>
              </TransactionProfileIdProvider>
            )}
          </QuickTraceQuery>
        )}
      </TraceMetaQuery>
    );
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

  renderComponent() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle
        title={t('Performance — Event Details')}
        orgSlug={organization.slug}
      >
        {super.renderComponent() as React.ReactChild}
      </SentryDocumentTitle>
    );
  }
}

// We can't use theme.overflowEllipsis so that width isn't set to 100%
// since button withn a link has to immediately follow the text in the title
const EventTitle = styled('div')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export default withRouteAnalytics(EventDetailsContent);
