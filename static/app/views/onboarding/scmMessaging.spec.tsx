import {act, Fragment, useState} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {IntegrationProviderFixture} from 'sentry-fixture/integrationProvider';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import * as pipelineModal from 'sentry/components/pipeline/modal';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {ScmMessaging} from './scmMessaging';

const selectedPlatform = {
  key: 'javascript-nextjs',
  name: 'Next.js',
  language: 'javascript',
  type: 'framework',
  link: null,
  category: 'browser',
} as const;

const selectedMessagingSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: '15',
  channelId: 'C123',
  channelName: '#alerts',
};

const slackIntegration = OrganizationIntegrationsFixture({
  id: 'slack-1',
  name: 'test-workspace',
  provider: {
    key: 'slack',
    slug: 'slack',
    name: 'slack',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
  status: 'active',
});

const discordIntegration = OrganizationIntegrationsFixture({
  id: 'discord-1',
  name: 'test-server',
  provider: {
    key: 'discord',
    slug: 'discord',
    name: 'discord',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
  status: 'active',
});

const msteamsIntegration = OrganizationIntegrationsFixture({
  id: 'msteams-1',
  name: 'test-teams',
  provider: {
    key: 'msteams',
    slug: 'msteams',
    name: 'msteams',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
  status: 'active',
  configData: {installationType: 'team'},
});

function mockIntegration(
  overrides?: Partial<Parameters<typeof OrganizationIntegrationsFixture>[0]>
) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/integrations/15/',
    body: OrganizationIntegrationsFixture({id: '15', ...overrides}),
  });
}

function mockChannelValidate(valid: boolean, channel = '#alerts') {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/integrations/15/channel-validate/',
    body: {valid},
    match: [MockApiClient.matchQuery({channel})],
  });
}

function mockProviderQueries(integrations: OrganizationIntegration[] = []) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/integrations/',
    match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    body: integrations,
  });
  for (const key of ['slack', 'discord', 'msteams']) {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      match: [MockApiClient.matchQuery({provider_key: key})],
      body: {
        providers: [IntegrationProviderFixture({key, slug: key, name: key})],
      },
    });
  }
}

function renderMessaging(
  onMessagingSetupChange = jest.fn(),
  messagingSetup: ScmMessagingSetup = selectedMessagingSetup,
  onComplete = jest.fn()
) {
  return render(
    <ScmMessaging
      messagingSetup={messagingSetup}
      onMessagingSetupChange={onMessagingSetupChange}
      selectedPlatform={selectedPlatform}
      onComplete={onComplete}
    />
  );
}

