import {focusManager} from '@tanstack/react-query';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {IssueAlertActionType} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {
  IssueAlertNotificationOptions,
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
  useCreateNotificationAction,
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
    queryError: false,
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
    const mockResponses: jest.Mock[] = [];
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

describe('useCreateNotificationAction', () => {
  const organization = OrganizationFixture();

  const slackIntegration = OrganizationIntegrationsFixture({
    id: '1',
    name: 'my-workspace',
    status: 'active',
    provider: {
      key: 'slack',
      slug: 'slack',
      name: 'Slack',
      canAdd: true,
      canDisable: false,
      features: [],
      aspects: {},
    },
  });

  function addIntegrationsResponse(body: OrganizationIntegration[]) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body,
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('defaults provider and integration from the first result on load', async () => {
    addIntegrationsResponse([slackIntegration]);

    const {result} = renderHookWithProviders(() => useCreateNotificationAction(), {
      organization,
    });

    // Initially unset while the query is pending.
    expect(result.current.notificationProps.provider).toBeUndefined();

    // After the query resolves, defaults to the first provider/integration.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.channel).toBeUndefined();
  });

  it('does not clobber a user-selected channel when the integrations list refetches', async () => {
    const secondIntegration = OrganizationIntegrationsFixture({
      id: '2',
      name: 'another-workspace',
      status: 'active',
      provider: slackIntegration.provider,
    });

    // Initial load returns one integration.
    addIntegrationsResponse([slackIntegration]);

    const {result, rerender} = renderHookWithProviders(
      () => useCreateNotificationAction(),
      {organization}
    );

    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));

    // User picks a channel.
    act(() => {
      result.current.notificationProps.setChannel({label: '#alerts', value: '#alerts'});
    });
    expect(result.current.notificationProps.channel?.value).toBe('#alerts');

    // A refetch comes in with an updated list. Simulate by providing a new mock response
    // with two integrations and re-rendering so the deps change.
    MockApiClient.clearMockResponses();
    addIntegrationsResponse([slackIntegration, secondIntegration]);
    act(() => {
      rerender();
    });

    // The run-once guard holds: provider/integration/channel are not reset.
    expect(result.current.notificationProps.provider).toBe('slack');
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.channel?.value).toBe('#alerts');
  });

  it('auto-selects provider/integration after connect when initial query had no integrations', async () => {
    // First fetch returns nothing (no integrations connected yet).
    addIntegrationsResponse([]);

    const {result} = renderHookWithProviders(() => useCreateNotificationAction(), {
      organization,
    });

    // Query resolves but no integrations: setup button should show, guard not latched.
    await waitFor(() => expect(result.current.notificationProps.querySuccess).toBe(true));
    expect(result.current.notificationProps.provider).toBeUndefined();
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true);

    // User connects an integration. Simulate a refetch by toggling focusManager.
    MockApiClient.clearMockResponses();
    addIntegrationsResponse([slackIntegration]);
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });

    // After the refetch, the auto-select branch should fire and populate the picker.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(false);
  });

  it('restores the persisted selection after a refetch delivers the integration', async () => {
    // First fetch returns nothing (integration not yet visible / mid-load).
    addIntegrationsResponse([]);

    const defaultActions = [
      {
        id: IssueAlertActionType.SLACK,
        workspace: slackIntegration.id,
        channel: '#eng',
      },
    ];

    const {result} = renderHookWithProviders(
      () => useCreateNotificationAction({actions: defaultActions}),
      {organization}
    );

    // Query resolved but integration list empty: setup CTA shown, guard not latched,
    // INTEGRATION must NOT be in actions (picker not half-applied).
    await waitFor(() => expect(result.current.notificationProps.querySuccess).toBe(true));
    expect(result.current.notificationProps.provider).toBeUndefined();
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true);
    expect(result.current.notificationProps.actions).not.toContain(
      MultipleCheckboxOptions.INTEGRATION
    );

    // Refetch delivers the Slack integration (e.g. user connected it via CTA).
    MockApiClient.clearMockResponses();
    addIntegrationsResponse([slackIntegration]);
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });

    // Full restore completes: provider, integration, channel, and actions are set.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.channel?.value).toBe('#eng');
    expect(result.current.notificationProps.actions).toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(false);
  });

  it('resolves provider, integration, and actions from defaultActions on mount', async () => {
    addIntegrationsResponse([slackIntegration]);

    // Stable reference: the init effect depends on `defaultActions`, so an
    // inline array (new ref each render) would cause repeated re-runs.
    const defaultActions = [
      {
        id: IssueAlertActionType.SLACK,
        workspace: slackIntegration.id,
        channel: '#eng',
      },
    ];

    const {result} = renderHookWithProviders(
      () => useCreateNotificationAction({actions: defaultActions}),
      {organization}
    );

    // After the query resolves the restore branch runs: provider, actions, and
    // channel are set from defaultActions.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.actions).toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
    expect(result.current.notificationProps.channel?.value).toBe('#eng');
  });

  it('restore wins when the defaultAction integration is not first in the list', async () => {
    const secondSlack = OrganizationIntegrationsFixture({
      id: '2',
      name: 'second-workspace',
      status: 'active',
      provider: slackIntegration.provider,
    });
    // second-workspace is last, but it's the one in the persisted action.
    addIntegrationsResponse([slackIntegration, secondSlack]);

    const defaultActions = [
      {
        id: IssueAlertActionType.SLACK,
        workspace: secondSlack.id,
        channel: '#team',
      },
    ];

    const {result} = renderHookWithProviders(
      () => useCreateNotificationAction({actions: defaultActions}),
      {organization}
    );

    // Auto-select would have picked slackIntegration (id='1'). The restore
    // branch should instead pick the integration matching workspace='2'.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(secondSlack.id);
    expect(result.current.notificationProps.channel?.value).toBe('#team');
  });

  it('restores the channel from channel_id for a Discord defaultAction', async () => {
    const discordIntegration = OrganizationIntegrationsFixture({
      id: '3',
      name: 'my-server',
      status: 'active',
      provider: {
        key: 'discord',
        slug: 'discord',
        name: 'Discord',
        canAdd: true,
        canDisable: false,
        features: [],
        aspects: {},
      },
    });
    addIntegrationsResponse([discordIntegration]);

    // Stable reference; see comment in the preceding test.
    const defaultActions = [
      {
        id: IssueAlertActionType.DISCORD,
        server: discordIntegration.id,
        channel_id: '2',
      },
    ];

    const {result} = renderHookWithProviders(
      () => useCreateNotificationAction({actions: defaultActions}),
      {organization}
    );

    // Discord actions store the channel under `channel_id`, not `channel`.
    await waitFor(() =>
      expect(result.current.notificationProps.provider).toBe('discord')
    );
    expect(result.current.notificationProps.channel?.value).toBe('2');
  });
});
