import {useQuery} from '@tanstack/react-query';

import type {Event} from 'sentry/types/event';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
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
  } = useQuery({
    ...apiOptions.as<Event>()(
      '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug!,
          eventId: eventId!,
        },
        staleTime: Infinity,
      }
    ),
    enabled: enabled && Boolean(eventId && projectSlug && organization.slug),
  });

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
