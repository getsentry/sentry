import type {Event} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/hooks/featureFlags/useOrganizationFlagLog';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

interface Params {
  enabled: boolean;
  eventId: string | undefined;
  groupId: string | undefined;
  query: Record<string, any>;
}

/**
 * Returns the feature flags that have been changed in a given time period and that appear on the event.
 */
export function useDrawerFlags({eventId, groupId, query, enabled}: Params) {
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
    [`/organizations/${organization.slug}/events/${projectSlug}:${eventId}/`],
    {
      staleTime: Infinity,
      enabled: enabled && Boolean(eventId && projectSlug && organization.slug),
    }
  );

  const eventFlags = event?.contexts?.flags?.values?.map(f => f.flag);

  const {
    data: rawFlagData,
    getResponseHeader,
    isPending: isFlagsPending,
    isError: isFlagsError,
    error: flagsError,
  } = useOrganizationFlagLog({
    organization,
    query: {
      ...query,
      flag: eventFlags,
    },
    enabled: enabled && Boolean(eventFlags?.length),
  });
  const pageLinks = getResponseHeader?.('Link') ?? null;

  return {
    flags: rawFlagData?.data ?? [],
    event,
    group,
    pageLinks,

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
