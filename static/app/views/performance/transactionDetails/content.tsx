import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
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
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TagsTable} from 'sentry/components/tagsTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, EventTag, EventTransaction} from 'sentry/types/event';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatTagKey} from 'sentry/utils/discover/fields';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {
  getTraceTimeRangeFromEvent,
  isTransaction,
} from 'sentry/utils/performance/quickTrace/utils';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import Projects from 'sentry/utils/projects';
import {useApiQuery} from 'sentry/utils/queryClient';
import {appendTagCondition, decodeScalar} from 'sentry/utils/queryString';
import type {WithRouteAnalyticsProps} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withRouteAnalytics from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import TraceDetailsRouting from '../traceDetails/TraceDetailsRouting';
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

function EventDetailsContent(props: Props) {
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);
  const projectId = props.eventSlug.split(':')[0]!;
  const {organization, eventSlug, location} = props;

  const {
    data: event,
    isPending,
    error,
  } = useApiQuery<Event>(
    [`/organizations/${organization.slug}/events/${eventSlug}/`],
    {staleTime: 2 * 60 * 1000} // 2 minutes in milliseonds
  );

  useEffect(() => {
    if (event) {
      const {projects} = props;
      props.setEventNames(
        'performance.event_details',
        'Performance: Opened Event Details'
      );
      props.setRouteAnalyticsParams({
        event_type: event?.type,
        project_platforms: getSelectedProjectPlatforms(location, projects),
        ...getAnalyticsDataForEvent(event),
      });
    }
  }, [event, props, location]);

  const generateTagUrl = (tag: EventTag) => {
    if (!event) {
      return '';
    }
    const query = decodeScalar(location.query.query, '');
    const newQuery = {
      ...location.query,
      query: appendTagCondition(query, formatTagKey(tag.key), tag.value),
    };
    return transactionSummaryRouteWithQuery({
      organization,
      transaction: event.title,
      projectID: event.projectID,
      query: newQuery,
    });
  };

  function renderContent(transaction: Event) {
    const transactionName = transaction.title;
    const query = decodeScalar(location.query.query, '');

    const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${transaction.eventID}/json/`;
    const traceId = transaction.contexts?.trace?.trace_id ?? '';
    const {start, end} = getTraceTimeRangeFromEvent(transaction);

    const hasProfilingFeature = organization.features.includes('profiling');

    const profileId =
      (transaction as EventTransaction).contexts?.profile?.profile_id ?? null;

    const originatingUrl = getUrlFromEvent(transaction);

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
            event={transaction}
            location={location}
            orgSlug={organization.slug}
            skipLight={false}
          >
            {results => (
              <Fragment>
                <Layout.Header>
                  <Layout.HeaderContent>
                    <Breadcrumb
                      organization={organization}
                      location={location}
                      transaction={{
                        project: transaction.projectID,
                        name: transactionName,
                      }}
                      eventSlug={eventSlug}
                    />
                    <Layout.Title data-test-id="event-header">
                      <Tooltip showOnlyOnOverflow skipWrapper title={transactionName}>
                        <EventTitle>{transaction.title}</EventTitle>
                      </Tooltip>
                      {originatingUrl && (
                        <LinkButton
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
                      <Button
                        size="sm"
                        onClick={() => setIsSidebarVisible(prev => !prev)}
                      >
                        {isSidebarVisible ? 'Hide Details' : 'Show Details'}
                      </Button>
                      {results && (
                        <LinkButton
                          size="sm"
                          icon={<IconOpen />}
                          href={eventJsonUrl}
                          external
                        >
                          {t('JSON')} (<FileSize bytes={transaction.size} />)
                        </LinkButton>
                      )}
                      {hasProfilingFeature && isTransaction(transaction) && (
                        <TransactionToProfileButton
                          event={transaction}
                          projectSlug={projectId}
                        />
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
                        event={transaction}
                        organization={organization}
                        projectId={projectId}
                        location={location}
                        errorDest="issue"
                        transactionDest="performance"
                      />
                    </Layout.Main>
                  )}
                  <Layout.Main fullWidth={!isSidebarVisible}>
                    <Projects orgId={organization.slug} slugs={[projectId]}>
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
                                projectSlug={projectId}
                                profileMeta={profileId || ''}
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
                            event={transaction}
                            organization={organization}
                            projectId={projectId}
                          />
                          <RootSpanStatus event={transaction} />
                        </Fragment>
                      )}
                      <EventVitals event={transaction} />
                      <EventCustomPerformanceMetrics
                        event={transaction}
                        location={location}
                        organization={organization}
                        source={EventDetailPageSource.PERFORMANCE}
                      />
                      <TagsTable
                        event={transaction}
                        query={query}
                        generateUrl={generateTagUrl}
                      />
                    </Layout.Side>
                  )}
                </Layout.Body>
              </Fragment>
            )}
          </QuickTraceQuery>
        )}
      </TraceMetaQuery>
    );
  }

  function renderBody() {
    if (!event) {
      return <NotFound />;
    }
    const isSampleTransaction = event.tags.some(
      tag => tag.key === 'sample_event' && tag.value === 'yes'
    );

    return (
      <TraceDetailsRouting event={event}>
        <Fragment>
          {isSampleTransaction && (
            <FinishSetupAlert organization={organization} projectId={projectId} />
          )}
          {renderContent(event)}
        </Fragment>
      </TraceDetailsRouting>
    );
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (error) {
    const notFound = error.status === 404;
    const permissionDenied = error.status === 403;

    if (notFound) {
      return <NotFound />;
    }
    if (permissionDenied) {
      return (
        <LoadingError message={t('You do not have permission to view that event.')} />
      );
    }

    return (
      <Alert type="error" showIcon>
        {error.message}
      </Alert>
    );
  }

  return (
    <SentryDocumentTitle
      title={t('Performance — Event Details')}
      orgSlug={organization.slug}
    >
      {renderBody() as React.ReactChild}
    </SentryDocumentTitle>
  );
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
