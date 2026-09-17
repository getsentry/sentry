import {useVirtualizer} from '@tanstack/react-virtual';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Integration, Repository} from 'sentry/types/integrations';
import * as analytics from 'sentry/utils/analytics';

import {ScmRepoSelector} from './scmRepoSelector';

const mockScrollToIndex = jest.fn();

// Mock the virtualizer so all items render in JSDOM (no layout engine).
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count, paddingStart = 0, paddingEnd = 0}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: paddingStart + i * 36,
        size: 36,
      })),
    getTotalSize: () => paddingStart + count * 36 + paddingEnd,
    measureElement: jest.fn(),
    scrollToIndex: mockScrollToIndex,
  })),
}));

interface DefaultPropsOverrides {
  integration: Integration;
  analyticsFlow?: 'onboarding' | 'project-creation';
  onClearDerivedState?: jest.Mock;
  onRepositoryChange?: jest.Mock;
  selectedRepository?: Repository;
}

function defaultProps({
  integration,
  analyticsFlow = 'onboarding',
  onClearDerivedState = jest.fn(),
  onRepositoryChange = jest.fn(),
  selectedRepository,
}: DefaultPropsOverrides) {
  return {
    analyticsFlow,
    integration,
    selectedRepository,
    onRepositoryChange,
    onClearDerivedState,
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
    mockScrollToIndex.mockClear();
  });

  it('renders search placeholder', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    render(<ScmRepoSelector {...defaultProps({integration: mockIntegration})} />, {
      organization,
    });

    expect(screen.getByText('Search repositories')).toBeInTheDocument();
  });

  it('shows empty state message when no repos are available', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    render(<ScmRepoSelector {...defaultProps({integration: mockIntegration})} />, {
      organization,
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

    render(<ScmRepoSelector {...defaultProps({integration: mockIntegration})} />, {
      organization,
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

    render(<ScmRepoSelector {...defaultProps({integration: mockIntegration})} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('textbox'));

    expect(
      await screen.findByRole('menuitemradio', {name: 'sentry'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'relay'})).toBeInTheDocument();
  });

  it('ranks exact name and token matches without searching the organization slug', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [
          {
            externalId: '1',
            identifier: 'getsentry/sentry-cli',
            name: 'sentry-cli',
            isInstalled: false,
          },
          {
            externalId: '2',
            identifier: 'getsentry/tool-cli',
            name: 'tool-cli',
            isInstalled: false,
          },
          {
            externalId: '3',
            identifier: 'getsentry/clickhouse-sdk',
            name: 'clickhouse-sdk',
            isInstalled: false,
          },
          {
            externalId: '4',
            identifier: 'cli-org/relay',
            name: 'relay',
            isInstalled: false,
          },
          {
            externalId: '5',
            identifier: 'getsentry/cli',
            name: 'cli',
            isInstalled: false,
          },
          {
            externalId: '6',
            identifier: 'getsentry/clickhouse-backup',
            name: 'clickhouse-backup',
            isInstalled: false,
          },
          {
            externalId: '7',
            identifier: 'getsentry/cli-tools',
            name: 'cli-tools',
            isInstalled: false,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({
          externalId: '5',
          name: 'getsentry/cli',
          externalSlug: 'getsentry/cli',
        }),
      ],
    });

    const onRepositoryChange = jest.fn();
    render(
      <ScmRepoSelector
        {...defaultProps({integration: mockIntegration, onRepositoryChange})}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('cli');

    expect(
      screen.getAllByRole('menuitemradio').map(option => option.textContent)
    ).toEqual([
      'cli',
      'cli-tools',
      'sentry-cli',
      'tool-cli',
      'clickhouse-sdk',
      'clickhouse-backup',
    ]);
    expect(screen.queryByRole('menuitemradio', {name: 'relay'})).not.toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(onRepositoryChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({name: 'cli'})
    );
  });

  it('scrolls keyboard focus into view without scrolling on pointer focus', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: Array.from({length: 20}, (_, index) => ({
          externalId: String(index),
          identifier: `getsentry/repo-${index}`,
          name: `repo-${index}`,
          isInstalled: false,
        })),
      },
    });

    render(<ScmRepoSelector {...defaultProps({integration: mockIntegration})} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('textbox'));

    expect(useVirtualizer).toHaveBeenCalledWith(
      expect.objectContaining({
        paddingStart: 4,
        paddingEnd: 4,
        scrollPaddingStart: 4,
        scrollPaddingEnd: 4,
      })
    );
    const firstOption = screen.getByRole('menuitemradio', {name: 'repo-0'});
    expect(firstOption.parentElement).toHaveStyle({transform: 'translateY(4px)'});
    expect(firstOption.parentElement?.parentElement?.parentElement).toHaveStyle({
      maxHeight: '296px',
    });
    expect(screen.getByRole('menuitemradio', {name: 'repo-7'}).parentElement).toHaveStyle(
      {
        transform: 'translateY(256px)',
      }
    );

    mockScrollToIndex.mockClear();
    await userEvent.keyboard(
      '{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}'
    );

    expect(mockScrollToIndex).toHaveBeenLastCalledWith(10, {align: 'auto'});

    mockScrollToIndex.mockClear();
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'repo-15'}));
    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  it('shows selected repo value when one is provided', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {repos: []},
    });

    const selectedRepo = RepositoryFixture({
      name: 'getsentry/old-repo',
      externalSlug: 'getsentry/old-repo',
    });

    render(
      <ScmRepoSelector
        {...defaultProps({
          integration: mockIntegration,
          selectedRepository: selectedRepo,
        })}
      />,
      {organization}
    );

    expect(screen.getByText('getsentry/old-repo')).toBeInTheDocument();
  });

  it('selects a repo and triggers repo lookup', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [
          {
            externalId: '1',
            identifier: 'getsentry/sentry',
            name: 'sentry',
            isInstalled: false,
          },
        ],
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

    const onRepositoryChange = jest.fn();
    render(
      <ScmRepoSelector
        {...defaultProps({integration: mockIntegration, onRepositoryChange})}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'sentry'}));

    await waitFor(() => expect(reposLookup).toHaveBeenCalled());
    expect(onRepositoryChange).toHaveBeenCalled();
  });

  it('fires project_creation.connect_repo_selected when analyticsFlow=project-creation', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [
          {
            externalId: '1',
            identifier: 'getsentry/sentry',
            name: 'sentry',
            isInstalled: false,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({name: 'getsentry/sentry', externalSlug: 'getsentry/sentry'}),
      ],
    });

    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(
      <ScmRepoSelector
        {...defaultProps({
          integration: mockIntegration,
          analyticsFlow: 'project-creation',
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'sentry'}));

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.connect_repo_selected',
      expect.objectContaining({
        provider: mockIntegration.provider.key,
        repo: 'sentry',
        variant: 'scm',
      })
    );
    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'onboarding.scm_connect_repo_selected',
      expect.anything()
    );
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

    const onRepositoryChange = jest.fn();
    render(
      <ScmRepoSelector
        {...defaultProps({
          integration: mockIntegration,
          selectedRepository: selectedRepo,
          onRepositoryChange,
        })}
      />,
      {organization}
    );

    expect(screen.getByText('getsentry/old-repo')).toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('icon-close'));

    await waitFor(() => expect(onRepositoryChange).toHaveBeenCalledWith(undefined));
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

    render(
      <ScmRepoSelector
        {...defaultProps({
          integration: mockIntegration,
          selectedRepository: selectedRepo,
        })}
      />,
      {organization}
    );

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

  it('fires onClearDerivedState exactly once per user-driven repo change', async () => {
    // The underlying selection hook calls onRepositoryChange multiple times for
    // a single user click (optimistic + resolved/created paths). The derived-
    // state callback must only fire once per click so it isn't redundantly
    // wiping flow state on every internal update.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${mockIntegration.id}/repos/`,
      body: {
        repos: [
          {
            externalId: '1',
            identifier: 'getsentry/sentry',
            name: 'sentry',
            isInstalled: false,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [
        RepositoryFixture({name: 'getsentry/sentry', externalSlug: 'getsentry/sentry'}),
      ],
    });

    const onClearDerivedState = jest.fn();
    const onRepositoryChange = jest.fn();
    render(
      <ScmRepoSelector
        {...defaultProps({
          integration: mockIntegration,
          onClearDerivedState,
          onRepositoryChange,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'sentry'}));

    await waitFor(() => expect(onRepositoryChange).toHaveBeenCalled());
    expect(onClearDerivedState).toHaveBeenCalledTimes(1);
  });
});
