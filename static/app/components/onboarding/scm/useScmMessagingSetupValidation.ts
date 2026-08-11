import {useEffect, useState} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isNotFoundError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

export type Channel = {
  display: string;
  id: string;
  name: string;
};

type ChannelListResponse = {
  results: Channel[];
};

export type StaleDestinationReason = 'channel' | 'inactiveIntegration' | 'integration';

export function isIntegrationActive(integration: OrganizationIntegration): boolean {
  return (
    integration.status === 'active' &&
    integration.organizationIntegrationStatus === 'active'
  );
}

/**
 * The fetched record only stands in for the saved destination when it still
 * matches the identifiers held in session state and is active on both the
 * integration and its organization link.
 */
function resolveSavedIntegration(
  candidate: OrganizationIntegration | undefined,
  messagingSetup: ScmMessagingSetup
): OrganizationIntegration | undefined {
  if (!candidate || messagingSetup.mode !== 'selected') {
    return undefined;
  }

  // `slug` is serialized from the same `provider.key`, so matching one is enough.
  if (
    candidate.id !== messagingSetup.integrationId ||
    candidate.provider.key !== messagingSetup.providerKey ||
    !isIntegrationActive(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

interface UseScmMessagingSetupValidationParams {
  messagingSetup: ScmMessagingSetup;
  onMessagingSetupChange: (messagingSetup: ScmMessagingSetup) => void;
}

/**
 * Revalidates the organization-scoped identifiers stored in session state.
 * A restored selection is not usable until both queries succeed and resolve
 * the saved integration and channel.
 */
export function useScmMessagingSetupValidation({
  messagingSetup,
  onMessagingSetupChange,
}: UseScmMessagingSetupValidationParams) {
  const organization = useOrganization();
  const [staleReason, setStaleReason] = useState<StaleDestinationReason>();
  const hasSelectedDestination = messagingSetup.mode === 'selected';

  const integrationQuery = useQuery(
    apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: hasSelectedDestination
          ? {
              organizationIdOrSlug: organization.slug,
              integrationId: messagingSetup.integrationId,
            }
          : skipToken,
        staleTime: 0,
      }
    )
  );

  const isMissingIntegration = isNotFoundError(integrationQuery.error);
  const fetchedIntegration = isMissingIntegration ? undefined : integrationQuery.data;
  const hasInactiveIntegration =
    fetchedIntegration !== undefined && !isIntegrationActive(fetchedIntegration);
  const integration = resolveSavedIntegration(fetchedIntegration, messagingSetup);

  // A 404 settles the query as conclusively as a successful fetch does; any
  // other error leaves the saved integration unverified.
  const isIntegrationSettled =
    !integrationQuery.isFetching && (integrationQuery.isSuccess || isMissingIntegration);

  const channelsQuery = useQuery(
    apiOptions.as<ChannelListResponse>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/channels/',
      {
        path: integration
          ? {
              organizationIdOrSlug: organization.slug,
              integrationId: integration.id,
            }
          : skipToken,
        staleTime: 0,
      }
    )
  );

  const areChannelsSettled = channelsQuery.isSuccess && !channelsQuery.isFetching;
  const channel = hasSelectedDestination
    ? channelsQuery.data?.results.find(item => item.id === messagingSetup.channelId)
    : undefined;

  // A newly chosen destination must not inherit the previous one's warning while
  // its own queries are still in flight — the effect below cannot clear it until
  // both settle.
  useEffect(() => {
    if (messagingSetup.mode === 'selected') {
      setStaleReason(undefined);
    }
  }, [messagingSetup]);

  useEffect(() => {
    if (messagingSetup.mode !== 'selected' || !isIntegrationSettled) {
      return;
    }

    if (!integration) {
      setStaleReason(hasInactiveIntegration ? 'inactiveIntegration' : 'integration');
      onMessagingSetupChange({mode: 'unconfigured'});
      return;
    }

    if (!areChannelsSettled) {
      return;
    }

    // Every provider helper in organization_integration_channels.py returns an
    // empty list when the upstream API call fails, so `results: []` cannot be
    // told apart from "the saved channel was deleted". A populated list also
    // is not authoritative: Slack returns at most one 1,000-channel page.
    // Keep an unresolved destination non-submittable without dropping it from
    // session state; only a future direct channel validation can safely reset it.
    if (channelsQuery.data.results.length === 0) {
      return;
    }

    if (!channel) {
      setStaleReason('channel');
      return;
    }

    // Own the cleared state here rather than leaving it to the reference-change
    // effect above: a refetch that resolves a previously unverifiable channel
    // does not change `messagingSetup`, and the warning would outlive it.
    setStaleReason(undefined);

    const channelName = channel.display || channel.name;
    if (channelName !== messagingSetup.channelName) {
      onMessagingSetupChange({...messagingSetup, channelName});
    }
    // `messagingSetup` stays in the deps because the spread above needs the whole
    // object. This effect writes a new object through onMessagingSetupChange, so
    // it re-runs on its own write and only settles because the channelName
    // comparison becomes false. Any future field written unconditionally here
    // turns that fixed point into a session-storage write loop.
  }, [
    areChannelsSettled,
    channel,
    channelsQuery.data,
    hasInactiveIntegration,
    integration,
    isIntegrationSettled,
    messagingSetup,
    onMessagingSetupChange,
  ]);

  return {
    isError:
      hasSelectedDestination &&
      ((!isMissingIntegration && integrationQuery.isError) ||
        (integration !== undefined && channelsQuery.isError)),
    isPending:
      hasSelectedDestination &&
      (integrationQuery.isFetching ||
        (integration !== undefined && channelsQuery.isFetching)),
    isValid:
      isIntegrationSettled &&
      integration !== undefined &&
      areChannelsSettled &&
      channel !== undefined,
    staleReason,
  };
}
