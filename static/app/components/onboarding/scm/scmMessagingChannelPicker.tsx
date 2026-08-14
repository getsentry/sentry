import {useMemo, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {
  providerDetails,
  RAW_CHANNEL_FIELD,
  type IntegrationChannel,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  type Channel,
  ChannelField,
  ChannelSelect,
  useMessagingIntegrationAlertRule,
} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

import type {ScmMessagingProviderKey} from './messagingProviders';
import type {ScmMessagingSetup} from './scmMessagingSetup';

export interface ScmMessagingChannelPickerProps {
  /**
   * Eligible integrations for this provider — already filtered to those that
   * can receive Issue Alert actions. Must be non-empty (the picker is only
   * rendered for a `connected` provider).
   */
  integrations: OrganizationIntegration[];
  onConfigured: (setup: ScmMessagingSetup & {mode: 'selected'}) => void;
  /** Pre-seeds the channel selector when editing an existing destination. */
  existingSetup?: ScmMessagingSetup;
  /** When provided a Cancel button is shown (e.g. in Edit mode). */
  onCancel?: () => void;
}

export function ScmMessagingChannelPicker({
  integrations,
  onCancel,
  onConfigured,
  existingSetup,
}: ScmMessagingChannelPickerProps) {
  const firstIntegration = integrations[0];
  const providerKey = (firstIntegration?.provider.key ??
    'slack') as ScmMessagingProviderKey;
  const {channelSelectedBy} = providerDetails[providerKey];

  // The saved destination we're editing, if any. Drives both the dropdown seed
  // and the preserve-on-no-op-save logic below.
  const savedSelection =
    existingSetup?.mode === 'selected' && existingSetup.providerKey === providerKey
      ? existingSetup
      : undefined;

  const defaultIntegration =
    integrations.find(i => i.id === savedSelection?.integrationId) ?? firstIntegration;

  const [selectedIntegration, setSelectedIntegration] = useState<
    OrganizationIntegration | undefined
  >(defaultIntegration);

  const [channel, setChannel] = useState<IntegrationChannel | undefined>(() =>
    // Only seed the channel when the default workspace is the saved one. Switching
    // workspaces starts blank.
    savedSelection && defaultIntegration?.id === savedSelection.integrationId
      ? {label: savedSelection.channelName, value: savedSelection[channelSelectedBy]}
      : undefined
  );

  const providersToIntegrations = useMemo(
    () => ({[providerKey]: integrations}),
    [providerKey, integrations]
  );

  const {
    channelOptions,
    isChannelLoading,
    isChannelError,
    channelsData,
    channelError,
    onChannelChange,
    onCreateChannel,
    onIntegrationChange,
    integrationOptions,
    integrationDisabled,
  } = useMessagingIntegrationAlertRule({
    channel,
    integration: selectedIntegration,
    provider: providerKey,
    setChannel,
    setIntegration: i => {
      if (i) {
        setSelectedIntegration(i);
      }
    },
    setProvider: () => {},
    providersToIntegrations,
    actions: [],
    setActions: () => {},
    queryError: false,
    querySuccess: true,
    shouldRenderSetupButton: false,
  });

  if (!firstIntegration || !selectedIntegration) {
    return null;
  }

  const handleSave = () => {
    if (!channel) {
      return;
    }

    // Match the selected value against whichever field this provider's options
    // are keyed on. Manual entries (channel.new) are not in the list.
    const rawChannel = channel.new
      ? undefined
      : channelsData?.results.find(
          (ch: Channel) => ch[RAW_CHANNEL_FIELD[channelSelectedBy]] === channel.value
        );

    // Prefer the resolved raw channel. If it can't be resolved (empty/errored
    // /channels/ or a dropped channel) but the selection and workspace are unchanged,
    // keep the stored identifiers — otherwise id-keyed providers (msteams, discord)
    // would overwrite channelName with the id and break name-based revalidation.
    // A new value falls through to itself.
    let stored: {channelId: string; channelName: string};

    if (rawChannel) {
      stored = {channelId: rawChannel.id, channelName: rawChannel.display};
    } else if (
      selectedIntegration.id === savedSelection?.integrationId &&
      channel.value === savedSelection?.[channelSelectedBy]
    ) {
      stored = {
        channelId: savedSelection.channelId,
        channelName: savedSelection.channelName,
      };
    } else {
      stored = {channelId: channel.value, channelName: channel.value};
    }

    onConfigured({
      mode: 'selected',
      providerKey,
      integrationId: selectedIntegration.id,
      ...stored,
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
            value={selectedIntegration}
            options={integrationOptions}
            onChange={onIntegrationChange}
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
          disabled={!channel || !!channelError || isChannelLoading}
          onClick={handleSave}
        >
          {t('Add destination')}
        </Button>
      </Flex>
    </Stack>
  );
}
