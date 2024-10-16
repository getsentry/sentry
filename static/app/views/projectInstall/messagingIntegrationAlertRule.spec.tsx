import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {IssueAlertNotificationContext} from 'sentry/views/projectInstall/issueAlertNotificationContext';
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

  const mockSetAlertNotificationChannel = jest.fn();
  const mockSetAlertNotificationIntegration = jest.fn();
  const mockSetAlertNotificationProvider = jest.fn();

  const issueAlertNotificationContextValue = {
    alertNotificationAction: [],
    alertNotificationChannel: 'channel',
    alertNotificationIntegration: slackIntegrations[0],
    alertNotificationProvider: 'slack',
    setAlertNotificationAction: jest.fn(),
    setAlertNotificationChannel: mockSetAlertNotificationChannel,
    setAlertNotificationIntegration: mockSetAlertNotificationIntegration,
    setAlertNotificationProvider: mockSetAlertNotificationProvider,
  };

  const providersToIntegrations = {
    slack: slackIntegrations,
    discord: discordIntegrations,
    msteams: msteamsIntegrations,
  };

  const getComponent = props => (
    <IssueAlertNotificationContext.Provider
      value={{...issueAlertNotificationContextValue, ...props}}
    >
      <MessagingIntegrationAlertRule providersToIntegrations={providersToIntegrations} />
    </IssueAlertNotificationContext.Provider>
  );

  it('renders', function () {
    render(getComponent({}));
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('calls setter when new integration is selected', async function () {
    render(getComponent({}));
    await selectEvent.select(
      screen.getByText("Moo Deng's Workspace"),
      "Moo Waan's Workspace"
    );
    expect(mockSetAlertNotificationIntegration).toHaveBeenCalled();
  });

  it('calls setters when new provider is selected', async function () {
    render(getComponent({}));
    await selectEvent.select(screen.getByText('Slack'), 'Discord');
    expect(mockSetAlertNotificationProvider).toHaveBeenCalled();
    expect(mockSetAlertNotificationIntegration).toHaveBeenCalled();
    expect(mockSetAlertNotificationChannel).toHaveBeenCalled();
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
