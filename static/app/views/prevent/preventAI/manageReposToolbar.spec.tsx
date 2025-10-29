import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {RepositoryStatus} from 'sentry/types/integrations';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';

describe('ManageReposToolbar', () => {
  const mockIntegratedOrgs: OrganizationIntegration[] = [
    {
      id: '1',
      name: 'org-1',
      externalId: 'ext-1',
      provider: {
        key: 'github',
        name: 'GitHub',
        slug: 'github',
        aspects: {},
        canAdd: true,
        canDisable: false,
        features: [],
      },
      organizationId: '1',
      status: 'active',
      domainName: null,
      accountType: null,
      configData: null,
      configOrganization: [],
      gracePeriodEnd: null,
      icon: null,
      organizationIntegrationStatus: 'active',
    },
    {
      id: '2',
      name: 'org-2',
      externalId: 'ext-2',
      provider: {
        key: 'github',
        name: 'GitHub',
        slug: 'github',
        aspects: {},
        canAdd: true,
        canDisable: false,
        features: [],
      },
      organizationId: '1',
      status: 'active',
      domainName: null,
      accountType: null,
      configData: null,
      configOrganization: [],
      gracePeriodEnd: null,
      icon: null,
      organizationIntegrationStatus: 'active',
    },
  ];

  const mockRepositories: Repository[] = [
    {
      id: '1',
      name: 'org-1/repo-1',
      url: 'https://github.com/org-1/repo-1',
      provider: {
        id: 'integrations:github',
        name: 'GitHub',
      },
      status: RepositoryStatus.ACTIVE,
      externalSlug: 'org-1/repo-1',
      integrationId: '1',
      externalId: 'ext-1',
      dateCreated: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'org-1/repo-2',
      url: 'https://github.com/org-1/repo-2',
      provider: {
        id: 'integrations:github',
        name: 'GitHub',
      },
      status: RepositoryStatus.ACTIVE,
      externalSlug: 'org-1/repo-2',
      integrationId: '1',
      externalId: 'ext-2',
      dateCreated: '2024-01-01T00:00:00Z',
    },
  ];

  const mockOrg2Repositories: Repository[] = [
    {
      id: '3',
      name: 'org-2/repo-3',
      url: 'https://github.com/org-2/repo-3',
      provider: {
        id: 'integrations:github',
        name: 'GitHub',
      },
      status: RepositoryStatus.ACTIVE,
      externalSlug: 'org-2/repo-3',
      integrationId: '2',
      externalId: 'ext-3',
      dateCreated: '2024-01-01T00:00:00Z',
    },
  ];

  const defaultProps = {
    integratedOrgs: mockIntegratedOrgs,
    selectedOrg: '1',
    selectedRepo: mockRepositories[0] ?? null,
    onOrgChange: jest.fn(),
    onRepoChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders organization and repository selectors', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '1',
          status: 'active',
        }),
      ],
    });

    render(<ManageReposToolbar {...defaultProps} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    const orgSelect = await screen.findByRole('button', {name: /org-1/i});
    const repoSelect = await screen.findByRole('button', {name: /repo-1/i});
    expect(orgSelect).toBeInTheDocument();
    expect(repoSelect).toBeInTheDocument();
  });

  it('shows the correct selected org and repo', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '1',
          status: 'active',
        }),
      ],
    });

    render(<ManageReposToolbar {...defaultProps} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    const orgTrigger = await screen.findByRole('button', {name: /org-1/i});
    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    expect(orgTrigger).toHaveTextContent('org-1');
    expect(repoTrigger).toHaveTextContent('repo-1');
  });

  it('calls onOrgChange when organization is changed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '1',
          status: 'active',
        }),
      ],
    });

    render(<ManageReposToolbar {...defaultProps} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    const orgTrigger = await screen.findByRole('button', {name: /org-1/i});
    await userEvent.click(orgTrigger);

    const orgOption = await screen.findByText('org-2');
    await userEvent.click(orgOption);

    expect(defaultProps.onOrgChange).toHaveBeenCalledWith('2');
  });

  it('calls onRepoChange when repository is changed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '1',
          status: 'active',
        }),
      ],
    });

    render(<ManageReposToolbar {...defaultProps} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    await userEvent.click(repoTrigger);

    await waitFor(() => {
      expect(screen.getByText('repo-2')).toBeInTheDocument();
    });

    const repoOption = screen.getByText('repo-2');
    await userEvent.click(repoOption);

    expect(defaultProps.onRepoChange).toHaveBeenCalledWith(mockRepositories[1]);
  });

  it('shows only repos for the selected org', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockOrg2Repositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '2',
          status: 'active',
        }),
      ],
    });

    render(
      <ManageReposToolbar
        {...defaultProps}
        selectedOrg="2"
        selectedRepo={mockOrg2Repositories[0] ?? null}
      />,
      {
        organization: OrganizationFixture({slug: 'org-slug'}),
      }
    );

    const repoTrigger = await screen.findByRole('button', {name: /repo-3/i});
    await userEvent.click(repoTrigger);

    // Find all repo options in the dropdown menu - only "Repo Three" should be present
    const repoOptions = await screen.findAllByText(/repo-/i);
    const repoOptionTexts = repoOptions.map(option => option.textContent);
    expect(repoOptionTexts).toContain('repo-3');
    expect(repoOptionTexts).not.toContain('repo-1');
    expect(repoOptionTexts).not.toContain('repo-2');
  });

  it('shows "All Repos" option at the top of repository dropdown', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '1',
          status: 'active',
        }),
      ],
    });

    render(<ManageReposToolbar {...defaultProps} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    await userEvent.click(repoTrigger);

    expect(await screen.findByText('All Repos')).toBeInTheDocument();
  });

  it('calls onRepoChange with null when "All Repos" is selected', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: '1',
          status: 'active',
        }),
      ],
    });

    render(<ManageReposToolbar {...defaultProps} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    const repoTrigger = await screen.findByRole('button', {name: /repo-1/i});
    await userEvent.click(repoTrigger);

    const allReposOption = await screen.findByText('All Repos');
    await userEvent.click(allReposOption);

    expect(defaultProps.onRepoChange).toHaveBeenCalledWith(null);
  });
});
