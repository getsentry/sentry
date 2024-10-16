import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import MessagingIntegrationAlertRule from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

describe('MessagingIntegrationAlertRule', function () {
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

  const mockSetChannel = jest.fn();
  const mockSetIntegration = jest.fn();
  const mockSetProvider = jest.fn();

  const notificationProps = {
    actions: [],
    channel: 'channel',
    integration: slackIntegrations[0],
    provider: 'slack',
    setActions: jest.fn(),
    setChannel: mockSetChannel,
    setIntegration: mockSetIntegration,
    setProvider: mockSetProvider,
  };

  const providersToIntegrations = {
    slack: slackIntegrations,
    discord: discordIntegrations,
    msteams: msteamsIntegrations,
  };

  const getComponent = () => (
    <MessagingIntegrationAlertRule
      notificationProps={notificationProps}
      providersToIntegrations={providersToIntegrations}
    />
  );

  it('renders', function () {
    render(getComponent());
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('calls setter when new integration is selected', async function () {
    render(getComponent());
    await selectEvent.select(
      screen.getByText("Moo Deng's Workspace"),
      "Moo Waan's Workspace"
    );
    expect(mockSetIntegration).toHaveBeenCalled();
  });

  it('calls setters when new provider is selected', async function () {
    render(getComponent());
    await selectEvent.select(screen.getByText('Slack'), 'Discord');
    expect(mockSetProvider).toHaveBeenCalled();
    expect(mockSetIntegration).toHaveBeenCalled();
    expect(mockSetChannel).toHaveBeenCalled();
  });

  // it('disables integration select when there is only one option', function () {
  //   render(
  //     getComponent({
  //       alertNotificationIntegration: discordIntegrations[0],
  //       alertNotificationProvider: 'discord',
  //     })
  //   );
  //   screen.getByRole('text').click();
  //   expect(screen.getByRole('textbox')).toBeDisabled();
  // });
});
