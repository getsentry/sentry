import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {cleanup, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useMessagingChannel} from 'sentry/views/projectInstall/useMessagingChannel';

const organization = OrganizationFixture();

const slackIntegration = OrganizationIntegrationsFixture({id: '10'});
const discordIntegration = OrganizationIntegrationsFixture({id: '20'});

function mockChannels(integrationId: string, results: Array<Record<string, string>>) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/integrations/${integrationId}/channels/`,
    body: {results},
  });
}

function renderChannel(
  provider: string,
  integration: OrganizationIntegration,
  setChannel = jest.fn()
) {
  return renderHookWithProviders(
    () =>
      useMessagingChannel({
        channel: undefined,
        integration,
        provider,
        setChannel,
      }),
    {organization}
  );
}

describe('useMessagingChannel', () => {
  afterEach(() => {
    cleanup();
    MockApiClient.clearMockResponses();
  });

  describe('option shaping', () => {
    it('keys Slack options by display name', async () => {
      mockChannels('10', [
        {id: 'C123', name: 'general', display: '#general', type: 'channel'},
      ]);

      const {result} = renderChannel('slack', slackIntegration);

      await waitFor(() => expect(result.current.channelOptions).toBeDefined());
      expect(result.current.channelOptions).toEqual([
        {label: '#general', value: '#general'},
      ]);
    });

    it('keys Discord options by id with display label', async () => {
      mockChannels('20', [
        {id: '1234567890', name: 'general', display: '#general', type: 'text'},
      ]);

      const {result} = renderChannel('discord', discordIntegration);

      await waitFor(() => expect(result.current.channelOptions).toBeDefined());
      expect(result.current.channelOptions).toEqual([
        {label: '#general (1234567890)', value: '1234567890'},
      ]);
    });
  });

  describe('label upgrade', () => {
    it('upgrades a restored id-as-label once the channel list loads', async () => {
      mockChannels('20', [{id: '2', name: 'alerts', display: '#alerts', type: 'text'}]);

      const mockSetChannel = jest.fn();
      renderHookWithProviders(
        () =>
          useMessagingChannel({
            // Restored from persisted state: raw id used as placeholder label
            // until the channel list resolves it to a human-readable name.
            channel: {label: '2', value: '2'},
            integration: discordIntegration,
            provider: 'discord',
            setChannel: mockSetChannel,
          }),
        {organization}
      );

      await waitFor(() =>
        expect(mockSetChannel).toHaveBeenCalledWith({
          label: '#alerts (2)',
          value: '2',
          new: false,
        })
      );
    });

    it('does not call setChannel when the label is already resolved', async () => {
      mockChannels('10', [
        {id: '1', name: 'general', display: '#general', type: 'channel'},
      ]);

      const mockSetChannel = jest.fn();
      const {result} = renderHookWithProviders(
        () =>
          useMessagingChannel({
            channel: {label: '#general', value: '#general', new: false},
            integration: slackIntegration,
            provider: 'slack',
            setChannel: mockSetChannel,
          }),
        {organization}
      );

      await waitFor(() => expect(result.current.channelOptions).toBeDefined());
      expect(mockSetChannel).not.toHaveBeenCalled();
    });
  });
});
