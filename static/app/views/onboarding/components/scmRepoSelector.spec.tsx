import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';

import {ScmRepoSelector} from './scmRepoSelector';

// Mock the virtualizer so all items render in JSDOM (no layout engine).
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: i * 36,
        size: 36,
      })),
    getTotalSize: () => count * 36,
    measureElement: jest.fn(),
  })),
}));

function makeOnboardingWrapper(initialState?: OnboardingSessionState) {
  return function OnboardingWrapper({children}: {children?: React.ReactNode}) {
    return (
      <OnboardingContextProvider initialValue={initialState}>
        {children}
      </OnboardingContextProvider>
    );
  };
}

describe('ScmRepoSelector', () => {
  const organization = OrganizationFixture();

  const mockIntegration = OrganizationIntegrationsFixture({
    id: '1',
    name: 'getsentry',
    domainName: 'github.com/getsentry',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: ['commits'],
      aspects: {},
    },
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
  });

  it('renders search placeholder', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    expect(screen.getByText('Search repositories')).toBeInTheDocument();
  });

  it('shows empty state message when no repos are available', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.click(screen.getByRole('textbox'));

    expect(
      await screen.findByText(
        'No repositories found. Check your installation permissions to ensure your integration has access.'
      )
    ).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.click(screen.getByRole('textbox'));

    expect(
      await screen.findByText('Failed to load repositories. Please try again.')
    ).toBeInTheDocument();
  });

  it('displays repos fetched on mount', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [
          {identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false},
          {identifier: 'getsentry/relay', name: 'relay', isInstalled: false},
        ],
      },
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.click(screen.getByRole('textbox'));

    expect(
      await screen.findByRole('menuitemradio', {name: 'sentry'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'relay'})).toBeInTheDocument();
  });

  it('shows selected repo value when one is in context', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    const selectedRepo = RepositoryFixture({
      name: 'getsentry/old-repo',
      externalSlug: 'getsentry/old-repo',
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper({selectedRepository: selectedRepo}),
    });

    expect(screen.getByText('getsentry/old-repo')).toBeInTheDocument();
  });

  it('selects a repo and triggers repo lookup', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [{identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false}],
      },
    });

    const reposLookup = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({
          name: 'getsentry/sentry',
          externalSlug: 'getsentry/sentry',
        }),
      ],
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'sentry'}));

    await waitFor(() => expect(reposLookup).toHaveBeenCalled());
  });

  it('clears the selected repo', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    const selectedRepo = RepositoryFixture({
      name: 'getsentry/old-repo',
      externalSlug: 'getsentry/old-repo',
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper({selectedRepository: selectedRepo}),
    });

    expect(screen.getByText('getsentry/old-repo')).toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('icon-close'));

    await waitFor(() => {
      expect(screen.queryByText('getsentry/old-repo')).not.toBeInTheDocument();
    });
  });

  it('does not duplicate selected repo when it appears in results', async () => {
    const selectedRepo = RepositoryFixture({
      name: 'getsentry/sentry',
      externalSlug: 'getsentry/sentry',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [
          {identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false},
          {identifier: 'getsentry/relay', name: 'relay', isInstalled: false},
        ],
      },
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper({selectedRepository: selectedRepo}),
    });

    await userEvent.click(screen.getByRole('textbox'));

    expect(await screen.findByRole('menuitemradio', {name: 'relay'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'sentry'})).toBeInTheDocument();

    // If the options-prepend logic fires incorrectly, it adds an extra option
    // with label 'getsentry/sentry' (selectedRepository.name) alongside the
    // result option with label 'sentry' (repo.name).
    expect(
      screen.queryByRole('menuitemradio', {name: 'getsentry/sentry'})
    ).not.toBeInTheDocument();
  });
});
