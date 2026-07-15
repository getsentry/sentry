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

  it('resolves provider, integration, and actions from defaultActions on mount', async () => {
    addIntegrationsResponse([slackIntegration]);

    // Stable reference: the autofill effect depends on `defaultActions`, so an
    // inline array (new ref each render) would loop render -> setState -> render.
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

    await act(async () => {});

    // Autofill effect from defaultActions sets provider, integration, and channel.
    expect(result.current.notificationProps.provider).toBe('slack');
    expect(result.current.notificationProps.actions).toContain(
      MultipleCheckboxOptions.INTEGRATION
    );
    expect(result.current.notificationProps.channel?.value).toBe('#eng');
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

    await act(async () => {});

    // Discord actions store the channel under `channel_id`, not `channel`.
    expect(result.current.notificationProps.provider).toBe('discord');
    expect(result.current.notificationProps.channel?.value).toBe('2');
  });
});