describe('ScmMessaging', () => {
  beforeEach(() => {
    mockProviderQueries();
  });

  afterEach(() => {
    cleanup();
    MockApiClient.clearMockResponses();
    // Context-backed tests persist onboarding state to session storage, and
    // useSessionStorage prefers a stored value over initialValue.
    window.sessionStorage.clear();
  });

  it('revalidates a restored destination before showing it as selected', async () => {
    mockIntegration();
    mockChannelValidate(true);
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );
    // channelName is now required at selection time, so the hook has nothing
    // to propagate back via onMessagingSetupChange once validation passes.
    expect(onMessagingSetupChange).not.toHaveBeenCalled();
  });

  it('clears a missing integration with an explanation', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      statusCode: 404,
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    expect(
      await screen.findByText(
        "We couldn't find the saved integration. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    expect(screen.queryByText('Destination added')).not.toBeInTheDocument();
  });

  it('clears an inactive integration with an explanation', async () => {
    mockIntegration({organizationIntegrationStatus: 'disabled'});
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    expect(
      await screen.findByText(
        'The saved integration is no longer active. Choose a destination again.'
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    expect(screen.queryByText('Destination added')).not.toBeInTheDocument();
  });

  it('clears the stale channel warning once a refetch resolves the channel', async () => {
    const queryClient = makeTestQueryClient();
    mockIntegration();
    mockChannelValidate(false);

    render(
      <QueryClientProvider client={queryClient}>
        <ScmMessaging
          messagingSetup={selectedMessagingSetup}
          onMessagingSetupChange={jest.fn()}
          selectedPlatform={selectedPlatform}
        />
      </QueryClientProvider>
    );

    const warning = "We couldn't verify the saved channel. Choose a destination again.";
    expect(await screen.findByText(warning)).toBeInTheDocument();

    // The saved destination itself never changes here, so the reference-change
    // effect cannot be what clears the warning.
    mockChannelValidate(true);
    await queryClient.invalidateQueries();

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );
    await waitFor(() => expect(screen.queryByText(warning)).not.toBeInTheDocument());
  });

  it('Continue stays enabled when revalidation queries fail on a later refetch', async () => {
    const queryClient = makeTestQueryClient();
    mockIntegration();
    mockChannelValidate(true);

    render(
      <QueryClientProvider client={queryClient}>
        <ScmMessaging
          messagingSetup={selectedMessagingSetup}
          onMessagingSetupChange={jest.fn()}
          selectedPlatform={selectedPlatform}
        />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );

    // Both validation queries now return 500 on the next background refetch.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      statusCode: 500,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channel-validate/',
      statusCode: 500,
      match: [MockApiClient.matchQuery({channel: '#alerts'})],
    });
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    // isRefetchError keeps both queries settled; cached {valid: true} stays usable.
    expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
    // isLoadingError (not isError) gates the danger alert, so it must not appear.
    expect(
      screen.queryByText(
        "We couldn't check the saved destination. Reload the page to try again."
      )
    ).not.toBeInTheDocument();
  });

  it('Continue stays enabled while a later revalidation refetch is in flight', async () => {
    const queryClient = makeTestQueryClient();
    mockIntegration();
    mockChannelValidate(true);

    render(
      <QueryClientProvider client={queryClient}>
        <ScmMessaging
          messagingSetup={selectedMessagingSetup}
          onMessagingSetupChange={jest.fn()}
          selectedPlatform={selectedPlatform}
        />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );

    // Replace mocks with gated versions so the refetches stay in flight.
    let releaseGate!: () => void;
    const gate = new Promise<void>(r => {
      releaseGate = r;
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15', status: 'active'}),
      asyncDelay: gate,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channel-validate/',
      body: {valid: true},
      asyncDelay: gate,
      match: [MockApiClient.matchQuery({channel: '#alerts'})],
    });

    // Kick off refetches without awaiting — both queries are now in flight.
    act(() => {
      void queryClient.invalidateQueries();
    });

    // isValid reads from cached data, not isFetching, so Continue must stay enabled.
    expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();

    // Release and confirm Continue stays enabled once the refetches settle.
    act(() => releaseGate());
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );
  });

  it('marks the channel stale without resetting session state when channel-validate returns false', async () => {
    // channel-validate/ returns false for both a missing channel and an upstream
    // API error, so a false response is confirm-only: it marks the channel as
    // unverifiable but does not reset the selection to unconfigured.
    mockIntegration();
    const validateRequest = mockChannelValidate(false);
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    await waitFor(() => expect(validateRequest).toHaveBeenCalled());
    expect(
      await screen.findByText(
        "We couldn't verify the saved channel. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Destination added')).not.toBeInTheDocument();
  });

  it('uses channel ID as the channel-validate param for Discord', async () => {
    const discordSetup: ScmMessagingSetup = {
      mode: 'selected',
      providerKey: 'discord',
      integrationId: '15',
      channelId: '1234567890',
      channelName: '#dev-alerts',
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({
        id: '15',
        provider: {key: 'discord'} as any,
      }),
    });
    // Discord channel-validate takes the numeric channel ID, not the display name.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channel-validate/',
      body: {valid: true},
      match: [MockApiClient.matchQuery({channel: '1234567890'})],
    });

    renderMessaging(jest.fn(), discordSetup);

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );
  });

  it('does not trust a cached destination while revalidating it', async () => {
    const queryClient = makeTestQueryClient();
    const integration = OrganizationIntegrationsFixture({id: '15'});
    const integrationOptions = apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: {organizationIdOrSlug: 'org-slug', integrationId: '15'},
        staleTime: 0,
      }
    );
    const validateOptions = apiOptions.as<{valid: boolean}>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/channel-validate/',
      {
        path: {organizationIdOrSlug: 'org-slug', integrationId: '15'},
        query: {channel: '#alerts'},
        staleTime: 0,
      }
    );
    queryClient.setQueryData(integrationOptions.queryKey, {
      json: integration,
      headers: {},
    });
    queryClient.setQueryData(validateOptions.queryKey, {
      json: {valid: true},
      headers: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      statusCode: 404,
    });
    mockChannelValidate(true);
    const onMessagingSetupChange = jest.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ScmMessaging
          messagingSetup={selectedMessagingSetup}
          onMessagingSetupChange={onMessagingSetupChange}
          selectedPlatform={selectedPlatform}
        />
      </QueryClientProvider>
    );

    expect(screen.queryByText('Destination added')).not.toBeInTheDocument();
    expect(onMessagingSetupChange).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "We couldn't find the saved integration. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
  });

  it('keeps the stale channel warning across unrelated context updates', async () => {
    mockIntegration();
    mockChannelValidate(false);

    function Harness() {
      const {messagingSetup, setMessagingSetup, setSelectedPlatform} =
        useOnboardingContext();

      return (
        <Fragment>
          <button onClick={() => setSelectedPlatform(selectedPlatform)}>
            Touch context
          </button>
          <ScmMessaging
            messagingSetup={messagingSetup}
            onMessagingSetupChange={setMessagingSetup}
            selectedPlatform={selectedPlatform}
          />
        </Fragment>
      );
    }

    render(
      <OnboardingContextProvider initialValue={{messagingSetup: selectedMessagingSetup}}>
        <Harness />
      </OnboardingContextProvider>
    );

    const warning = "We couldn't verify the saved channel. Choose a destination again.";
    expect(await screen.findByText(warning)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Touch context'}));

    expect(screen.getByText(warning)).toBeInTheDocument();
  });

  it('keeps the stale channel warning when the messagingSetup reference changes', async () => {
    mockIntegration();
    mockChannelValidate(false);

    function Harness() {
      const [messagingSetup, setMessagingSetup] = useState(selectedMessagingSetup);

      return (
        <Fragment>
          <button onClick={() => setMessagingSetup(prev => ({...prev}))}>
            New reference
          </button>
          <ScmMessaging
            messagingSetup={messagingSetup}
            onMessagingSetupChange={setMessagingSetup}
            selectedPlatform={selectedPlatform}
          />
        </Fragment>
      );
    }

    render(<Harness />);

    const warning = "We couldn't verify the saved channel. Choose a destination again.";
    expect(await screen.findByText(warning)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'New reference'}));
    expect(screen.getByText(warning)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'New reference'}));
    expect(screen.getByText(warning)).toBeInTheDocument();
  });

  it('renders provider rows once integrations and config queries settle', async () => {
    mockProviderQueries([
      OrganizationIntegrationsFixture({
        id: '15',
        provider: {key: 'slack', slug: 'slack', name: 'Slack'} as any,
        status: 'active',
      }),
    ]);

    renderMessaging(jest.fn(), {mode: 'unconfigured'});

    expect(await screen.findByText('slack')).toBeInTheDocument();
    expect(screen.getByText('discord')).toBeInTheDocument();
    expect(screen.getByText('msteams')).toBeInTheDocument();
  });

  it('Continue is not rendered when no destination is configured', () => {
    renderMessaging(jest.fn(), {mode: 'unconfigured'});
    expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
  });

  it('Continue is disabled while revalidation is in flight', async () => {
    mockIntegration();
    mockChannelValidate(true);
    renderMessaging(jest.fn(), selectedMessagingSetup);

    // Revalidation is still in flight on first paint — Continue is visible but disabled.
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();

    // Once revalidation passes, Continue becomes enabled.
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
    );
  });

  it('Continue is disabled while the saved channel is stale', async () => {
    mockIntegration();
    mockChannelValidate(false);
    renderMessaging(jest.fn(), selectedMessagingSetup);

    expect(
      await screen.findByText(
        "We couldn't verify the saved channel. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });

  it('Continue is disabled when the saved destination cannot be checked', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      statusCode: 500,
    });
    renderMessaging(jest.fn(), selectedMessagingSetup);

    expect(
      await screen.findByText(
        "We couldn't check the saved destination. Reload the page to try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });

  it('Continue calls onComplete', async () => {
    mockIntegration();
    mockChannelValidate(true);
    const onComplete = jest.fn();
    renderMessaging(jest.fn(), selectedMessagingSetup, onComplete);

    // Continue is visible immediately but disabled until revalidation succeeds.
    const continueButton = screen.getByRole('button', {name: 'Continue'});
    await waitFor(() => expect(continueButton).toBeEnabled());

    await userEvent.click(continueButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('Set up later marks setup as skipped and calls onComplete', async () => {
    const onMessagingSetupChange = jest.fn();
    const onComplete = jest.fn();
    renderMessaging(onMessagingSetupChange, {mode: 'unconfigured'}, onComplete);

    await userEvent.click(screen.getByRole('button', {name: 'Set up later'}));
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'skipped'});
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('clears an ineligible destination with an explanation', async () => {
    // A tenant-type MS Teams integration is active but cannot receive issue alerts.
    const msteamsSetup: ScmMessagingSetup = {
      mode: 'selected',
      providerKey: 'msteams',
      integrationId: '15',
      channelId: '19:abc@thread.tacv2',
      channelName: 'General',
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({
        id: '15',
        provider: {key: 'msteams'} as any,
        status: 'active',
        organizationIntegrationStatus: 'active',
        configData: {installationType: 'tenant'},
      }),
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange, msteamsSetup);

    expect(
      await screen.findByText(
        'The saved workspace can no longer receive issue alerts. Choose a destination again.'
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    expect(screen.queryByText('Destination added')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });

  describe('exclusive mode (activeRow)', () => {
    const exclusiveSlackSetup: ScmMessagingSetup = {
      mode: 'selected',
      providerKey: 'slack',
      integrationId: 'slack-1',
      channelId: 'C123',
      channelName: '#alerts',
    };

    function mockExclusiveSlackProviders() {
      mockProviderQueries([slackIntegration, discordIntegration, msteamsIntegration]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/',
        body: slackIntegration,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/channel-validate/',
        body: {valid: true},
        match: [MockApiClient.matchQuery({channel: '#alerts'})],
      });
    }

    function StatefulMessaging({initial}: {initial: ScmMessagingSetup}) {
      const [setup, setSetup] = useState(initial);
      return (
        <ScmMessaging
          messagingSetup={setup}
          onMessagingSetupChange={setSetup}
          selectedPlatform={selectedPlatform}
        />
      );
    }

    it('entering configuring mode hides sibling rows and the footer; Cancel restores them', async () => {
      mockProviderQueries([slackIntegration, discordIntegration, msteamsIntegration]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/channels/',
        body: {results: []},
      });

      renderMessaging(jest.fn(), {mode: 'unconfigured'});

      // All three rows visible initially.
      expect(await screen.findByText('slack')).toBeInTheDocument();
      expect(screen.getByText('discord')).toBeInTheDocument();
      expect(screen.getByText('msteams')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: /Choose destination for slack/})
      );

      // Only slack row visible; footer gone.
      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(screen.queryByText('msteams')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set up later'})
      ).not.toBeInTheDocument();

      // Cancel returns to full list.
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(await screen.findByText('discord')).toBeInTheDocument();
      expect(screen.getByText('msteams')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();
    });

    it('a saved destination hides sibling rows and keeps the footer', async () => {
      mockExclusiveSlackProviders();
      renderMessaging(jest.fn(), exclusiveSlackSetup);

      expect(await screen.findByText('slack')).toBeInTheDocument();
      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(screen.queryByText('msteams')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
      );
    });

    it('saving a destination from the picker keeps siblings hidden and restores the footer', async () => {
      mockExclusiveSlackProviders();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/channels/',
        body: {
          results: [{id: 'C123', name: 'alerts', display: '#alerts', type: 'channel'}],
        },
      });

      render(<StatefulMessaging initial={{mode: 'unconfigured'}} />);

      expect(await screen.findByText('discord')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {name: /Choose destination for slack/})
      );
      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set up later'})
      ).not.toBeInTheDocument();

      await selectEvent.select(screen.getByLabelText('channel'), '#alerts');
      await userEvent.click(screen.getByRole('button', {name: 'Add destination'}));

      // activeRow clears after save; selected setup keeps siblings hidden and
      // brings the footer back.
      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(screen.queryByText('msteams')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled()
      );
    });

    it('Cancel from removing keeps siblings hidden and restores the footer', async () => {
      mockExclusiveSlackProviders();
      renderMessaging(jest.fn(), exclusiveSlackSetup);

      expect(await screen.findByText('slack')).toBeInTheDocument();
      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));

      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set up later'})
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(screen.queryByText('msteams')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();
    });

    it('confirming Remove restores sibling rows and the footer', async () => {
      mockExclusiveSlackProviders();
      render(<StatefulMessaging initial={exclusiveSlackSetup} />);

      expect(await screen.findByText('slack')).toBeInTheDocument();
      expect(screen.queryByText('discord')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));
      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      expect(await screen.findByText('discord')).toBeInTheDocument();
      expect(screen.getByText('msteams')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
    });

    it('clears stale removing activeRow when the destination is cleared externally', async () => {
      const slackSetup: ScmMessagingSetup = {
        mode: 'selected',
        providerKey: 'slack',
        integrationId: 'slack-1',
        channelId: 'C123',
        channelName: '#alerts',
      };
      mockProviderQueries([slackIntegration]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/',
        body: slackIntegration,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/channel-validate/',
        body: {valid: true},
      });

      function MessagingSetupController() {
        const [setup, setSetup] = useState<ScmMessagingSetup>(slackSetup);
        return (
          <Fragment>
            <button onClick={() => setSetup({mode: 'unconfigured'})}>
              Clear destination
            </button>
            <ScmMessaging
              messagingSetup={setup}
              onMessagingSetupChange={setSetup}
              selectedPlatform={selectedPlatform}
            />
          </Fragment>
        );
      }

      render(<MessagingSetupController />);

      expect(await screen.findByText('slack')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Set up later'})).toBeInTheDocument();

      // Enter removing mode — footer disappears.
      await userEvent.click(screen.getByRole('button', {name: /Remove/}));
      expect(
        screen.queryByRole('button', {name: 'Set up later'})
      ).not.toBeInTheDocument();

      // External clear simulates validation reset (e.g. integration went inactive).
      await userEvent.click(screen.getByRole('button', {name: 'Clear destination'}));

      // derivedActiveRow detects the stale removing state and returns null — footer reappears.
      expect(
        await screen.findByRole('button', {name: 'Set up later'})
      ).toBeInTheDocument();
    });

    it('auto-opens the channel picker after a successful install', async () => {
      let pipelineOnComplete: ((data: any) => void) | undefined;
      jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation((opts: any) => {
        pipelineOnComplete = opts.onComplete;
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/slack-1/channels/',
        body: {results: []},
      });

      renderMessaging(jest.fn(), {mode: 'unconfigured'});

      expect(
        await screen.findByRole('button', {name: /Connect slack/i})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /Connect slack/i}));

      let releaseRefetch = () => {};
      const refetchGate = new Promise<void>(resolve => {
        releaseRefetch = resolve;
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/',
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
        body: [slackIntegration],
        asyncDelay: refetchGate,
      });

      act(() => pipelineOnComplete?.(slackIntegration));

      // Exclusive before the refetch settles — footer and siblings must not
      // stay up during that window.
      expect(
        screen.queryByRole('button', {name: 'Set up later'})
      ).not.toBeInTheDocument();
      expect(screen.queryByText('discord')).not.toBeInTheDocument();
      expect(screen.queryByText('msteams')).not.toBeInTheDocument();

      act(() => releaseRefetch());

      // Refetch settled: picker auto-opened (its "Workspace" label), Connect
      // gone, footer still hidden.
      expect(await screen.findByText('Workspace')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /Connect slack/i})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set up later'})
      ).not.toBeInTheDocument();
    });
  });
});
