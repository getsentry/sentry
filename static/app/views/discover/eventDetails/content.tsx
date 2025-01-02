import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventCustomPerformanceMetrics from 'sentry/components/events/eventCustomPerformanceMetrics';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import EventMessage from 'sentry/components/events/eventMessage';
import EventVitals from 'sentry/components/events/eventVitals';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import FileSize from 'sentry/components/fileSize';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TagsTable} from 'sentry/components/tagsTable';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTag} from 'sentry/types/event';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {formatTagKey} from 'sentry/utils/discover/fields';
import {eventDetailsRoute} from 'sentry/utils/discover/urls';
import {getMessage} from 'sentry/utils/events';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import type {TraceMetaQueryChildrenProps} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import type {QuickTraceQueryChildrenProps} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceTimeRangeFromEvent,
  isTransaction,
} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';
import {useApiQuery} from 'sentry/utils/queryClient';
import TraceDetailsRouting from 'sentry/views/performance/traceDetails/TraceDetailsRouting';
import EventMetas from 'sentry/views/performance/transactionDetails/eventMetas';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import DiscoverBreadcrumb from '../breadcrumb';
import {generateTitle, getExpandedResults} from '../utils';

import LinkedIssue from './linkedIssue';

type Props = Pick<RouteComponentProps<{eventSlug: string}, {}>, 'params' | 'location'> & {
  eventSlug: string;
  eventView: EventView;
  organization: Organization;
  isHomepage?: boolean;
};

function EventHeader({event}: {event: Event}) {
  const message = getMessage(event);
  return (
    <EventHeaderContainer data-test-id="event-header">
      <TitleWrapper>
        <StyledEventOrGroupTitle data={event} />
      </TitleWrapper>
      {message && (
        <MessageWrapper>
          <EventMessage data={event} message={message} type={event.type} />
        </MessageWrapper>
      )}
    </EventHeaderContainer>
  );
}

function EventDetailsContent(props: Props) {
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);
  const projectId = props.eventSlug.split(':')[0]!;

  const {
    data: event,
    isPending,
    error,
  } = useApiQuery<Event>(
    [`/organizations/${props.organization.slug}/events/${props.eventSlug}/`],
    {staleTime: 2 * 60 * 1000} // 2 minutes in milliseonds
  );

  const generateTagUrl = (tag: EventTag) => {
    const {eventView, organization, isHomepage} = props;
    if (!event) {
      return '';
    }
    const eventReference = {...event};
    if (eventReference.id) {
      delete (eventReference as any).id;
    }
    const tagKey = formatTagKey(tag.key);
    const nextView = getExpandedResults(eventView, {[tagKey]: tag.value}, eventReference);
    return nextView.getResultsViewUrlTarget(organization.slug, isHomepage);
  };

  function renderContent() {
    if (!event) {
      return <NotFound />;
    }

    const {organization, location, eventView, isHomepage} = props;

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

    const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${event.eventID}/json/`;

    const hasProfilingFeature = organization.features.includes('profiling');

    const profileId = isTransaction(event) ? event.contexts?.profile?.profile_id : null;

    const render = (
      results?: QuickTraceQueryChildrenProps,
      metaResults?: TraceMetaQueryChildrenProps
    ) => {
      return (
        <Fragment>
          <Layout.Header>
            <Layout.HeaderContent>
              <DiscoverBreadcrumb
                eventView={eventView}
                event={event}
                organization={organization}
                location={location}
                isHomepage={isHomepage}
              />
              <EventHeader event={event} />
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Button size="sm" onClick={() => setIsSidebarVisible(prev => !prev)}>
                  {isSidebarVisible ? 'Hide Details' : 'Show Details'}
                </Button>
                <LinkButton
                  size="sm"
                  icon={<IconOpen />}
                  href={eventJsonUrl}
                  external
                  onClick={() =>
                    trackAnalytics('performance_views.event_details.json_button_click', {
                      organization,
                    })
                  }
                >
                  {t('JSON')} (<FileSize bytes={event.size} />)
                </LinkButton>
                {hasProfilingFeature && event.type === 'transaction' && (
                  <TransactionToProfileButton event={event} projectSlug={projectId} />
                )}
                {transactionSummaryTarget && (
                  <Feature organization={organization} features="performance-view">
                    {({hasFeature}) => (
                      <LinkButton
                        size="sm"
                        disabled={!hasFeature}
                        priority="primary"
                        to={transactionSummaryTarget}
                      >
                        {t('Go to Summary')}
                      </LinkButton>
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
                projectId={projectId}
                location={location}
                errorDest="discover"
                transactionDest="discover"
              />
            </Layout.Main>
            <Layout.Main fullWidth={!isSidebarVisible}>
              <Projects orgId={organization.slug} slugs={[projectId]}>
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
                        {hasProfilingFeature ? (
                          <ProfilesProvider
                            orgSlug={organization.slug}
                            projectSlug={projectId}
                            profileId={profileId || ''}
                          >
                            <ProfileContext.Consumer>
                              {profiles => (
                                <ProfileGroupProvider
                                  type="flamechart"
                                  input={
                                    profiles?.type === 'resolved' ? profiles.data : null
                                  }
                                  traceID={profileId || ''}
                                >
                                  <BorderlessEventEntries
                                    organization={organization}
                                    event={event}
                                    project={projects[0] as Project}
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
                            project={projects[0] as Project}
                            showTagSummary={false}
                          />
                        )}
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
                <EventCustomPerformanceMetrics
                  event={event}
                  location={location}
                  organization={organization}
                  isHomepage={isHomepage}
                />
                {event.groupID && (
                  <LinkedIssue groupId={event.groupID} eventId={event.eventID} />
                )}
                <TagsTable
                  generateUrl={generateTagUrl}
                  event={event}
                  query={eventView.query}
                />
              </Layout.Side>
            )}
          </Layout.Body>
        </Fragment>
      );
    };

    const hasQuickTraceView = organization.features.includes('performance-view');

    if (hasQuickTraceView) {
      const traceId = event.contexts?.trace?.trace_id ?? '';
      const {start, end} = getTraceTimeRangeFromEvent(event);

      return (
        <TraceDetailsRouting event={event}>
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
                skipLight={false}
              >
                {results => render(results, metaResults)}
              </QuickTraceQuery>
            )}
          </TraceMetaQuery>
        </TraceDetailsRouting>
      );
    }

    return render();
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

  const getEventSlug = (): string => {
    const {eventSlug} = props.params;

    if (typeof eventSlug === 'string') {
      return eventSlug.trim();
    }

    return '';
  };

  const {eventView, organization} = props;
  const eventSlug = getEventSlug();
  const projectSlug = eventSlug.split(':')[0];

  const title = generateTitle({eventView, event});

  return (
    <SentryDocumentTitle
      title={title}
      orgSlug={organization.slug}
      projectSlug={projectSlug}
    >
      {renderContent() as React.ReactChild}
    </SentryDocumentTitle>
  );
}

const EventHeaderContainer = styled('div')`
  max-width: ${p => p.theme.breakpoints.small};
`;

const TitleWrapper = styled('div')`
  margin-top: 20px;
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: ${p => p.theme.headerFontSize};
`;

const MessageWrapper = styled('div')`
  margin-top: ${space(1)};
`;

export default EventDetailsContent;
