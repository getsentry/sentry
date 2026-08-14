import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ScmMessagingChannelPicker} from './scmMessagingChannelPicker';
import type {ScmMessagingSetup} from './scmMessagingSetup';

const organization = OrganizationFixture();

const slackIntegration = OrganizationIntegrationsFixture({
  id: '10',
  name: 'test-workspace',
  provider: {
    key: 'slack',
    slug: 'slack',
    name: 'Slack',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
});

const discordIntegration = OrganizationIntegrationsFixture({
  id: '20',
  name: 'test-server',
  provider: {
    key: 'discord',
    slug: 'discord',
    name: 'Discord',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
});

const msteamsIntegration = OrganizationIntegrationsFixture({
  id: '30',
  name: 'test-team',
  provider: {
    key: 'msteams',
    slug: 'msteams',
    name: 'MS Teams',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
});

// Both providers format `display` as `#{name}`; only `id` distinguishes them,
// which is what makes the name/ID mixup easy to write and hard to spot.
const slackChannel = {id: 'C123', name: 'general', display: '#general', type: 'channel'};
const discordChannel = {
  id: '1234567890',
  name: 'general',
  display: '#general',
  type: 'text',
};

function mockChannels(integrationId: string, results: Array<Record<string, string>>) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/integrations/${integrationId}/channels/`,
    body: {results},
  });
}

function mockChannelValidate(valid: boolean, integrationId: string) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/integrations/${integrationId}/channel-validate/`,
    body: {valid},
  });
}

function renderPicker({
  integration = slackIntegration,
  existingSetup,
}: {
  existingSetup?: ScmMessagingSetup;
  integration?: typeof slackIntegration;
} = {}) {
  const onConfigured = jest.fn();

  render(
    <ScmMessagingChannelPicker
      integration={integration}
      onConfigured={onConfigured}
      existingSetup={existingSetup}
    />,
    {organization}
  );

  return {onConfigured};
}

const selectedDiscordSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'discord',
  integrationId: '20',
  channelId: '1234567890',
  channelName: '#general',
};

const selectedSlackSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: '10',
  channelId: 'C123',
  channelName: '#general',
};

const selectedMsTeamsSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'msteams',
  integrationId: '30',
  channelId: '19:abc123@thread.tacv2',
  channelName: 'General',
};

describe('ScmMessagingChannelPicker', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  describe('staging a new destination', () => {
    it('stores Slack by display name', async () => {
      mockChannels('10', [slackChannel]);
      const {onConfigured} = renderPicker({integration: slackIntegration});

      await selectEvent.select(screen.getByLabelText('channel'), '#general');
      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'slack',
        integrationId: '10',
        channelId: 'C123',
        channelName: '#general',
      });
    });

    it('stores Discord by channel ID', async () => {
      mockChannels('20', [discordChannel]);
      const {onConfigured} = renderPicker({integration: discordIntegration});

      await selectEvent.select(screen.getByLabelText('channel'), '#general (1234567890)');
      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'discord',
        integrationId: '20',
        channelId: '1234567890',
        channelName: '#general',
      });
    });

    it('disables Add destination until a channel is chosen', () => {
      mockChannels('10', [slackChannel]);
      renderPicker({integration: slackIntegration});

      expect(screen.getByRole('button', {name: 'Add destination'})).toBeDisabled();
    });
  });

  describe('manual entry', () => {
    it('keeps a typed Discord channel URL as the action target', async () => {
      mockChannels('20', [discordChannel]);
      // Manual entries validate as you type, via the shared hook's
      // `enabled: !!channel?.new` query.
      mockChannelValidate(true, '20');
      const {onConfigured} = renderPicker({integration: discordIntegration});

      const channelUrl = 'https://discord.com/channels/111/1234567890';
      // ChannelSelect sets formatCreateLabel to the raw input, so the create
      // option is labelled with the typed value, not the default `Create "..."`.
      await selectEvent.create(screen.getByLabelText('channel'), channelUrl, {
        createOptionText: channelUrl,
      });
      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      // Stored as-is: the backend resolves URL to ID in both the validate
      // endpoint and DiscordNotifyServiceForm.clean.
      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'discord',
        integrationId: '20',
        channelId: channelUrl,
        channelName: channelUrl,
      });
    });
  });

  describe('editing an existing destination', () => {
    it('preserves the Discord channel ID through a no-op edit', async () => {
      mockChannels('20', [discordChannel]);
      const {onConfigured} = renderPicker({
        integration: discordIntegration,
        existingSetup: selectedDiscordSetup,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'discord',
        integrationId: '20',
        channelId: '1234567890',
        channelName: '#general',
      });
    });

    it('preserves the Slack channel name through a no-op edit', async () => {
      mockChannels('10', [slackChannel]);
      const {onConfigured} = renderPicker({
        integration: slackIntegration,
        existingSetup: selectedSlackSetup,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'slack',
        integrationId: '10',
        channelId: 'C123',
        channelName: '#general',
      });
    });

    it('preserves stored MS Teams identifiers when the channel list is empty', async () => {
      // msteams selects by id but validates by name, so overwriting channelName
      // with the id (the fallback when the list can't resolve the selection)
      // breaks revalidation. An empty /channels/ must not corrupt the saved name.
      mockChannels('30', []);
      const {onConfigured} = renderPicker({
        integration: msteamsIntegration,
        existingSetup: selectedMsTeamsSetup,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'msteams',
        integrationId: '30',
        channelId: '19:abc123@thread.tacv2',
        channelName: 'General',
      });
    });

    it('preserves stored Discord identifiers when the saved channel is absent from the list', async () => {
      // /channels/ no longer returns the saved channel; a no-op re-save must keep
      // the stored name rather than overwrite it with the id.
      mockChannels('20', []);
      const {onConfigured} = renderPicker({
        integration: discordIntegration,
        existingSetup: selectedDiscordSetup,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      expect(onConfigured).toHaveBeenCalledWith({
        mode: 'selected',
        providerKey: 'discord',
        integrationId: '20',
        channelId: '1234567890',
        channelName: '#general',
      });
    });
  });
});
