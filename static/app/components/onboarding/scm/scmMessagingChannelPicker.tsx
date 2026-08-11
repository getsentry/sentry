import {useMemo, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {IntegrationChannel} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  type Channel,
  ChannelField,
  ChannelSelect,
  useMessagingIntegrationAlertRule,
} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

import type {ScmMessagingProviderKey} from './messagingProviders';
import type {ScmMessagingSetup} from './scmMessagingSetup';

export interface ScmMessagingChannelPickerProps {
  integration: OrganizationIntegration;
  onConfigured: (setup: ScmMessagingSetup & {mode: 'selected'}) => void;
  /** Pre-seeds the channel selector when editing an existing destination. */
  existingSetup?: ScmMessagingSetup;
  /** When provided a Cancel button is shown (e.g. in Edit mode). */
  onCancel?: () => void;
}

export function ScmMessagingChannelPicker({
  integration,
  onCancel,
  onConfigured,
  existingSetup,
}: ScmMessagingChannelPickerProps) {
  const providerKey = integration.provider.key as ScmMessagingProviderKey;

  const [channel, setChannel] = useState<IntegrationChannel | undefined>(() => {
    if (existingSetup?.mode === 'selected' && existingSetup.providerKey === providerKey) {
      return {label: existingSetup.channelName, value: existingSetup.channelName};
    }
    return;
  });

  const providersToIntegrations = useMemo(
    () => ({[providerKey]: [integration]}),
    [providerKey, integration]
  );

  const {
    channelOptions,
    isChannelLoading,
    isChannelError,
    channelsData,
    channelError,
    onChannelChange,
    onCreateChannel,
    integrationOptions,
    integrationDisabled,
  } = useMessagingIntegrationAlertRule({
    channel,
    integration,
    provider: providerKey,
    setChannel,
    setIntegration: () => {},
    setProvider: () => {},
    providersToIntegrations,
    actions: [],
    setActions: () => {},
    queryError: false,
    querySuccess: true,
    shouldRenderSetupButton: false,
  });

  const handleSave = () => {
    if (!channel) {
      return;
    }

    // Look up the real backend channel ID by matching the selected value in
    // the raw channel list. Manual entries (channel.new) have no raw match.
    const rawChannel = channel.new
      ? undefined
      : channelsData?.results.find((ch: Channel) =>
          providerKey === 'slack' ? ch.display === channel.value : ch.id === channel.value
        );

    // Slack revalidation and alert-rule actions both use the display name, so
    // channelId falls back to channel.value for Slack without losing anything.
    const channelId = rawChannel?.id ?? channel.value;
    const channelName =
      providerKey === 'slack' ? channel.value : (rawChannel?.display ?? channel.value);
    const actionTarget = providerKey === 'slack' ? channelName : channelId;

    onConfigured({
      mode: 'selected',
      providerKey,
      integrationId: integration.id,
      channelId,
      channelName,
      actionTarget,
    });
  };

  return (
    <Stack gap="md">
      <Grid columns="1fr 1fr" gap="md">
        <Stack gap="xs">
          <Text bold size="sm">
            {t('Workspace')}
          </Text>
          <Select
            aria-label={t('workspace')}
            disabled={integrationDisabled}
            value={integration}
            options={integrationOptions}
            onChange={() => {}}
          />
        </Stack>
        <Stack gap="xs">
          <Text bold size="sm">
            {t('Channel')}
          </Text>
          <ChannelField
            name="channel"
            error={channelError}
            inline={false}
            flexibleControlStateSize
          >
            {() => (
              <ChannelSelect
                provider={providerKey}
                options={channelOptions}
                value={channel}
                isLoading={isChannelLoading}
                disabled={false}
                onChange={onChannelChange}
                onCreateOption={onCreateChannel}
              />
            )}
          </ChannelField>
        </Stack>
      </Grid>
      {isChannelError && (
        <Alert variant="warning">
          {t('Failed to load channels. You can still type a channel name.')}
        </Alert>
      )}
      <Flex gap="sm" justify="end">
        {onCancel && (
          <Button size="sm" onClick={onCancel}>
            {t('Cancel')}
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={!channel || !!channelError}
          onClick={handleSave}
        >
          {t('Enable alerts')}
        </Button>
      </Flex>
    </Stack>
  );
}
