import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import IssueAlertNotificationOptions, {
  type IssueAlertNotificationProps,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

describe('MessagingIntegrationAlertRule', () => {
  const organization = OrganizationFixture();
  const integrations: OrganizationIntegration[] = [];
  const mockSetAction = jest.fn();

  const notificationProps: IssueAlertNotificationProps = {
    actions: [],
    channel: {
      label: 'channel',
      value: 'channel',
    },
    integration: undefined,
    provider: 'slack',
    providersToIntegrations: {},
    querySuccess: true,
    shouldRenderSetupButton: false,
    setActions: mockSetAction,
    setChannel: jest.fn(),
    setIntegration: jest.fn(),
    setProvider: jest.fn(),
  };

  const getComponent = () => <IssueAlertNotificationOptions {...notificationProps} />;

  it('renders setup button if no integrations are active', async () => {
    const providers = (providerKey: string) => [
      GitHubIntegrationProviderFixture({key: providerKey}),
    ];
    const providerKeys = ['slack', 'discord', 'msteams'];
    const mockResponses: Array<jest.Mock<any>> = [];
    providerKeys.forEach(providerKey => {
      mockResponses.push(
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/config/integrations/`,
          body: {providers: providers(providerKey)},
          match: [MockApiClient.matchQuery({provider_key: providerKey})],
        })
      );
    });
    mockResponses.push(
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      })
    );
    render(
      <IssueAlertNotificationOptions {...notificationProps} shouldRenderSetupButton />,
      {organization}
    );
    await screen.findByText(/notify via email/i);
    expect(screen.queryByText(/notify via integration/i)).not.toBeInTheDocument();
    await screen.findByRole('button', {name: /connect to messaging/i});
    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('renders alert configuration if integration is installed', async () => {
    integrations.push(
      OrganizationIntegrationsFixture({
        name: "Moo Toon's Workspace",
        status: 'active',
      })
    );
    render(getComponent(), {organization});
    await screen.findByText(/notify via email/i);
    await screen.findByText(/notify via integration/i);
  });

  it('calls setter when new integration option is selected', async () => {
    integrations.push(
      OrganizationIntegrationsFixture({
        name: "Moo Toon's Workspace",
        status: 'active',
      })
    );
    render(getComponent(), {organization});
    await screen.findByText(/notify via email/i);
    await screen.findByText(/notify via integration/i);
    await userEvent.click(screen.getByText(/notify via integration/i));
    expect(mockSetAction).toHaveBeenCalled();
  });
});
