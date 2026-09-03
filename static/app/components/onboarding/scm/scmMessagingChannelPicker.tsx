import {useCallback, useMemo, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, type SelectValue} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {
  providerDetails,
  type IntegrationChannel,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  ChannelField,
  ChannelSelect,
} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';
import {useMessagingChannel} from 'sentry/views/projectInstall/useMessagingChannel';

import type {ScmMessagingProviderKey} from './messagingProviders';
import type {ScmMessagingSetup} from './scmMessagingSetup';

export interface ScmMessagingChannelPickerProps {
  /**
   * Eligible integrations for this provider — already filtered to those that
   * can receive Issue Alert actions.
   */
  eligibleIntegrations: OrganizationIntegration[];
  onConfigured: (setup: ScmMessagingSetup & {mode: 'selected'}) => void;
  providerKey: ScmMessagingProviderKey;
  /** Pre-seeds the channel selector when editing an existing destination. */
  existingSetup?: ScmMessagingSetup;
  /** When provided a Cancel button is shown (e.g. in Edit mode). */
  onCancel?: () => void;
}

export function ScmMessagingChannelPicker({
  eligibleIntegrations,
  onCancel,
  onConfigured,
  existingSetup,
  providerKey,
}: ScmMessagingChannelPickerProps) {
  const {channelSelectedBy} = providerDetails[providerKey];

  // The saved destination we're editing, if any. Seeds the workspace and the
  // channel, whose stored identifiers a no-op save then keeps.
  const savedSelection =
    existingSetup?.mode === 'selected' && existingSetup.providerKey === providerKey
      ? existingSetup
      : undefined;

  const [selectedIntegrationId, setSelectedIntegrationId] = useState(
    savedSelection?.integrationId
  );

  const selectedIntegration =
    eligibleIntegrations.find(i => i.id === selectedIntegrationId) ??
    eligibleIntegrations[0];

  // Keep the chosen channel bound to the workspace it was chosen for. It only
  // surfaces (and is only saved) while its workspace is the selected one, so a
  // fallback after the workspace is removed can never pair a stale channel with a
  // different integration.
  const [channelState, setChannelState] = useState<{
    channel: IntegrationChannel | undefined;
    integrationId: string | undefined;
  }>(() => ({
    integrationId: savedSelection?.integrationId,
    // Only seed the channel when the default workspace is the saved one. Switching
    // workspaces starts blank. The seed carries both stored identifiers, so a
    // no-op save keeps them even when the channel list cannot resolve it.
    channel: savedSelection
      ? {
          label: savedSelection.channelName,
          value: savedSelection[channelSelectedBy],
          channelId: savedSelection.channelId,
          channelName: savedSelection.channelName,
        }
      : undefined,
  }));

  const setChannel = useCallback(
    (nextChannel: IntegrationChannel | undefined) =>
      setChannelState({channel: nextChannel, integrationId: selectedIntegration?.id}),
    [selectedIntegration?.id]
  );

  const channel =
    channelState.integrationId === selectedIntegration?.id
      ? channelState.channel
      : undefined;

  const integrationOptions = useMemo(
    () => eligibleIntegrations.map(i => ({value: i, label: i.name})),
    [eligibleIntegrations]
  );

  const {
    channelOptions,
    isChannelLoading,
    isChannelsError,
    channelError,
    clearChannelValidation,
    onChannelChange,
    onCreateChannel,
  } = useMessagingChannel({
    channel,
    integration: selectedIntegration,
    provider: providerKey,
    setChannel,
    options: {refetchOnWindowFocus: true},
  });

  const handleIntegrationChange = (option: SelectValue<OrganizationIntegration>) => {
    setSelectedIntegrationId(option.value.id);
    setChannel(undefined);
    clearChannelValidation();
  };

  if (!selectedIntegration) {
    return null;
  }

  const handleSave = () => {
    if (!channel) {
      return;
    }

    // A channel from the list, or the seeded saved one, carries both
    // identifiers. A typed channel has only its text, which is stored under
    // both so name-based revalidation reads what the user entered.
    onConfigured({
      mode: 'selected',
      providerKey,
      integrationId: selectedIntegration.id,
      channelId: channel.channelId ?? channel.value,
      channelName: channel.channelName ?? channel.value,
    });
  };

  return (
    <Stack gap="xl">
      <Grid columns="1fr 1fr" gap="md">
        <Stack gap="xs">
          <Text bold size="sm">
            {t('Workspace')}
          </Text>
          <Select
            aria-label={t('workspace')}
            disabled={integrationOptions.length === 1}
            value={selectedIntegration}
            options={integrationOptions}
            onChange={handleIntegrationChange}
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
      {isChannelsError && (
        <Alert variant="warning">
          {t('Failed to load channels. You can still type a channel name.')}
        </Alert>
      )}
      <Flex gap="sm" justify="end">
        {onCancel && (
          <Button size="sm" variant="link" onClick={onCancel}>
            {t('Cancel')}
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={!channel || !!channelError || isChannelLoading}
          onClick={handleSave}
        >
          {t('Add destination')}
        </Button>
      </Flex>
    </Stack>
  );
}
