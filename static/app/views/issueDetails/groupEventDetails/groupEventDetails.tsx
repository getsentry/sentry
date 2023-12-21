import {Fragment, useEffect} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import ArchivedBox from 'sentry/components/archivedBox';
import GroupEventDetailsLoadingError from 'sentry/components/errors/groupEventDetailsLoadingError';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MutedBox from 'sentry/components/mutedBox';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import ResolutionBox from 'sentry/components/resolutionBox';
import useSentryAppComponentsData from 'sentry/stores/useSentryAppComponentsData';
import {space} from 'sentry/styles/space';
import {
  Group,
  GroupActivityReprocess,
  GroupReprocessing,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import usePrevious from 'sentry/utils/usePrevious';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import GroupEventHeader from 'sentry/views/issueDetails/groupEventHeader';
import GroupSidebar from 'sentry/views/issueDetails/groupSidebar';

import ReprocessingProgress from '../reprocessingProgress';
import {
  getEventEnvironment,
  getGroupMostRecentActivity,
  ReprocessingStatus,
  useEnvironmentsFromUrl,
} from '../utils';

const EscalatingIssuesFeedback = HookOrDefault({
  hookName: 'component:escalating-issues-banner-feedback',
});

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; eventId?: string}, {}> {
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
    location,
    event,
    groupReprocessingStatus,
    loadingEvent,
    onRetry,
    eventError,
    params,
  } = props;
  const eventWithMeta = withMeta(event);

  // Reprocessing
  const hasReprocessingV2Feature = organization.features?.includes('reprocessing-v2');
  const {activity: activities} = group;
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const projectId = project.id;
  const environments = useEnvironmentsFromUrl();
  const prevEnvironment = usePrevious(environments);
  const prevEvent = usePrevious(event);

  // load the data
  useSentryAppComponentsData({projectId});

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
        !environments.find(env => env === getEventEnvironment(prevEvent as Event));

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
    const hasEscalatingIssuesUi = organization.features.includes('escalating-issues');
    if (group.status === 'ignored') {
      return (
        <GroupStatusBannerWrapper>
          {hasEscalatingIssuesUi ? (
            <ArchivedBox
              substatus={group.substatus}
              statusDetails={group.statusDetails}
              organization={organization}
            />
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

  const issueTypeConfig = getConfigForIssueType(group, project);

  return (
    <TransactionProfileIdProvider
      projectId={event?.projectID}
      transactionId={event?.type === 'transaction' ? event.id : undefined}
      timestamp={event?.dateReceived}
    >
      <VisuallyCompleteWithData
        id="IssueDetails-EventBody"
        hasData={!loadingEvent && !eventError && defined(eventWithMeta)}
        isLoading={loadingEvent}
      >
        <StyledLayoutBody data-test-id="group-event-details">
          {hasReprocessingV2Feature &&
          groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
            <ReprocessingProgress
              totalEvents={(mostRecentActivity as GroupActivityReprocess).data.eventCount}
              pendingEvents={
                (group.statusDetails as GroupReprocessing['statusDetails']).pendingEvents
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
                      <EscalatingIssuesFeedback
                        organization={organization}
                        group={group}
                      />
                      <QuickTraceContext.Provider value={results}>
                        {eventWithMeta && issueTypeConfig.stats.enabled && (
                          <GroupEventHeader
                            group={group}
                            event={eventWithMeta}
                            project={project}
                          />
                        )}
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
