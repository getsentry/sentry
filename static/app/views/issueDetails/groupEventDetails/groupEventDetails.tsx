import {Fragment, useEffect} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import {fetchSentryAppComponents} from 'sentry/actionCreators/sentryAppComponents';
import {Client} from 'sentry/api';
import ArchivedBox from 'sentry/components/archivedBox';
import GroupEventDetailsLoadingError from 'sentry/components/errors/groupEventDetailsLoadingError';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import GroupSidebar from 'sentry/components/group/sidebar';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MutedBox from 'sentry/components/mutedBox';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import ResolutionBox from 'sentry/components/resolutionBox';
import {space} from 'sentry/styles/space';
import {
  BaseGroupStatusReprocessing,
  Environment,
  Group,
  GroupActivityReprocess,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import fetchSentryAppInstallations from 'sentry/utils/fetchSentryAppInstallations';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import usePrevious from 'sentry/utils/usePrevious';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import GroupEventHeader from 'sentry/views/issueDetails/groupEventHeader';

import ReprocessingProgress from '../reprocessingProgress';
import {
  getEventEnvironment,
  getGroupMostRecentActivity,
  ReprocessingStatus,
} from '../utils';

const IssuePriorityFeedback = HookOrDefault({
  hookName: 'component:issue-priority-feedback',
});

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; eventId?: string}, {}> {
  api: Client;
  environments: Environment[];
  eventError: boolean;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  loadingEvent: boolean;
  onRetry: () => void;
  organization: Organization;
  project: Project;
  event?: Event;
}

function GroupEventDetails(props: GroupEventDetailsProps) {
  const {
    group,
    project,
    organization,
    environments,
    location,
    event,
    groupReprocessingStatus,
    loadingEvent,
    onRetry,
    eventError,
    api,
    params,
  } = props;
  const eventWithMeta = withMeta(event);

  // Reprocessing
  const hasReprocessingV2Feature = organization.features?.includes('reprocessing-v2');
  const {activity: activities} = group;
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const orgSlug = organization.slug;
  const projectId = project.id;
  const prevEnvironment = usePrevious(environments);
  const prevEvent = usePrevious(event);

  // load the data
  useEffect(() => {
    fetchSentryAppInstallations(api, orgSlug);
    // TODO(marcos): Sometimes PageFiltersStore cannot pick a project.
    if (projectId) {
      fetchSentryAppComponents(api, orgSlug, projectId);
    } else {
      Sentry.withScope(scope => {
        scope.setExtra('orgSlug', orgSlug);
        scope.setExtra('projectId', projectId);
        Sentry.captureMessage('Project ID was not set');
      });
    }
  }, [api, orgSlug, projectId]);
  // If environments are being actively changed and will no longer contain the
  // current event's environment, redirect to latest
  useEffect(() => {
    const environmentsHaveChanged = !isEqual(prevEnvironment, environments);
    // If environments are being actively changed and will no longer contain the
    // current event's environment, redirect to latest
    if (
      environmentsHaveChanged &&
      prevEvent &&
      params.eventId &&
      !['latest', 'oldest'].includes(params.eventId)
    ) {
      const shouldRedirect =
        environments.length > 0 &&
        !environments.find(env => env.name === getEventEnvironment(prevEvent as Event));

      if (shouldRedirect) {
        browserHistory.replace(
          normalizeUrl({
            pathname: `/organizations/${organization.slug}/issues/${params.groupId}/`,
            query: location.query,
          })
        );
        return;
      }
    }
  }, [
    prevEnvironment,
    environments,
    location.query,
    organization.slug,
    params,
    prevEvent,
  ]);

  const renderGroupStatusBanner = () => {
    const hasEscalatingIssuesUi = organization.features.includes('escalating-issues-ui');
    if (group.status === 'ignored') {
      return (
        <GroupStatusBannerWrapper>
          {hasEscalatingIssuesUi ? (
            <ArchivedBox statusDetails={group.statusDetails} />
          ) : (
            <MutedBox statusDetails={group.statusDetails} />
          )}
        </GroupStatusBannerWrapper>
      );
    }

    if (group.status === 'resolved') {
      return (
        <GroupStatusBannerWrapper>
          <ResolutionBox
            statusDetails={group.statusDetails}
            activities={group.activity}
            projectId={project.id}
          />
        </GroupStatusBannerWrapper>
      );
    }

    return null;
  };

  const renderReprocessedBox = () => {
    if (
      groupReprocessingStatus !== ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT &&
      groupReprocessingStatus !== ReprocessingStatus.REPROCESSED_AND_HAS_EVENT
    ) {
      return null;
    }

    const {count, id: groupId} = group;
    const groupCount = Number(count);

    return (
      <ReprocessedBox
        reprocessActivity={mostRecentActivity as GroupActivityReprocess}
        groupCount={groupCount}
        groupId={groupId}
        orgSlug={organization.slug}
      />
    );
  };

  const renderContent = () => {
    if (loadingEvent) {
      return <LoadingIndicator />;
    }

    if (eventError) {
      return (
        <GroupEventDetailsLoadingError environments={environments} onRetry={onRetry} />
      );
    }

    return (
      <GroupEventDetailsContent group={group} event={eventWithMeta} project={project} />
    );
  };

  return (
    <TransactionProfileIdProvider
      projectId={event?.projectID}
      transactionId={event?.type === 'transaction' ? event.id : undefined}
      timestamp={event?.dateReceived}
    >
      <VisuallyCompleteWithData
        id="IssueDetails-EventBody"
        hasData={!loadingEvent && !eventError && defined(eventWithMeta)}
      >
        <StyledLayoutBody data-test-id="group-event-details">
          {hasReprocessingV2Feature &&
          groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
            <ReprocessingProgress
              totalEvents={(mostRecentActivity as GroupActivityReprocess).data.eventCount}
              pendingEvents={
                (group.statusDetails as BaseGroupStatusReprocessing['statusDetails'])
                  .pendingEvents
              }
            />
          ) : (
            <Fragment>
              <QuickTraceQuery
                event={eventWithMeta}
                location={location}
                orgSlug={organization.slug}
              >
                {results => {
                  return (
                    <StyledLayoutMain>
                      {renderGroupStatusBanner()}
                      <IssuePriorityFeedback organization={organization} group={group} />
                      <QuickTraceContext.Provider value={results}>
                        {eventWithMeta && (
                          <GroupEventHeader
                            group={group}
                            event={eventWithMeta}
                            project={project}
                          />
                        )}
                        {renderReprocessedBox()}
                        {renderContent()}
                      </QuickTraceContext.Provider>
                    </StyledLayoutMain>
                  );
                }}
              </QuickTraceQuery>
              <StyledLayoutSide>
                <GroupSidebar
                  organization={organization}
                  project={project}
                  group={group}
                  event={eventWithMeta}
                  environments={environments}
                />
              </StyledLayoutSide>
            </Fragment>
          )}
        </StyledLayoutBody>
      </VisuallyCompleteWithData>
    </TransactionProfileIdProvider>
  );
}

const StyledLayoutBody = styled(Layout.Body)`
  /* Makes the borders align correctly */
  padding: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    align-content: stretch;
  }
`;

const GroupStatusBannerWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledLayoutMain = styled(Layout.Main)`
  padding-top: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding-top: ${space(1)};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    border-right: 1px solid ${p => p.theme.border};
    padding-right: 0;
  }
`;

const StyledLayoutSide = styled(Layout.Side)`
  padding: ${space(3)} ${space(2)} ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding-right: ${space(4)};
    padding-left: 0;
  }
`;

export default GroupEventDetails;
