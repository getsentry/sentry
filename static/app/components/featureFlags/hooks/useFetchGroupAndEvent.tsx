import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

interface FetchGroupAndEventParams {
  enabled: boolean;
  eventId: string | undefined;
  groupId: string | undefined;
}

export function useFetchGroupAndEvent({
  eventId,
  groupId,
  enabled,
}: FetchGroupAndEventParams) {
  const organization = useOrganization();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    error: groupError,
  } = useGroup({
    groupId: groupId!,
    options: {enabled: enabled && Boolean(groupId && eventId)},
  });

  const projectSlug = group?.project.slug;
  const {
    data: event,
    isPending: isEventPending,
    isError: isEventError,
    error: eventError,
  } = useApiQuery<Event>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug!,
            eventId: eventId!,
          },
        }
      ),
    ],
    {
      staleTime: Infinity,
      enabled: enabled && Boolean(eventId && projectSlug && organization.slug),
    }
  );

  return {
    event,
    group,
    eventFlags: event?.contexts?.flags?.values?.map(f => f?.flag).filter(defined),

    isPending: isGroupPending || isEventPending,
    isGroupPending,
    isEventPending,
    isError: isGroupError || isEventError,
    isGroupError,
    isEventError,
    error: groupError || eventError,
    groupError,
    eventError,
  };
}
