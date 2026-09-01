import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  cleanup,
  renderHookWithProviders,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {IntegrationChannel} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {useMessagingChannel} from 'sentry/views/projectInstall/useMessagingChannel';

const organization = OrganizationFixture();

const slackIntegration = OrganizationIntegrationsFixture({id: '10'});
const discordIntegration = OrganizationIntegrationsFixture({id: '20'});

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

type RenderChannelOpts = {
  channel?: IntegrationChannel;
  options?: Parameters<typeof useMessagingChannel>[0]['options'];
  setChannel?: jest.Mock;
};

function renderChannel(
  provider: string,
  integration: typeof slackIntegration,
  {channel, setChannel = jest.fn(), options}: RenderChannelOpts = {}
) {
  return renderHookWithProviders(
    () =>
      useMessagingChannel({
        channel,
        integration,
        provider,
        setChannel,
        options,
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
      renderChannel('discord', discordIntegration, {
        // Restored from persisted state: raw id used as placeholder label
        // until the channel list resolves it to a human-readable name.
        channel: {label: '2', value: '2'},
        setChannel: mockSetChannel,
      });

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
      const {result} = renderChannel('slack', slackIntegration, {
        channel: {label: '#general', value: '#general', new: false},
        setChannel: mockSetChannel,
      });

      await waitFor(() => expect(result.current.channelOptions).toBeDefined());
      expect(mockSetChannel).not.toHaveBeenCalled();
    });
  });

  describe('background refetch resilience', () => {
    it('keeps channelOptions when a later channels refetch fails', async () => {
      const queryClient = makeTestQueryClient();
      mockChannels('10', [
        {id: 'C123', name: 'general', display: '#general', type: 'channel'},
      ]);

      const {result} = renderHookWithProviders(
        () =>
          useMessagingChannel({
            channel: undefined,
            integration: slackIntegration,
            provider: 'slack',
            setChannel: jest.fn(),
            options: {refetchOnWindowFocus: true},
          }),
        {
          organization,
          additionalWrapper: ({children}) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => expect(result.current.channelOptions).toBeDefined());
      expect(result.current.isChannelsError).toBe(false);

      // Swap the endpoint for a 500 and trigger a background refetch.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/10/channels/`,
        statusCode: 500,
      });
      await act(async () => {
        await queryClient.invalidateQueries();
      });

      // isLoadingError stays false — cached options must remain intact.
      expect(result.current.isChannelsError).toBe(false);
      expect(result.current.channelOptions).toEqual([
        {label: '#general', value: '#general'},
      ]);
    });

    it('keeps channelError undefined when a later channel-validate refetch fails', async () => {
      const queryClient = makeTestQueryClient();
      mockChannels('10', []);
      mockChannelValidate(true, '10');

      const {result} = renderHookWithProviders(
        () =>
          useMessagingChannel({
            channel: {label: '#monitoring', value: '#monitoring', new: true},
            integration: slackIntegration,
            provider: 'slack',
            setChannel: jest.fn(),
            options: {refetchOnWindowFocus: true},
          }),
        {
          organization,
          additionalWrapper: ({children}) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => expect(result.current.channelError).toBeUndefined());

      // Swap validate for a 500 and trigger a background refetch.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/10/channel-validate/`,
        statusCode: 500,
      });
      await act(async () => {
        await queryClient.invalidateQueries();
      });

      // isLoadingError stays false — channelError must remain undefined.
      expect(result.current.channelError).toBeUndefined();
    });
  });
});
