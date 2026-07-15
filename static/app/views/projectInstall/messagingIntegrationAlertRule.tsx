import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Select, SelectOption} from '@sentry/scraps/select';

import {FormField} from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  type IntegrationChannel,
  type IssueAlertNotificationProps,
  providerDetails,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {useValidateChannel} from 'sentry/views/projectInstall/useValidateChannel';

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
 * Shared data + handlers for the messaging-integration alert rule. Owns the
 * channels query, channel validation, and the provider/integration/channel
 * option lists and change handlers, so the classic inline layout
 * (`MessagingIntegrationAlertRule`) and the SCM stacked layout
 * (`ScmMessagingIntegrationAlertRule`) build identical controls and feed them
 * to the same provider sentence, differing only in presentation.
 *
 * @public Consumed by the SCM layout in a downstream PR.
 */
export function useMessagingIntegrationAlertRule({
  channel,
  integration,
  provider,
  setChannel,
  setIntegration,
  setProvider,
  providersToIntegrations,
}: IssueAlertNotificationProps) {
  const organization = useOrganization();

  const {data: channels, isPending} = useApiQuery<ChannelListResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/integrations/$integrationId/channels/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integration?.id!,
          },
        }
      ),
    ],
    {
      staleTime: Infinity,
      enabled: !!provider && !!integration?.id,
    }
  );

  const validateChannel = useValidateChannel({
    channel,
    integrationId: integration?.id,
    enabled: !!integration?.id && !!channel?.new,
  });

  const providerOptions = useMemo(
    () =>
      Object.keys(providersToIntegrations).map(p => ({
        value: p,
        label: providerDetails[p as keyof typeof providerDetails].name,
      })),
    [providersToIntegrations]
  );
  const integrationOptions = useMemo(
    () =>
      provider && providersToIntegrations[provider]
        ? providersToIntegrations[provider]?.map(i => ({
            value: i,
            label: i.name,
          }))
        : [],
    [providersToIntegrations, provider]
  );

  const channelOptions = useMemo(
    () =>
      channels?.results.map(ch =>
        provider === 'slack'
          ? {label: ch.display, value: ch.display}
          : {label: `${ch.display} (${ch.id})`, value: ch.id}
      ),
    [channels, provider]
  );

  useEffect(() => {
    // A restored channel (e.g. from persisted/default actions) only has a raw
    // id as its label until the channel list loads. Upgrade it to the
    // human-readable label once we can resolve it. Skips user-created
    // channels, which intentionally keep their typed-in label.
    if (!channel || channel.new || !channelOptions) {
      return;
    }
    const match = channelOptions.find(option => option.value === channel.value);
    if (match && match.label !== channel.label) {
      setChannel({value: channel.value, label: match.label, new: false});
    }
  }, [channel, channelOptions, setChannel]);

  return {
    provider,
    integration,
    channel,
    providerOptions,
    integrationOptions,
    channelOptions,
    isChannelLoading: isPending || validateChannel.isFetching,
    channelError: validateChannel.error,
    providerDisabled: Object.keys(providersToIntegrations).length === 1,
    integrationDisabled: integrationOptions.length === 1,
    onProviderChange: (option: any) => {
      setProvider(option.value);
      setIntegration(providersToIntegrations[option.value]![0]);
      setChannel(undefined);
      validateChannel.clear();
    },
    onIntegrationChange: (option: any) => {
      setIntegration(option.value);
      setChannel(undefined);
      validateChannel.clear();
    },
    onChannelChange: (option: {label: React.ReactNode; value: string} | null) => {
      setChannel(
        option ? {value: option.value, label: option.label, new: false} : undefined
      );
      validateChannel.clear();
    },
    onCreateChannel: (newOption: string) => {
      setChannel({value: newOption, label: newOption, new: true});
    },
  };
}

type ChannelSelectProps = {
  disabled: boolean;
  isLoading: boolean;
  onChange: (option: {label: React.ReactNode; value: string} | null) => void;
  onCreateOption: (value: string) => void;
  options: Array<{label: React.ReactNode; value: string}> | undefined;
  provider: string;
  value: IntegrationChannel | undefined;
  className?: string;
};

/**
 * The creatable channel picker, shared by both layouts. The Slack API returns
 * at most 1000 channels, so it stays creatable to let users enter one that is
 * not in the results.
 *
 * @public Consumed by the SCM layout in a downstream PR.
 */
export function ChannelSelect({
  className,
  provider,
  options,
  value,
  isLoading,
  disabled,
  onChange,
  onCreateOption,
}: ChannelSelectProps) {
  return (
    <Select
      className={className}
      aria-label={t('channel')}
      placeholder={providerDetails[provider as keyof typeof providerDetails]?.placeholder}
      isSearchable
      options={options}
      isLoading={isLoading}
      disabled={disabled}
      value={value ? {label: value.label, value: value.value} : null}
      onChange={onChange}
      onCreateOption={onCreateOption}
      clearable
      creatable
      formatCreateLabel={(inputValue: string) => inputValue}
      components={{
        Option: optionProps => (
          <SelectOption
            {...(optionProps as any)}
            data={{
              ...optionProps.data,
              // Hide IconAdd for new channel options by setting __isNew__ to false.
              // We do that to not give the impression that the user can create a new channel.
              __isNew__: false,
            }}
          />
        ),
      }}
    />
  );
}

export function MessagingIntegrationAlertRule(props: IssueAlertNotificationProps) {
  const {
    provider,
    integration,
    channel,
    providerOptions,
    integrationOptions,
    channelOptions,
    isChannelLoading,
    channelError,
    providerDisabled,
    integrationDisabled,
    onProviderChange,
    onIntegrationChange,
    onChannelChange,
    onCreateChannel,
  } = useMessagingIntegrationAlertRule(props);

  if (!provider) {
    return null;
  }

  return (
    <Rule>
      {providerDetails[provider as keyof typeof providerDetails]?.makeSentence({
        providerName: (
          <InlineSelectControl
            aria-label={t('provider')}
            disabled={providerDisabled}
            value={provider}
            options={providerOptions}
            onChange={onProviderChange}
          />
        ),
        integrationName: (
          <InlineSelectControl
            aria-label={t('integration')}
            disabled={integrationDisabled}
            value={integration}
            options={integrationOptions}
            onChange={onIntegrationChange}
          />
        ),
        target: (
          <ChannelField name="channel" error={channelError} inline={false}>
            {() => (
              <InlineChannelSelect
                provider={provider}
                options={channelOptions}
                value={channel}
                isLoading={isChannelLoading}
                disabled={!integration}
                onChange={onChannelChange}
                onCreateOption={onCreateChannel}
              />
            )}
          </ChannelField>
        ),
      })}
    </Rule>
  );
}

const Rule = styled('div')`
  padding: ${p => p.theme.space.md};
  background-color: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const InlineSelectControl = styled(Select)`
  width: 180px;
`;

// Preserves the classic inline channel-select width.
const InlineChannelSelect = styled(ChannelSelect)`
  min-width: 220px;
`;

/** @public Consumed by the SCM layout in a downstream PR. */
export const ChannelField = styled(FormField)`
  padding: 0;
`;
