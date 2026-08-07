import {Fragment, useState} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {ScmMessaging} from './scmMessaging';

const selectedPlatform: OnboardingSelectedSDK = {
  key: 'javascript-nextjs',
  name: 'Next.js',
  language: 'javascript',
  type: 'framework',
  link: null,
  category: 'browser',
};

const selectedMessagingSetup: ScmMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: '15',
  channelId: 'C123',
};

function renderMessaging(
  onMessagingSetupChange = jest.fn(),
  messagingSetup = selectedMessagingSetup
) {
  return render(
    <ScmMessaging
      messagingSetup={messagingSetup}
      onMessagingSetupChange={onMessagingSetupChange}
      selectedPlatform={selectedPlatform}
    />
  );
}

describe('ScmMessaging', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    // Context-backed tests persist onboarding state to session storage, and
    // useSessionStorage prefers a stored value over initialValue.
    window.sessionStorage.clear();
  });

  it('revalidates a restored destination before showing it as selected', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {
        results: [{id: 'C123', name: 'alerts', display: '#alerts', type: 'text'}],
      },
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    expect(await screen.findByText('Destination selected')).toBeInTheDocument();
    await waitFor(() => {
      expect(onMessagingSetupChange).toHaveBeenCalledWith({
        ...selectedMessagingSetup,
        channelName: '#alerts',
      });
    });
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
    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
  });

  it('clears an inactive integration with an explanation', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({
        id: '15',
        organizationIntegrationStatus: 'disabled',
      }),
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    expect(
      await screen.findByText(
        'The saved integration is no longer active. Choose a destination again.'
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
  });

  it('clears the stale channel warning once a refetch resolves the channel', async () => {
    const queryClient = makeTestQueryClient();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [{id: 'C999', name: 'general', display: '#general'}]},
    });

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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [{id: 'C123', name: 'alerts', display: '#alerts'}]},
    });
    await queryClient.invalidateQueries();

    expect(await screen.findByText('Destination selected')).toBeInTheDocument();
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it('keeps an omitted channel while it cannot verify a complete list', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [{id: 'C999', name: 'general', display: '#general'}]},
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    expect(
      await screen.findByText(
        "We couldn't verify the saved channel. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
  });

  it('keeps the saved destination when the channel list comes back empty', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15'}),
    });
    // Every provider helper returns [] when the upstream API fails, so an empty
    // list is indistinguishable from an outage and must not discard the
    // selection. It stays non-submittable rather than being reset.
    const channelsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: []},
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    await waitFor(() => {
      expect(channelsRequest).toHaveBeenCalled();
    });

    expect(onMessagingSetupChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "We couldn't verify the saved channel. Choose a destination again."
      )
    ).not.toBeInTheDocument();
  });

  it('does not trust a cached destination while revalidating it', async () => {
    const queryClient = makeTestQueryClient();
    const integration = OrganizationIntegrationsFixture({id: '15'});
    const channel = {id: 'C123', name: 'alerts', display: '#alerts', type: 'text'};
    const integrationOptions = apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: {organizationIdOrSlug: 'org-slug', integrationId: '15'},
        staleTime: 0,
      }
    );
    const channelsOptions = apiOptions.as<{results: Array<typeof channel>}>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/channels/',
      {
        path: {organizationIdOrSlug: 'org-slug', integrationId: '15'},
        staleTime: 0,
      }
    );
    queryClient.setQueryData(integrationOptions.queryKey, {
      json: integration,
      headers: {},
    });
    queryClient.setQueryData(channelsOptions.queryKey, {
      json: {results: [channel]},
      headers: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [channel]},
    });
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

    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
    expect(onMessagingSetupChange).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "We couldn't find the saved integration. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
  });

  it('keeps the stale channel warning across unrelated context updates', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [{id: 'C999', name: 'general', display: '#general'}]},
    });

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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/',
      body: OrganizationIntegrationsFixture({id: '15'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [{id: 'C999', name: 'general', display: '#general'}]},
    });

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
});
