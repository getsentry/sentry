import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import IssueAlertNotificationOptions from 'sentry/views/projectInstall/issueAlertNotificationOptions';

describe('MessagingIntegrationAlertRule', function () {
  const organization = OrganizationFixture({
    features: ['messaging-integration-onboarding-project-creation'],
  });
  let mockResponse: jest.Mock<any>;
  let integrations: OrganizationIntegration[] = [];
  const mockSetAction = jest.fn();

  const notificationProps = {
    actions: [],
    channel: 'channel',
    integration: undefined,
    provider: 'slack',
    setActions: mockSetAction,
    setChannel: jest.fn(),
    setIntegration: jest.fn(),
    setProvider: jest.fn(),
  };

  const getComponent = () => <IssueAlertNotificationOptions {...notificationProps} />;

  beforeEach(function () {
    integrations = [
      OrganizationIntegrationsFixture({
        name: "Moo Deng's Workspace",
        status: 'disabled',
      }),
      OrganizationIntegrationsFixture({
        name: "Moo Waan's Workspace",
        status: 'disabled',
      }),
    ];
    mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?integrationType=messaging`,
      body: integrations,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders setup button if no integrations are active', async function () {
    const providers = (providerKey: string) => [
      GitHubIntegrationProviderFixture({key: providerKey}),
    ];
    const providerKeys = ['slack', 'discord', 'msteams'];
    const mockResponses: jest.Mock<any>[] = [];
    providerKeys.forEach(providerKey => {
      mockResponses.push(
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/config/integrations/?provider_key=${providerKey}`,
          body: {providers: providers(providerKey)},
        })
      );
    });
    render(getComponent(), {organization: organization});
    await screen.findByText(/notify via email/i);
    expect(screen.queryByText(/notify via integration/i)).not.toBeInTheDocument();
    await screen.findByRole('button', {name: /connect to messaging/i});
    expect(mockResponse).toHaveBeenCalled();
    mockResponses.forEach(mock => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('renders alert configuration if integration is installed', async function () {
    integrations.push(
      OrganizationIntegrationsFixture({
        name: "Moo Toon's Workspace",
        status: 'active',
      })
    );
    render(getComponent(), {organization: organization});
    await screen.findByText(/notify via email/i);
    await screen.findByText(/notify via integration/i);
    expect(mockResponse).toHaveBeenCalled();
  });

  it('calls setter when new integration option is selected', async function () {
    integrations.push(
      OrganizationIntegrationsFixture({
        name: "Moo Toon's Workspace",
        status: 'active',
      })
    );
    render(getComponent(), {organization: organization});
    await screen.findByText(/notify via email/i);
    await screen.findByText(/notify via integration/i);
    await userEvent.click(screen.getByText(/notify via integration/i));
    expect(mockSetAction).toHaveBeenCalled();
  });
});
