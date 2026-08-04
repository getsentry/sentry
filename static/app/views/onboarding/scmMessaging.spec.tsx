import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

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
  });

  it('revalidates a restored destination before showing it as selected', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      body: [OrganizationIntegrationsFixture({id: '15'})],
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
      url: '/organizations/org-slug/integrations/',
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      body: [],
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

  it('clears a missing channel with an explanation', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      body: [OrganizationIntegrationsFixture({id: '15'})],
    });
    // A populated list that does not contain the saved channel is genuine
    // staleness: the channel was deleted or renamed away.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: [{id: 'C999', name: 'general', display: '#general'}]},
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    expect(
      await screen.findByText(
        "We couldn't find the saved channel. Choose a destination again."
      )
    ).toBeInTheDocument();
    expect(onMessagingSetupChange).toHaveBeenCalledWith({mode: 'unconfigured'});
    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
  });

  it('keeps the saved destination when the channel list comes back empty', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      body: [OrganizationIntegrationsFixture({id: '15'})],
    });
    // Every provider helper returns [] when the upstream API fails, so an empty
    // list is indistinguishable from an outage and must not discard the
    // selection. It stays non-submittable rather than being reset.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/15/channels/',
      body: {results: []},
    });
    const onMessagingSetupChange = jest.fn();

    renderMessaging(onMessagingSetupChange);

    await waitFor(() => {
      expect(screen.queryByText('Checking saved destination')).not.toBeInTheDocument();
    });

    expect(onMessagingSetupChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Destination selected')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "We couldn't find the saved channel. Choose a destination again."
      )
    ).not.toBeInTheDocument();
  });

  it('does not trust a cached destination while revalidating it', async () => {
    const queryClient = makeTestQueryClient();
    const integration = OrganizationIntegrationsFixture({id: '15'});
    const channel = {id: 'C123', name: 'alerts', display: '#alerts', type: 'text'};
    const integrationsOptions = apiOptions.as<OrganizationIntegration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: 'org-slug'},
        query: {integrationType: 'messaging'},
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
    queryClient.setQueryData(integrationsOptions.queryKey, {
      json: [integration],
      headers: {},
    });
    queryClient.setQueryData(channelsOptions.queryKey, {
      json: {results: [channel]},
      headers: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      body: [],
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
});
