import {useEffect, useMemo} from 'react';
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  type ChannelIdentityField,
  getChannelSelectedBy,
  type IntegrationChannel,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {validateChannelQueryOptions} from 'sentry/views/projectInstall/useValidateChannel';

type Channel = {
  display: string;
  id: string;
  name: string;
  type: string;
};

type ChannelListResponse = {
  results: Channel[];
};

/**
 * A picker entry for a raw channel, carrying both identifiers so a caller can
 * target whichever field the provider's backend resolves (`channelTargetedBy`).
 * Id-keyed providers show the id alongside the name, since the name alone
 * cannot tell two same-named channels apart.
 */
function toChannelOption(
  channel: Channel,
  channelSelectedBy: ChannelIdentityField
): IntegrationChannel {
  const keyedByName = channelSelectedBy === 'channelName';
  return {
    label: keyedByName ? channel.display : `${channel.display} (${channel.id})`,
    value: keyedByName ? channel.display : channel.id,
    channelId: channel.id,
    channelName: channel.display,
  };
}

type Input = {
  channel: IntegrationChannel | undefined;
  integration: OrganizationIntegration | undefined;
  provider: string | undefined;
  setChannel: (channel?: IntegrationChannel) => void;
  options?: {refetchOnWindowFocus?: boolean};
  /**
   * For project creation, identifies the SCM or legacy experience so the
   * appropriate analytics events are emitted. Omit for flows that do not
   * emit these events (e.g. the destination picker).
   */
  variant?: 'scm' | 'legacy';
};

export type UseMessagingChannelResult = {
  channelError: string | undefined;
  channelOptions: IntegrationChannel[] | undefined;
  channelsData: ChannelListResponse | undefined;
  /**
   * Removes the cached validate-channel query for the current selection.
   * Call when the integration or provider changes so stale errors are cleared.
   */
  clearChannelValidation: () => void;
  isChannelLoading: boolean;
  isChannelsError: boolean;
  onChannelChange: (option: IntegrationChannel | null) => void;
  onCreateChannel: (newOption: string) => void;
};

/**
 * Owns the channel-loading half of messaging alert rules:
 *   - /channels/ query (skipped without provider + integration; staleTime
 *     Infinity unless refetchOnWindowFocus is set)
 *   - /channel-validate/ for manually entered channels
 *   - channelOptions shaping (Slack keyed by display name; Discord and MS Teams
 *     keyed by id with `display (id)` labels, since the name alone cannot
 *     disambiguate same-named channels)
 *   - A channel chosen from the list carries both `channelId` and
 *     `channelName`, so a caller can target whichever field the provider's
 *     backend resolves (`channelTargetedBy`)
 *   - Label-upgrade effect: restores raw-id labels to human-readable once the
 *     channel list loads; never touches user-created (channel.new) entries
 *   - onChannelChange / onCreateChannel with optional variant analytics
 *
 */
export function useMessagingChannel({
  channel,
  integration,
  provider,
  setChannel,
  variant,
  options,
}: Input): UseMessagingChannelResult {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const refetchOnWindowFocus = options?.refetchOnWindowFocus ?? false;

  const {
    data: channels,
    isPending,
    isLoadingError: isChannelsError,
  } = useQuery({
    ...apiOptions.as<ChannelListResponse>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/channels/',
      {
        path:
          provider && integration?.id
            ? {
                organizationIdOrSlug: organization.slug,
                integrationId: integration.id,
              }
            : skipToken,
        staleTime: refetchOnWindowFocus ? 0 : Infinity,
      }
    ),
    refetchOnWindowFocus,
  });

  const validateChannelOptions = validateChannelQueryOptions({
    organizationSlug: organization.slug,
    channel,
    integrationId: integration?.id,
  });
  const validateChannel = useQuery({
    ...validateChannelOptions,
    enabled: !!integration?.id && !!channel?.new,
    refetchOnWindowFocus,
  });
  const channelError =
    validateChannel.data?.valid === false
      ? (validateChannel.data.detail ?? t('Channel not found or restricted'))
      : validateChannel.isLoadingError
        ? t('Unexpected integration channel validation error')
        : undefined;
  const clearChannelValidation = () =>
    queryClient.removeQueries({queryKey: validateChannelOptions.queryKey});

  const channelSelectedBy = getChannelSelectedBy(provider);
  const channelOptions = useMemo(
    () => channels?.results.map(ch => toChannelOption(ch, channelSelectedBy)),
    [channels, channelSelectedBy]
  );

  useEffect(() => {
    // A restored channel (e.g. from persisted/default actions) only has a raw
    // id as its label until the channel list loads. Upgrade it to the
    // human-readable label, and both identifiers, once we can resolve it.
    // Skips user-created channels, which intentionally keep their typed-in
    // label.
    if (!channel || channel.new) {
      return;
    }
    const match = channelOptions?.find(option => option.value === channel.value);
    if (
      match &&
      (match.label !== channel.label || match.channelId !== channel.channelId)
    ) {
      setChannel({...match, new: false});
    }
  }, [channel, channelOptions, setChannel]);

  return {
    channelOptions,
    isChannelLoading: isPending || validateChannel.isFetching,
    // The channels endpoint returns HTTP 200 with an empty results list when the
    // upstream provider API fails, so isChannelsError only catches network or auth
    // failures. An empty channelOptions list may still indicate an unreachable
    // provider rather than a genuinely empty workspace.
    isChannelsError,
    channelsData: channels,
    channelError,
    clearChannelValidation,
    onChannelChange: (option: IntegrationChannel | null) => {
      setChannel(option ? {...option, new: false} : undefined);
      clearChannelValidation();
      if (variant) {
        trackAnalytics('project_creation.notify_channel_changed', {
          organization,
          variant,
        });
      }
    },
    onCreateChannel: (newOption: string) => {
      setChannel({value: newOption, label: newOption, new: true});
      if (variant) {
        trackAnalytics('project_creation.notify_channel_changed', {
          organization,
          variant,
        });
      }
    },
  };
}
