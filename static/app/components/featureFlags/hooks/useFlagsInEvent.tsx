import {skipToken, useQuery} from '@tanstack/react-query';

import {useFetchGroupAndEvent} from 'sentry/components/featureFlags/hooks/useFetchGroupAndEvent';
import {
  organizationFlagLogOptions,
  useOrganizationFlagLogInfinite,
} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

type FetchGroupAndEventParams = Parameters<typeof useFetchGroupAndEvent>[0];
interface FlagsInEventParams extends FetchGroupAndEventParams {
  query: Record<string, any>;
  event?: Event;
  group?: Group;
}

/**
 * Returns the feature flags that have been changed in a given time period and that appear on the event.
 */
export function useFlagsInEventPaginated({
  eventId,
  groupId,
  query,
  enabled,
}: FlagsInEventParams) {
  const organization = useOrganization();
  const {
    group,
    isGroupPending,
    isGroupError,
    groupError,
    event,
    isEventPending,
    isEventError,
    eventError,
    eventFlags,
    isPending,
    isError,
    error,
  } = useFetchGroupAndEvent({
    eventId,
    groupId,
    enabled,
  });

  const {
    data: rawFlagResp,
    isPending: isFlagsPending,
    isError: isFlagsError,
    error: flagsError,
  } = useQuery({
    ...organizationFlagLogOptions({
      organization,
      query: {
        ...query,
        flag: eventFlags,
      },
    }),
    enabled: enabled && Boolean(eventFlags?.length),
    select: selectJsonWithHeaders,
  });
  const pageLinks = rawFlagResp?.headers.Link ?? null;

  return {
    flags: rawFlagResp?.json?.data ?? [],
    event,
    group,
    pageLinks,

    isPending: isPending || isFlagsPending,
    isGroupPending,
    isEventPending,
    isFlagsPending,
    isError: isError || isFlagsError,
    isGroupError,
    isEventError,
    isFlagsError,
    error: error || flagsError,
    groupError,
    eventError,
    flagsError,
  };
}

/**
 * Returns the feature flags that have been changed in a given time period and that appear on the event.
 */
export function useFlagsInEvent({
  eventId,
  groupId,
  group: groupProp,
  event: eventProp,
  query,
  enabled,
}: FlagsInEventParams) {
  const organization = useOrganization();
  const {
    data: groupData,
    isPending: isGroupPending,
    isError: isGroupError,
    error: groupError,
  } = useGroup({
    groupId: groupId!,
    options: {enabled: enabled && Boolean(groupId && eventId && !groupProp)},
  });
  const group = groupProp ?? groupData;

  const projectSlug = group?.project.slug;
  const eventEnabled =
    enabled && Boolean(eventId && projectSlug && organization.slug) && !eventProp;
  const {
    data: eventData,
    isPending: isEventPending,
    isError: isEventError,
    error: eventError,
  } = useQuery(
    apiOptions.as<Event>()(
      '/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/',
      {
        path: eventEnabled
          ? {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: projectSlug!,
              eventId: eventId!,
            }
          : skipToken,
        staleTime: Infinity,
      }
    )
  );
  const event = eventProp ?? eventData;

  const eventFlags =
    event?.contexts?.flags?.values?.map(f => f?.flag).filter(defined) ?? [];

  const {
    data: rawFlagData,
    isPending: isFlagsPending,
    isError: isFlagsError,
    error: flagsError,
  } = useOrganizationFlagLogInfinite({
    organization,
    query: {
      ...query,
      flag: eventFlags,
    },
    enabled: enabled && Boolean(eventFlags.length),
  });

  return {
    flags: rawFlagData ?? [],
    event,
    group,

    isPending: isGroupPending || isEventPending || isFlagsPending,
    isGroupPending,
    isEventPending,
    isFlagsPending,
    isError: isGroupError || isEventError || isFlagsError,
    isGroupError,
    isEventError,
    isFlagsError,
    error: groupError || eventError || flagsError,
    groupError,
    eventError,
    flagsError,
  };
}
