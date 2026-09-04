import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Select, SelectOption, type SelectValue} from '@sentry/scraps/select';

import {FormField} from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  providerDetails,
  type IntegrationChannel,
  type IssueAlertNotificationProps,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {useMessagingChannel} from 'sentry/views/projectInstall/useMessagingChannel';

/**
 * Shared data + handlers for the messaging-integration alert rule. Owns the
 * provider/integration option lists and change handlers; delegates channel
 * loading, validation, and option shaping to `useMessagingChannel`.
 *
 * The classic inline layout (`MessagingIntegrationAlertRule`) and the SCM
 * stacked layout (`ScmMessagingIntegrationAlertRule`) both call this hook so
 * their controls build channels through one code path and can never drift.
 */
export function useMessagingIntegrationAlertRule(
  {
    channel,
    integration,
    provider,
    setChannel,
    setIntegration,
    setProvider,
    providersToIntegrations,
  }: IssueAlertNotificationProps,
  // For project creation, `variant` identifies the SCM or legacy experience.
  // Other flows leave it undefined and do not emit these change events.
  variant?: 'scm' | 'legacy'
) {
  const organization = useOrganization();

  const {
    channelOptions,
    isChannelLoading,
    isChannelsError,
    channelsData,
    channelError,
    clearChannelValidation,
    onChannelChange,
    onCreateChannel,
  } = useMessagingChannel({channel, integration, provider, setChannel, variant});

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

  return {
    provider,
    integration,
    channel,
    providerOptions,
    integrationOptions,
    channelOptions,
    isChannelLoading,
    isChannelsError,
    channelsData,
    channelError,
    providerDisabled: Object.keys(providersToIntegrations).length === 1,
    integrationDisabled: integrationOptions.length === 1,
    onProviderChange: (option: SelectValue<string>) => {
      setProvider(option.value);
      setIntegration(providersToIntegrations[option.value]![0]);
      setChannel(undefined);
      clearChannelValidation();
      if (variant) {
        trackAnalytics('project_creation.notify_provider_changed', {
          organization,
          provider: option.value,
          variant,
        });
      }
    },
    onIntegrationChange: (option: SelectValue<OrganizationIntegration>) => {
      setIntegration(option.value);
      setChannel(undefined);
      clearChannelValidation();
      if (variant) {
        trackAnalytics('project_creation.notify_integration_changed', {
          organization,
          variant,
        });
      }
    },
    onChannelChange,
    onCreateChannel,
  };
}

type ChannelSelectProps = {
  disabled: boolean;
  isLoading: boolean;
  onChange: (option: IntegrationChannel | null) => void;
  onCreateOption: (value: string) => void;
  options: IntegrationChannel[] | undefined;
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
  const selectedOption = value ?? null;
  const optionsWithSelectedValue =
    selectedOption && !options?.some(option => option.value === selectedOption.value)
      ? [selectedOption, ...(options ?? [])]
      : options;

  return (
    <Select
      className={className}
      aria-label={t('channel')}
      placeholder={providerDetails[provider as keyof typeof providerDetails]?.placeholder}
      isSearchable
      options={optionsWithSelectedValue}
      isLoading={isLoading}
      disabled={disabled}
      value={value?.value ?? null}
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
  } = useMessagingIntegrationAlertRule(props, 'legacy');

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
