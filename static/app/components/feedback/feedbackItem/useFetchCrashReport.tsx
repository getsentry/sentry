import {Event, Group, Organization} from 'sentry/types';
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
  const eventEndpoint = `/projects/${organization.slug}/${projectSlug}/events/${crashReportId}/`;
  const {data: eventData, isFetching: isEventFetching} = useApiQuery<Event>(
    [eventEndpoint],
    {retryDelay: 100, staleTime: 0}
  );

  const issueEndpoint = `/organizations/${organization.slug}/issues/${eventData?.groupID}/`;
  const {data: groupData, isFetching: isGroupFetching} = useApiQuery<Group>(
    [issueEndpoint],
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
