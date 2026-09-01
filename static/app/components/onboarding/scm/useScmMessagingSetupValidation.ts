import {useEffect, useState} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isNotFoundError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {providerDetails} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

export type StaleDestinationReason =
  | 'channel'
  | 'inactiveIntegration'
  | 'ineligibleIntegration'
  | 'integration';

export function isIntegrationActive(integration: OrganizationIntegration): boolean {
  return (
    integration.status === 'active' &&
    integration.organizationIntegrationStatus === 'active'
  );
}

/**
 * Returns true when the integration can receive Issue Alert actions.
 * MS Teams "tenant" installations route notifications differently and
 * cannot be used as an issue-alert destination.
 */
export function isEligibleForIssueAlerts(integration: OrganizationIntegration): boolean {
  if (integration.provider.key !== 'msteams') {
    return true;
  }
  return integration.configData?.installationType !== 'tenant';
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
    !isIntegrationActive(candidate) ||
    !isEligibleForIssueAlerts(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

/**
 * Returns the value to send as the `channel` query param to channel-validate/,
 * reading the field this provider validates by from the provider table.
 * Returns undefined when that field is absent (e.g. legacy msteams data written
 * before channelName was required).
 */
function channelValidateParam(messagingSetup: ScmMessagingSetup): string | undefined {
  if (messagingSetup.mode !== 'selected') {
    return undefined;
  }
  const {channelValidatedBy} = providerDetails[messagingSetup.providerKey];
  return messagingSetup[channelValidatedBy] || undefined;
}

interface UseScmMessagingSetupValidationParams {
  messagingSetup: ScmMessagingSetup;
  onMessagingSetupChange: (messagingSetup: ScmMessagingSetup) => void;
}

/**
 * Revalidates the organization-scoped identifiers stored in session state.
 * A restored selection is not usable until both the integration query and the
 * channel-validate query confirm the saved destination is still reachable.
 *
 * channel-validate/ is treated as a confirm-only signal: a {valid: false}
 * response marks the channel stale but does not reset session state, because
 * the endpoint also returns false for upstream API errors. Only a conclusive
 * {valid: true} response clears the stale warning.
 */
export function useScmMessagingSetupValidation({
  messagingSetup,
  onMessagingSetupChange,
}: UseScmMessagingSetupValidationParams) {
  const organization = useOrganization();
  const [staleReason, setStaleReason] = useState<StaleDestinationReason>();
  const hasSelectedDestination = messagingSetup.mode === 'selected';

  const integrationQuery = useQuery({
    ...apiOptions.as<OrganizationIntegration>()(
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
    ),
    refetchOnWindowFocus: true,
  });

  const isMissingIntegration = isNotFoundError(integrationQuery.error);
  const fetchedIntegration = isMissingIntegration ? undefined : integrationQuery.data;
  const hasInactiveIntegration =
    fetchedIntegration !== undefined && !isIntegrationActive(fetchedIntegration);
  const hasIneligibleIntegration =
    fetchedIntegration !== undefined && !isEligibleForIssueAlerts(fetchedIntegration);
  const integration = resolveSavedIntegration(fetchedIntegration, messagingSetup);

  // A 404, or a failed refetch that retains cached data, settles as conclusively
  // as a success; only a first-load failure leaves the integration unverified.
  const isIntegrationSettled =
    !integrationQuery.isFetching &&
    (integrationQuery.isSuccess ||
      integrationQuery.isRefetchError ||
      isMissingIntegration);

  const validateParam =
    integration === undefined ? undefined : channelValidateParam(messagingSetup);

  const channelValidateQuery = useQuery({
    ...apiOptions.as<{valid: boolean; detail?: string}>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/channel-validate/',
      {
        path:
          integration && validateParam !== undefined
            ? {
                organizationIdOrSlug: organization.slug,
                integrationId: integration.id,
              }
            : skipToken,
        query: validateParam === undefined ? undefined : {channel: validateParam},
        staleTime: 0,
      }
    ),
    refetchOnWindowFocus: true,
  });

  // As with the integration query, a failed background refetch keeps the last
  // successful result usable so a transient focus refetch cannot strand a
  // previously-confirmed channel.
  const isChannelSettled =
    !channelValidateQuery.isFetching &&
    (channelValidateQuery.isSuccess || channelValidateQuery.isRefetchError);

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
      setStaleReason(
        hasInactiveIntegration
          ? 'inactiveIntegration'
          : hasIneligibleIntegration
            ? 'ineligibleIntegration'
            : 'integration'
      );
      onMessagingSetupChange({mode: 'unconfigured'});
      return;
    }

    // Without a validate param we cannot confirm the channel — skip rather
    // than falsely marking it stale (covers legacy session data).
    if (validateParam === undefined || !isChannelSettled) {
      return;
    }

    // channel-validate/ returns {valid: false} for both a genuinely missing
    // channel and an upstream API error, so a false result cannot safely reset
    // the selection. Only a confirmed {valid: true} clears the warning.
    if (!channelValidateQuery.data.valid) {
      setStaleReason('channel');
      return;
    }

    setStaleReason(undefined);
  }, [
    channelValidateQuery.data,
    hasInactiveIntegration,
    hasIneligibleIntegration,
    integration,
    isChannelSettled,
    isIntegrationSettled,
    messagingSetup,
    onMessagingSetupChange,
    validateParam,
  ]);

  const isChannelValidateError =
    integration !== undefined &&
    validateParam !== undefined &&
    channelValidateQuery.isLoadingError;

  return {
    isError:
      hasSelectedDestination &&
      ((!isMissingIntegration && integrationQuery.isLoadingError) ||
        isChannelValidateError),
    isPending:
      hasSelectedDestination &&
      (integrationQuery.isFetching ||
        (integration !== undefined &&
          validateParam !== undefined &&
          channelValidateQuery.isFetching)),
    // Use last known data rather than settled flags so a background refetch
    // (focus or manual) isn't considered stale/invalid.
    isValid: integration !== undefined && !!channelValidateQuery.data?.valid,
    staleReason,
  };
}
