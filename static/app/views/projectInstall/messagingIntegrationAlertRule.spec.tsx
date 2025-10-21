import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import MessagingIntegrationAlertRule from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

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
    expect(await screen.findByText('#alerts')).toBeInTheDocument();
    expect(screen.getByText('#general')).toBeInTheDocument();
    await selectEvent.select(screen.getByLabelText('channel'), '#alerts');
    expect(mockSetChannel).toHaveBeenCalledWith('#alerts');
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
});
