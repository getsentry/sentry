import {useEffect, useMemo} from 'react';
import isEqual from 'lodash/isEqual';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import LoadingError from 'sentry/components/loadingError';
import useSentryAppComponentsData from 'sentry/stores/useSentryAppComponentsData';
import type {GroupActivityReprocess, GroupReprocessing} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import usePrevious from 'sentry/utils/usePrevious';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {GroupEventDetailsLoading} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsLoading';
import ReprocessingProgress from 'sentry/views/issueDetails/reprocessingProgress';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {
  getEventEnvironment,
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
  useEnvironmentsFromUrl,
} from 'sentry/views/issueDetails/utils';

function GroupEventDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{groupId: string; orgId: string; eventId?: string}>();
  const environments = useEnvironmentsFromUrl();

  const {
    data: event,
    isPending: isLoadingEvent,
    isError: isEventError,
  } = useGroupEvent({
    groupId: params.groupId,
    eventId: params.eventId,
  });

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  const eventWithMeta = useMemo(() => withMeta(event), [event]);
  const project = useProjectFromSlug({organization, projectSlug: group?.project?.slug});
  const prevEnvironment = usePrevious(environments);
  const prevEvent = useMemoWithPrevious<typeof event | null>(
    previousInstance => {
      if (event) {
        return event;
      }
      return previousInstance;
    },
    [event]
  );
  // load the data
  useSentryAppComponentsData({projectId: project?.id});

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
      const environment = getEventEnvironment(prevEvent);
      const shouldRedirect =
        environments.length > 0 && (!environment || !environments.includes(environment));

      if (shouldRedirect) {
        navigate(
          {
            pathname: `/organizations/${organization.slug}/issues/${params.groupId}/`,
            query: location.query,
          },
          {replace: true}
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
    navigate,
  ]);

  // Group and project should already be loaded, but we can render a loading state if it's not
  if (isGroupPending || !project) {
    return <GroupEventDetailsLoading />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  const renderContent = () => {
    if (isLoadingEvent) {
      return <GroupEventDetailsLoading />;
    }

    return (
      <GroupEventDetailsContent group={group} event={eventWithMeta} project={project} />
    );
  };

  const groupReprocessingStatus = getGroupReprocessingStatus(group);

  return (
    <AnalyticsArea name="issue_details">
      <VisuallyCompleteWithData
        id="IssueDetails-EventBody"
        hasData={!isLoadingEvent && !isEventError && defined(eventWithMeta)}
        isLoading={isLoadingEvent}
      >
        <div data-test-id="group-event-details">
          {groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
            <ReprocessingProgress
              totalEvents={
                (getGroupMostRecentActivity(group.activity) as GroupActivityReprocess)
                  .data.eventCount
              }
              pendingEvents={
                (group.statusDetails as GroupReprocessing['statusDetails']).pendingEvents
              }
            />
          ) : (
            <div>{renderContent()}</div>
          )}
        </div>
      </VisuallyCompleteWithData>
    </AnalyticsArea>
  );
}

export default GroupEventDetails;
