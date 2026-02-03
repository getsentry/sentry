import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  crashReportId: string;
  organization: Organization;
  projectSlug: string;
}

export default function useFetchCrashReport({
  crashReportId,
  organization,
  projectSlug,
}: Props) {
  const {data: eventData, isFetching: isEventFetching} = useApiQuery<Event>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/', {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug,
          eventId: crashReportId,
        },
      }),
    ],
    {
      // The default delay is starts at 1000ms and doubles with each try. That's too slow, we'll just show the error quickly instead.
      retryDelay: 250,
      staleTime: 0,
    }
  );

  const {data: groupData, isFetching: isGroupFetching} = useApiQuery<Group>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/', {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: eventData?.groupID!,
        },
      }),
    ],
    {
      enabled: Boolean(eventData?.groupID),
      staleTime: 0,
    }
  );

  return {
    eventData,
    groupData,
    isFetching: isEventFetching || isGroupFetching,
  };
}
