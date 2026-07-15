import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import {ScmMessagingIntegrationAlertRule} from './scmMessagingIntegrationAlertRule';

describe('ScmMessagingIntegrationAlertRule', () => {
  const organization = OrganizationFixture();
  const slackIntegrations = [
    OrganizationIntegrationsFixture({name: "Moo Deng's Workspace"}),
  ];

  const notificationProps: IssueAlertNotificationProps = {
    actions: [],
    channel: {label: 'channel', value: 'channel'},
    integration: slackIntegrations[0],
    provider: 'slack',
    providersToIntegrations: {slack: slackIntegrations},
    queryError: false,
    querySuccess: true,
    shouldRenderSetupButton: false,
    setActions: jest.fn(),
    setChannel: jest.fn(),
    setIntegration: jest.fn(),
    setProvider: jest.fn(),
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channels/`,
      body: {results: []},
    });
  });

  it('renders the reused provider sentence with its three controls', () => {
    render(<ScmMessagingIntegrationAlertRule {...notificationProps} />, {organization});

    // The same three controls as the classic rule render.
    expect(screen.getByLabelText('provider')).toBeInTheDocument();
    expect(screen.getByLabelText('integration')).toBeInTheDocument();
    expect(screen.getByLabelText('channel')).toBeInTheDocument();

    // The provider sentence text is reused verbatim. The fragments are the
    // column's direct text nodes, so they read as one normalized string
    // ("Send [provider] notification to the [integration] workspace to [channel]").
    expect(screen.getByText('Send notification to the workspace to')).toBeInTheDocument();
  });
});
