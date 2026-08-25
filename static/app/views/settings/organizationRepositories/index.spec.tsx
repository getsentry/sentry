import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {GitLabIntegrationProviderFixture} from 'sentry-fixture/gitlabIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import OrganizationRepositories from 'sentry/views/settings/organizationRepositories';

const GITHUB_PROVIDER = GitHubIntegrationProviderFixture();
const GITHUB_INTEGRATION = OrganizationIntegrationsFixture({
  id: '1',
  name: 'my-org',
  provider: {
    key: 'github',
    slug: 'github',
    name: 'GitHub',
    canAdd: true,
    canDisable: false,
    features: [],
    aspects: {},
  },
});

function setupDefaultMocks() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/config/integrations/',
    body: {providers: [GITHUB_PROVIDER]},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/integrations/',
    body: [GITHUB_INTEGRATION],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/`,
    body: GITHUB_INTEGRATION,
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/repos/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/code-mappings/',
    body: [],
  });
}

describe('OrganizationRepositories', () => {
  beforeEach(() => {
    mockElementSize({width: 600, height: 400});
  });

  it('shows a loading indicator while queries are pending', async () => {
    setupDefaultMocks();
    render(<OrganizationRepositories />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    await screen.findByRole('searchbox');
  });

  it('shows empty state with a Connect button per provider when no integrations are installed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: {providers: [GITHUB_PROVIDER, GitLabIntegrationProviderFixture()]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/code-mappings/',
      body: [],
    });

    render(<OrganizationRepositories />);

    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();

    const connectButtons = screen.getAllByRole('button', {name: 'Add integration'});
    expect(connectButtons).toHaveLength(2);
  });

  it('shows the connect provider button in the header when integrations are installed', async () => {
    setupDefaultMocks();
    render(<OrganizationRepositories />);

    expect(
      await screen.findByRole('button', {name: 'Connect new provider'})
    ).toBeInTheDocument();
  });

  it('renders a table for each provider that has an installation', async () => {
    setupDefaultMocks();
    render(<OrganizationRepositories />);

    expect(await screen.findByText('my-org')).toBeInTheDocument();
  });

  it('shows repos loading state in the table while the repos query is pending', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: {providers: [GITHUB_PROVIDER]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [GITHUB_INTEGRATION],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/`,
      body: GITHUB_INTEGRATION,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/code-mappings/',
      body: [],
    });
    // Use a large delay to simulate a slow/pending repos query. The
    // providers and integrations responses arrive first, so the table
    // renders, but reposLoading stays true until repos resolves.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: [],
      asyncDelay: 10000,
    });

    render(<OrganizationRepositories />);

    expect(await screen.findByText('Loading repositories')).toBeInTheDocument();
  });

  it('clicking uninstall prompts for confirmation then refetches integrations', async () => {
    setupDefaultMocks();

    const deleteRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/`,
      method: 'DELETE',
      body: {},
    });

    render(<OrganizationRepositories />);
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Uninstall'}));

    // The confirmation modal must appear before any DELETE is fired.
    expect(deleteRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "I'm sure, uninstall"})).toBeInTheDocument();

    // Override the integrations mock before the refetch happens.
    const refetchRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [],
    });

    await userEvent.click(screen.getByRole('button', {name: "I'm sure, uninstall"}));

    await waitFor(() => expect(deleteRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refetchRequest).toHaveBeenCalledTimes(1));
  });

  it('shows the uninstall button as disabled when the user lacks org:integrations access', async () => {
    setupDefaultMocks();

    render(<OrganizationRepositories />, {
      organization: OrganizationFixture({access: []}),
    });

    expect(await screen.findByRole('button', {name: 'Uninstall'})).toBeDisabled();
  });

  it('shows the settings button as disabled while the integration config is loading', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: {providers: [GITHUB_PROVIDER]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [GITHUB_INTEGRATION],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/`,
      body: GITHUB_INTEGRATION,
      asyncDelay: 10_000,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/code-mappings/',
      body: [],
    });

    render(<OrganizationRepositories />);

    await screen.findByText('my-org');
    expect(screen.getByRole('button', {name: 'Integration settings'})).toBeDisabled();
  });

  it('enables the settings button once the integration config has loaded', async () => {
    setupDefaultMocks();

    render(<OrganizationRepositories />);

    expect(
      await screen.findByRole('button', {name: 'Integration settings'})
    ).toBeEnabled();
  });

  describe('sync', () => {
    it('clicking Sync now fires a POST to the repo-sync endpoint', async () => {
      setupDefaultMocks();

      const syncRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/repo-sync/`,
        method: 'POST',
        body: {},
      });

      render(<OrganizationRepositories />);

      await userEvent.hover(await screen.findByText('0 repositories'));
      await userEvent.click(await screen.findByRole('button', {name: 'Sync now'}));

      await waitFor(() => expect(syncRequest).toHaveBeenCalledTimes(1));
    });

    it('does not show Sync now when the user lacks org:integrations access', async () => {
      setupDefaultMocks();

      render(<OrganizationRepositories />, {
        organization: OrganizationFixture({access: []}),
      });

      await userEvent.hover(await screen.findByText('0 repositories'));
      await screen.findByText('Repositories not yet synced.');
      expect(screen.queryByRole('button', {name: 'Sync now'})).not.toBeInTheDocument();
    });

    it('shows re-syncing tooltip state while sync is in progress', async () => {
      setupDefaultMocks();

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/repo-sync/`,
        method: 'POST',
        body: {},
      });

      render(<OrganizationRepositories />);

      await userEvent.hover(await screen.findByText('0 repositories'));
      await userEvent.click(await screen.findByRole('button', {name: 'Sync now'}));

      await userEvent.hover(screen.getByText('0 repositories'));
      expect(
        await screen.findByText('Re-syncing in the background…')
      ).toBeInTheDocument();
    });
  });

  describe('connect', () => {
    const NEW_INTEGRATION = OrganizationIntegrationsFixture({
      id: '2',
      name: 'my-new-org',
      provider: {
        key: 'github',
        slug: 'github',
        name: 'GitHub',
        canAdd: true,
        canDisable: false,
        features: [],
        aspects: {},
      },
    });

    async function startConnectFlow() {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      await userEvent.click(screen.getByRole('button', {name: 'Connect new provider'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'GitHub'}));

      return openPipelineModalSpy.mock.calls[0]![0].onComplete!;
    }

    it('auto-syncs a newly connected integration so repos appear without a refresh', async () => {
      setupDefaultMocks();

      render(<OrganizationRepositories />);

      await screen.findByText('my-org');
      const onComplete = await startConnectFlow();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/',
        body: [GITHUB_INTEGRATION, NEW_INTEGRATION],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${NEW_INTEGRATION.id}/`,
        body: NEW_INTEGRATION,
      });
      const syncRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${NEW_INTEGRATION.id}/repo-sync/`,
        method: 'POST',
        body: {},
      });

      act(() => onComplete(NEW_INTEGRATION as IntegrationWithConfig));

      await waitFor(() => expect(syncRequest).toHaveBeenCalledTimes(1));
    });

    it('does not auto-sync integrations that were already installed on load', async () => {
      const syncRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/repo-sync/`,
        method: 'POST',
        body: {},
      });
      setupDefaultMocks();

      render(<OrganizationRepositories />);

      // Once the settings button enables, the integration is fully loaded — a
      // pending auto-sync would have fired by now.
      expect(
        await screen.findByRole('button', {name: 'Integration settings'})
      ).toBeEnabled();
      expect(syncRequest).not.toHaveBeenCalled();
    });

    it('does not re-sync a connected integration when its row remounts', async () => {
      setupDefaultMocks();

      render(<OrganizationRepositories />);
      renderGlobalModal();

      await screen.findByText('my-org');
      const onComplete = await startConnectFlow();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/',
        body: [GITHUB_INTEGRATION, NEW_INTEGRATION],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${NEW_INTEGRATION.id}/`,
        body: NEW_INTEGRATION,
      });
      const syncRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${NEW_INTEGRATION.id}/repo-sync/`,
        method: 'POST',
        body: {},
      });

      act(() => onComplete(NEW_INTEGRATION as IntegrationWithConfig));
      await waitFor(() => expect(syncRequest).toHaveBeenCalledTimes(1));
      await screen.findByText('my-new-org');

      // Uninstall the original integration; the provider drops back to a single
      // install, remounting the connected row.
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/${GITHUB_INTEGRATION.id}/`,
        method: 'DELETE',
        body: {},
      });
      await userEvent.click(screen.getAllByRole('button', {name: 'Uninstall'})[0]!);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/',
        body: [NEW_INTEGRATION],
      });
      await userEvent.click(screen.getByRole('button', {name: "I'm sure, uninstall"}));

      await waitFor(() => expect(screen.queryByText('my-org')).not.toBeInTheDocument());

      expect(syncRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('opens a settings drawer with backend fields and POSTs changes to the integration endpoint', async () => {
    const integration = OrganizationIntegrationsFixture({
      id: '1',
      name: 'my-org',
      provider: {
        key: 'github',
        slug: 'github',
        name: 'GitHub',
        canAdd: true,
        canDisable: false,
        features: [],
        aspects: {},
      },
      configOrganization: [{type: 'boolean', name: 'sync_enabled', label: 'Enable Sync'}],
      configData: {sync_enabled: false},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: {providers: [GITHUB_PROVIDER]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [integration],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/${integration.id}/`,
      body: integration,
    });
    MockApiClient.addMockResponse({url: '/organizations/org-slug/repos/', body: []});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/code-mappings/',
      body: [],
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/${integration.id}/`,
      method: 'POST',
      body: integration,
      match: [MockApiClient.matchData({sync_enabled: true})],
    });

    render(<OrganizationRepositories />);

    await userEvent.click(
      await screen.findByRole('button', {name: 'Integration settings'})
    );

    expect(await screen.findByText('my-org Settings')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Enable Sync'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Enable Sync'}));
    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(1));
  });
});
