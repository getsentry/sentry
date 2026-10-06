import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import * as analytics from 'sentry/utils/analytics';
import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import {ScmMessagingIntegrationAlertRule} from './scmMessagingIntegrationAlertRule';

describe('ScmMessagingIntegrationAlertRule', () => {
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
    queryError: false,
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

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  const getComponent = () => (
    <ScmMessagingIntegrationAlertRule
      {...notificationProps}
      analyticsFlow="project-creation"
    />
  );
  const getChannelSelect = () => screen.getByRole('textbox', {name: 'channel'});

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

  it('clears the channel select when channel prop becomes undefined', () => {
    const {rerender} = render(getComponent(), {organization});

    // The initial channel value label is visible.
    expect(screen.getByText('channel')).toBeInTheDocument();

    // Parent state clears channel (e.g. after provider or integration change).
    rerender(
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...notificationProps}
        channel={undefined}
      />
    );

    // The stale channel label must no longer be shown; the select is empty.
    expect(screen.queryByText('channel')).not.toBeInTheDocument();
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
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...notificationProps}
        providersToIntegrations={{slack: slackIntegrations}}
      />
    );
    expect(screen.getByLabelText('provider')).toBeDisabled();
  });

  it('disables integration select when there is only one integration option', () => {
    render(
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
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
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...{
          ...notificationProps,
          integration: discordIntegrations[0],
          provider: 'discord',
        }}
      />
    );
    await selectEvent.openMenu(getChannelSelect());
    expect(await screen.findByText('#general (1)')).toBeInTheDocument();
    expect(screen.getByText('#alerts (2)')).toBeInTheDocument();
    await selectEvent.select(getChannelSelect(), /#alerts/);
    expect(mockSetChannel).toHaveBeenCalledWith({
      label: '#alerts (2)',
      value: '2',
      new: false,
      channelId: '2',
      channelName: '#alerts',
    });
  });

  it('shows the selected channel when no channels are returned', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${discordIntegrations[0]!.id}/channels/`,
      body: {
        nextCursor: null,
        results: [],
      },
    });

    render(
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...{
          ...notificationProps,
          integration: discordIntegrations[0],
          provider: 'discord',
        }}
      />
    );

    await selectEvent.openMenu(getChannelSelect());
    expect(
      await screen.findByRole('menuitemradio', {name: 'channel'})
    ).toBeInTheDocument();
    expect(mockSetChannel).not.toHaveBeenCalled();
  });

  it('set custom channel as "new" when created', async () => {
    render(getComponent());

    await selectEvent.create(getChannelSelect(), '#custom-channel', {
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
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
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
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
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
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
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
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(
      await screen.findByText('Unexpected integration channel validation error')
    ).toBeInTheDocument();
  });

  it('clears the selected channel', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    render(
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mockSetChannel).toHaveBeenCalledWith(undefined);
  });

  it('changes provider after a validation error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${discordIntegrations[0]!.id}/channels/`,
      body: {results: []},
    });

    render(
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();

    await selectEvent.select(screen.getByText('Slack'), 'Discord');
    expect(mockSetProvider).toHaveBeenCalledWith('discord');
  });

  it('changes integration after a validation error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[0]!.id}/channel-validate/`,
      body: {valid: false, detail: 'Channel not found'},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${slackIntegrations[1]!.id}/channels/`,
      body: {results: []},
    });

    render(
      <ScmMessagingIntegrationAlertRule
        analyticsFlow="project-creation"
        {...notificationProps}
        channel={{label: '#invalid-channel', value: '#invalid-channel', new: true}}
      />
    );

    expect(await screen.findByText('Channel not found')).toBeInTheDocument();

    await selectEvent.select(
      screen.getByText("Moo Deng's Workspace"),
      "Moo Waan's Workspace"
    );
    expect(mockSetIntegration).toHaveBeenCalledWith(slackIntegrations[1]);
  });
});
