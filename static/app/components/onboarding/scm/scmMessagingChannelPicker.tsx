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

  const {channelSelectedBy} = providerDetails[providerKey];

  // The saved destination we're editing, if any. Drives both the dropdown seed
  // and the preserve-on-no-op-save logic below.
  const savedSelection =
    existingSetup?.mode === 'selected' && existingSetup.providerKey === providerKey
      ? existingSetup
      : undefined;

  const [channel, setChannel] = useState<IntegrationChannel | undefined>(() =>
    // Seed by whatever field this provider's options are keyed on. Seeding the
    // wrong one resolves to no option and handleSave rewrites the identifiers.
    savedSelection
      ? {label: savedSelection.channelName, value: savedSelection[channelSelectedBy]}
      : undefined
  );

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

    // Match the selected value against whichever field this provider's options
    // are keyed on. Manual entries (channel.new) are not in the list.
    const rawChannel = channel.new
      ? undefined
      : channelsData?.results.find(
          (ch: Channel) => ch[RAW_CHANNEL_FIELD[channelSelectedBy]] === channel.value
        );

    // Prefer the resolved raw channel. If it can't be resolved (empty/errored
    // /channels/ or a dropped channel) but the selection is unchanged, keep the
    // stored identifiers — otherwise id-keyed providers (msteams, discord) would
    // overwrite channelName with the id and break name-based revalidation. A new
    // value falls through to itself.
    let stored: {channelId: string; channelName: string};

    if (rawChannel) {
      stored = {channelId: rawChannel.id, channelName: rawChannel.display};
    } else if (savedSelection && channel.value === savedSelection[channelSelectedBy]) {
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
      integrationId: integration.id,
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
          {t('Add destination')}
        </Button>
      </Flex>
    </Stack>
  );
}
