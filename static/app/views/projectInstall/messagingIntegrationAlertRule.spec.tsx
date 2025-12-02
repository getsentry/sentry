import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import MessagingIntegrationAlertRule from 'sentry/views/projectInstall/messagingIntegrationAlertRule';
import * as useValidateChannelModule from 'sentry/views/projectInstall/useValidateChannel';

function setupValidateChannelSpy() {
  const mockClear = jest.fn();
  const originalUseValidateChannel = useValidateChannelModule.useValidateChannel;
  const spy = jest.spyOn(useValidateChannelModule, 'useValidateChannel');

  spy.mockImplementation((...args) => {
    const result = originalUseValidateChannel(...args);
    return {
      ...result,
      clear: mockClear,
    };
  });

  return {mockClear, spy};
}

describe('MessagingIntegrationAlertRule', () => {
  const organization = OrganizationFixture();
  const slackIntegrations = [
    OrganizationIntegrationsFixture({
      name: "Moo Deng's Workspace",
    }),
    OrganizationIntegrationsFixture({
      name: "Moo Waan's Workspace",
    }),
  ];
  const discordIntegrations = [
    OrganizationIntegrationsFixture({
      name: "Moo Deng's Server",
    }),
  ];
  const msteamsIntegrations = [
    OrganizationIntegrationsFixture({
      name: "Moo Deng's Team",
    }),
  ];

  const providersToIntegrations = {
    slack: slackIntegrations,
    discord: discordIntegrations,
    msteams: msteamsIntegrations,
  };

  const mockSetChannel = jest.fn();
  const mockSetIntegration = jest.fn();
  const mockSetProvider = jest.fn();

  const notificationProps: IssueAlertNotificationProps = {
    actions: [],
    channel: {
      label: 'channel',
      value: 'channel',
    },
    integration: slackIntegrations[0],
    provider: 'slack',
    providersToIntegrations,
    querySuccess: true,
    shouldRenderSetupButton: false,
    setActions: jest.fn(),
    setChannel: mockSetChannel,
    setIntegration: mockSetIntegration,
    setProvider: mockSetProvider,
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channels/`,
      body: {
        results: [],
      },
    });
  });

  const getComponent = () => <MessagingIntegrationAlertRule {...notificationProps} />;

  it('renders', () => {
    render(getComponent());
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('calls setter when new integration is selected', async () => {
    render(getComponent());
    await selectEvent.select(
      screen.getByText("Moo Deng's Workspace"),
      "Moo Waan's Workspace"
    );
    expect(mockSetIntegration).toHaveBeenCalled();
  });

  it('calls setters when new provider is selected', async () => {
    render(getComponent());
    await selectEvent.select(screen.getByText('Slack'), 'Discord');
    expect(mockSetProvider).toHaveBeenCalled();
    expect(mockSetIntegration).toHaveBeenCalled();
    expect(mockSetChannel).toHaveBeenCalled();
  });

  it('disables provider select when there is only one provider option', () => {
    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        providersToIntegrations={{slack: slackIntegrations}}
      />
    );
    expect(screen.getByLabelText('provider')).toBeDisabled();
  });

  it('disables integration select when there is only one integration option', () => {
    render(
      <MessagingIntegrationAlertRule
        {...{
          ...notificationProps,
          integration: discordIntegrations[0],
          provider: 'discord',
        }}
      />
    );
    expect(screen.getByLabelText('integration')).toBeDisabled();
  });

  it('loads channels', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${discordIntegrations[0]!.id}/channels/`,
      body: {
        nextCursor: null,
        results: [
          {id: '1', name: 'general', display: '#general', type: 'text'},
          {id: '2', name: 'alerts', display: '#alerts', type: 'text'},
        ],
      },
    });
    render(
      <MessagingIntegrationAlertRule
        {...{
          ...notificationProps,
          integration: discordIntegrations[0],
          provider: 'discord',
        }}
      />
    );
    await selectEvent.openMenu(screen.getByLabelText('channel'));
    expect(await screen.findByText('#general (1)')).toBeInTheDocument();
    expect(screen.getByText('#alerts (2)')).toBeInTheDocument();
    await selectEvent.select(screen.getByLabelText('channel'), /#alerts/);
    expect(mockSetChannel).toHaveBeenCalledWith({
      label: '#alerts (2)',
      value: '2',
      new: false,
    });
  });

  it('shows empty state when no channels are returned', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${discordIntegrations[0]!.id}/channels/`,
      body: {
        nextCursor: null,
        results: [],
      },
    });

    render(
      <MessagingIntegrationAlertRule
        {...{
          ...notificationProps,
          integration: discordIntegrations[0],
          provider: 'discord',
        }}
      />
    );

    await selectEvent.openMenu(screen.getByLabelText('channel'));
    expect(await screen.findByText('No options')).toBeInTheDocument();
    expect(mockSetChannel).not.toHaveBeenCalled();
  });

  it('set custom channel as "new" when created', async () => {
    render(getComponent());

    await selectEvent.create(screen.getByLabelText('channel'), '#custom-channel', {
      waitForElement: false,
      createOptionText: '#custom-channel',
    });

    expect(mockSetChannel).toHaveBeenCalledWith({
      label: '#custom-channel',
      value: '#custom-channel',
      new: true,
    });
  });

  it('validates custom channel when created', async () => {
    const validationRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: true},
    });

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#custom-channel', value: 'custom-channel', new: true}}
      />
    );

    await waitFor(() => {
      expect(validationRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {channel: '#custom-channel'},
        })
      );
    });
  });

  it('displays validation error when channel is invalid', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();
  });

  it('displays default error message when validation fails without detail', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false},
    });

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(
      await screen.findByText('Channel not found or restricted')
    ).toBeInTheDocument();
  });

  it('displays error when validation request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(
      await screen.findByText('Unexpected integration channel validation error')
    ).toBeInTheDocument();
  });

  it('clears validation error when channel is cleared', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    const {mockClear, spy} = setupValidateChannelSpy();

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mockSetChannel).toHaveBeenCalledWith(undefined);
    expect(mockClear).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('clears validation error when provider is changed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${discordIntegrations[0]!.id}/channels/`,
      body: {results: []},
    });

    const {mockClear, spy} = setupValidateChannelSpy();

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();

    await selectEvent.select(screen.getByText('Slack'), 'Discord');

    expect(mockClear).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('clears validation error when integration is changed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[1]!.id}/channels/`,
      body: {results: []},
    });

    const {mockClear, spy} = setupValidateChannelSpy();

    render(
      <MessagingIntegrationAlertRule
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();

    await selectEvent.select(
      screen.getByText("Moo Deng's Workspace"),
      "Moo Waan's Workspace"
    );

    expect(mockClear).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('displays and sends channel id for microsoft teams', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${msteamsIntegrations[0]!.id}/channels/`,
      body: {
        nextCursor: null,
        results: [
          {id: '1', name: 'general', display: '#general', type: 'text'},
          {id: '2', name: 'alerts', display: '#alerts', type: 'text'},
        ],
      },
    });
    render(
      <MessagingIntegrationAlertRule
        {...{
          ...notificationProps,
          integration: msteamsIntegrations[0],
          provider: 'msteams',
        }}
      />
    );
    await selectEvent.openMenu(screen.getByLabelText('channel'));
    expect(await screen.findByText('#general (1)')).toBeInTheDocument();
    expect(screen.getByText('#alerts (2)')).toBeInTheDocument();
    await selectEvent.select(screen.getByLabelText('channel'), /#alerts/);
    expect(mockSetChannel).toHaveBeenCalledWith({
      label: '#alerts (2)',
      value: '2',
      new: false,
    });
  });
});
