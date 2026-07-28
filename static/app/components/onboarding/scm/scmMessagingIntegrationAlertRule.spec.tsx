import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import * as analytics from 'sentry/utils/analytics';
import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import {ScmMessagingIntegrationAlertRule} from './scmMessagingIntegrationAlertRule';

describe('ScmMessagingIntegrationAlertRule', () => {
  const organization = OrganizationFixture();
  const slackIntegrations = [
    OrganizationIntegrationsFixture({name: "Moo Deng's Workspace"}),
  ];
  const discordIntegrations = [
    OrganizationIntegrationsFixture({name: "Moo Deng's Server"}),
  ];

  const notificationProps: IssueAlertNotificationProps = {
    actions: [],
    channel: {label: 'channel', value: 'channel'},
    integration: slackIntegrations[0],
    provider: 'slack',
    providersToIntegrations: {
      slack: slackIntegrations,
      discord: discordIntegrations,
    },
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

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('renders the reused provider sentence with its three controls', () => {
    render(
      <ScmMessagingIntegrationAlertRule
        {...notificationProps}
        analyticsFlow="project-creation"
      />,
      {organization}
    );

    // The same three controls as the classic rule render.
    expect(screen.getByLabelText('provider')).toBeInTheDocument();
    expect(screen.getByLabelText('integration')).toBeInTheDocument();
    expect(screen.getByLabelText('channel')).toBeInTheDocument();

    // The provider sentence text is reused verbatim. The fragments are the
    // column's direct text nodes, so they read as one normalized string
    // ("Send [provider] notification to the [integration] workspace to [channel]").
    expect(screen.getByText('Send notification to the workspace to')).toBeInTheDocument();
  });

  it.each([
    ['project-creation', true],
    ['onboarding', false],
  ] as const)(
    'tracks provider changes only in the project-creation flow (%s)',
    async (analyticsFlow, shouldTrack) => {
      const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
      render(
        <ScmMessagingIntegrationAlertRule
          {...notificationProps}
          analyticsFlow={analyticsFlow}
        />,
        {organization}
      );

      await selectEvent.select(screen.getByLabelText('provider'), 'Discord');

      if (shouldTrack) {
        expect(trackAnalyticsSpy).toHaveBeenCalledWith(
          'project_creation.notify_provider_changed',
          expect.objectContaining({provider: 'discord', variant: 'scm'})
        );
      } else {
        expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
          'project_creation.notify_provider_changed',
          expect.anything()
        );
      }
    }
  );
});
