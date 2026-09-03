import {focusManager} from '@tanstack/react-query';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  act,
  cleanup,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {IssueAlertActionType} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {
  buildNotificationSelection,
  IssueAlertNotificationOptions,
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
  useCreateNotificationAction,
  useScmNotificationAction,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

describe('MessagingIntegrationAlertRule', () => {
  const organization = OrganizationFixture();
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
    render(getComponent(), {organization});
    await screen.findByText(/notify via email/i);
    await screen.findByText(/notify via integration/i);
  });

  it('calls setter when new integration option is selected', async () => {
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

  const msteamsIntegration = OrganizationIntegrationsFixture({
    id: '2',
    name: 'my-team',
    status: 'active',
    provider: {
      key: 'msteams',
      slug: 'msteams',
      name: 'Microsoft Teams',
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
    // Unmount active queries before restoring focus to avoid triggering another refetch.
    cleanup();
    focusManager.setFocused(undefined);
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

  it('builds a Microsoft Teams action with the selected channel name', async () => {
    addIntegrationsResponse([msteamsIntegration]);

    const {result} = renderHookWithProviders(() => useCreateNotificationAction(), {
      organization,
    });

    await waitFor(() =>
      expect(result.current.notificationProps.provider).toBe('msteams')
    );

    act(() => {
      result.current.notificationProps.setActions([MultipleCheckboxOptions.INTEGRATION]);
      result.current.notificationProps.setChannel({
        channelName: 'incidents',
        label: 'incidents (19:channel-id@thread.tacv2)',
        value: '19:channel-id@thread.tacv2',
      });
    });

    expect(result.current.getIntegrationAction({shouldCreateRule: true})).toEqual({
      id: IssueAlertActionType.MS_TEAMS,
      team: msteamsIntegration.id,
      channel: 'incidents',
    });
  });

  it('auto-selects provider/integration after connect when initial query had no integrations', async () => {
    // Start unfocused so the later focus transition deterministically triggers a refetch.
    focusManager.setFocused(false);
    addIntegrationsResponse([]);

    const {result} = renderHookWithProviders(() => useCreateNotificationAction(), {
      organization,
    });

    // Query resolves but no integrations: setup button should show, guard not latched.
    await waitFor(() =>
      expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true)
    );
    expect(result.current.notificationProps.querySuccess).toBe(true);
    expect(result.current.notificationProps.provider).toBeUndefined();

    // User connects an integration. Regaining focus refetches the active query.
    MockApiClient.clearMockResponses();
    const refetchRequest = addIntegrationsResponse([slackIntegration]);
    act(() => {
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(refetchRequest).toHaveBeenCalledTimes(1));

    // After the refetch, the auto-select branch should fire and populate the picker.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(false);
  });

  it('restores the persisted selection after a refetch delivers the integration', async () => {
    // Start unfocused so the later focus transition deterministically triggers a refetch.
    focusManager.setFocused(false);
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
    await waitFor(() =>
      expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true)
    );
    expect(result.current.notificationProps.querySuccess).toBe(true);
    expect(result.current.notificationProps.provider).toBeUndefined();
    expect(result.current.notificationProps.actions).not.toContain(
      MultipleCheckboxOptions.INTEGRATION
    );

    // Regaining focus refetches and delivers the newly connected Slack integration.
    MockApiClient.clearMockResponses();
    const refetchRequest = addIntegrationsResponse([slackIntegration]);
    act(() => {
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(refetchRequest).toHaveBeenCalledTimes(1));

    // Full restore completes: provider, integration, channel, and actions are set.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.channel?.value).toBe('#eng');
    expect(result.current.notificationProps.actions).toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(false);
  });

  it('restores an integration action from a combined workflow on mount', async () => {
    addIntegrationsResponse([slackIntegration]);

    // Stable reference: the init effect depends on `defaultActions`, so an
    // inline array (new ref each render) would cause repeated re-runs.
    const defaultActions = [
      {
        id: IssueAlertActionType.NOTIFY_EMAIL,
        targetType: 'IssueOwners',
        fallthroughType: 'ActiveMembers',
      },
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

describe('useScmNotificationAction', () => {
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

  it('auto-selects the first integration when no selection is given', async () => {
    addIntegrationsResponse([slackIntegration]);

    const {result} = renderHookWithProviders(() => useScmNotificationAction(), {
      organization,
    });

    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.actions).not.toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
  });

  it('applies a selection directly, with no decoding, when the integration is already loaded', async () => {
    addIntegrationsResponse([slackIntegration]);

    const {result} = renderHookWithProviders(
      () =>
        useScmNotificationAction({
          provider: 'slack',
          integrationId: slackIntegration.id,
          channel: '#eng',
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.channel?.value).toBe('#eng');
    expect(result.current.notificationProps.actions).toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
    expect(result.current.notificationProps.shouldRenderSetupButton).toBe(false);
  });

  it('picks the selected integration over the first in the list', async () => {
    const secondSlack = OrganizationIntegrationsFixture({
      id: '2',
      name: 'second-workspace',
      status: 'active',
      provider: slackIntegration.provider,
    });
    addIntegrationsResponse([slackIntegration, secondSlack]);

    const {result} = renderHookWithProviders(
      () =>
        useScmNotificationAction({
          provider: 'slack',
          integrationId: secondSlack.id,
          channel: '#team',
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(secondSlack.id);
    expect(result.current.notificationProps.channel?.value).toBe('#team');
  });

  it('waits for a refetch when the selected integration is not loaded yet', async () => {
    // First fetch returns nothing (integration not yet visible / mid-load).
    addIntegrationsResponse([]);

    const {result} = renderHookWithProviders(
      () =>
        useScmNotificationAction({
          provider: 'slack',
          integrationId: slackIntegration.id,
          channel: '#eng',
        }),
      {organization}
    );

    // Query resolved but integration list empty: setup CTA shown, guard not
    // latched, INTEGRATION must NOT be in actions (picker not half-applied).
    await waitFor(() =>
      expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true)
    );
    expect(result.current.notificationProps.querySuccess).toBe(true);
    expect(result.current.notificationProps.provider).toBeUndefined();
    expect(result.current.notificationProps.actions).not.toContain(
      MultipleCheckboxOptions.INTEGRATION
    );

    // Refetch delivers the Slack integration.
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

  it('shows the setup CTA without latching when there are no integrations at all', async () => {
    addIntegrationsResponse([]);

    const {result} = renderHookWithProviders(
      () =>
        useScmNotificationAction({
          provider: 'slack',
          integrationId: slackIntegration.id,
          channel: '#eng',
        }),
      {organization}
    );

    await waitFor(() =>
      expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true)
    );
    expect(result.current.notificationProps.querySuccess).toBe(true);
    expect(result.current.notificationProps.actions).not.toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
  });

  it('falls back to auto-select when no integrationId is given', async () => {
    addIntegrationsResponse([slackIntegration]);

    const {result} = renderHookWithProviders(
      () => useScmNotificationAction({provider: 'slack'}),
      {organization}
    );

    // No integrationId means the hook treats the input as no stored selection
    // and auto-selects the first available integration instead.
    await waitFor(() => expect(result.current.notificationProps.provider).toBe('slack'));
    expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
    expect(result.current.notificationProps.actions).not.toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
  });
});

describe('buildNotificationSelection', () => {
  it('returns undefined when there is no provider or integration selected', () => {
    expect(
      buildNotificationSelection({
        provider: undefined,
        integration: undefined,
        channel: undefined,
      })
    ).toBeUndefined();
  });

  it('returns undefined when provider and integration are set but channel is absent', () => {
    const integration = OrganizationIntegrationsFixture({id: '5'});
    expect(
      buildNotificationSelection({
        provider: 'slack',
        integration,
        channel: undefined,
      })
    ).toBeUndefined();
  });

  it('maps provider, integration id, and channel into a raw selection', () => {
    const integration = OrganizationIntegrationsFixture({id: '5'});
    expect(
      buildNotificationSelection({
        provider: 'slack',
        integration,
        channel: {label: '#eng', value: '#eng'},
      })
    ).toEqual({provider: 'slack', integrationId: '5', channel: '#eng'});
  });
});
