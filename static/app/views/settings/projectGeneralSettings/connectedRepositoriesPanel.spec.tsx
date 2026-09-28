import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {ConnectedRepositoriesPanel} from 'sentry/views/settings/projectGeneralSettings/connectedRepositoriesPanel';

// Mock the virtualizer so all menu items render in JSDOM (no layout engine).
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
    measure: jest.fn(),
    measureElement: jest.fn(),
    scrollToIndex: jest.fn(),
  })),
}));

describe('ConnectedRepositoriesPanel', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const repoUrl = `/projects/${organization.slug}/${project.slug}/repo/`;

  function renderPanel() {
    return render(
      <div>
        <GlobalModal />
        <ConnectedRepositoriesPanel project={project} />
      </div>,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows a loading spinner while the request is in flight', () => {
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [],
    });

    renderPanel();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows empty state when no repositories are connected', async () => {
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [],
    });

    renderPanel();

    expect(await screen.findByText('No repositories connected')).toBeInTheDocument();
  });

  it('renders a row with the repo name and mapping count', async () => {
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [
        {
          id: '1',
          projectId: project.id,
          repositoryId: '10',
          repoName: 'getsentry/sentry',
          source: 'manual',
          providerKey: 'github',
          mappingCount: 1,
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('1 mapping')).toBeInTheDocument();
  });

  it('renders one row per ProjectRepository even when count is from the API', async () => {
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [
        {
          id: '1',
          projectId: project.id,
          repositoryId: '10',
          repoName: 'getsentry/sentry',
          source: 'manual',
          providerKey: 'github',
          mappingCount: 2,
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('2 mappings')).toBeInTheDocument();
    expect(screen.getAllByText('getsentry/sentry')).toHaveLength(1);
  });

  it('renders a row for a repo with zero mappings', async () => {
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [
        {
          id: '1',
          projectId: project.id,
          repositoryId: '10',
          repoName: 'getsentry/relay',
          source: 'scm_onboarding',
          providerKey: 'github',
          mappingCount: 0,
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('getsentry/relay')).toBeInTheDocument();
    expect(screen.getByText('0 mappings')).toBeInTheDocument();
  });

  it('waits for every page before rendering rows', async () => {
    const repoA = {
      id: '1',
      projectId: project.id,
      repositoryId: '10',
      repoName: 'getsentry/sentry',
      source: 'manual',
      providerKey: 'github',
      mappingCount: 1,
    };
    const repoB = {
      id: '2',
      projectId: project.id,
      repositoryId: '11',
      repoName: 'getsentry/relay',
      source: 'manual',
      providerKey: 'github',
      mappingCount: 0,
    };

    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [repoA],
      headers: {
        Link: `<${repoUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });

    const nextPage = Promise.withResolvers<void>();
    const nextPageRequest = MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [repoB],
      asyncDelay: nextPage.promise,
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
    });

    renderPanel();

    await waitFor(() => expect(nextPageRequest).toHaveBeenCalled());
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();

    act(() => nextPage.resolve());

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('getsentry/relay')).toBeInTheDocument();
  });

  it('opens overflow menu with disabled Edit and Disconnect items', async () => {
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [
        {
          id: '1',
          projectId: project.id,
          repositoryId: '10',
          repoName: 'getsentry/sentry',
          source: 'manual',
          providerKey: 'github',
          mappingCount: 1,
        },
      ],
    });

    renderPanel();

    await userEvent.click(await screen.findByRole('button', {name: 'More Actions'}));

    expect(screen.getByRole('menuitemradio', {name: 'Edit'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('menuitemradio', {name: 'Disconnect'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('opens the connect repository modal when the button is clicked', async () => {
    const integration = GitHubIntegrationFixture();
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      method: 'GET',
      body: [integration],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      method: 'GET',
      body: {repos: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'GET',
      body: [],
    });

    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Connect repository'})
    );

    expect(
      await screen.findByText(`Connect a repository to ${project.slug}`)
    ).toBeInTheDocument();
  });

  it('increments the mapping count after a successful save', async () => {
    const integration = GitHubIntegrationFixture();
    let connectedRepos: Array<Record<string, unknown>> = [];

    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'GET',
      body: () => connectedRepos,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      method: 'GET',
      body: [integration],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      method: 'GET',
      body: {
        repos: [
          {
            name: 'getsentry/sentry',
            identifier: 'getsentry/sentry',
            externalId: '1',
            isInstalled: true,
            defaultBranch: 'main',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'GET',
      body: [
        RepositoryFixture({
          id: '10',
          name: 'getsentry/sentry',
          externalId: '1',
          integrationId: integration.id,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: repoUrl,
      method: 'POST',
      body: () => {
        connectedRepos = [
          {
            id: '1',
            projectId: project.id,
            repositoryId: '10',
            repoName: 'getsentry/sentry',
            source: 'scm_onboarding',
            providerKey: 'github',
            mappingCount: 1,
          },
        ];
        return {
          id: '1',
          projectId: project.id,
          repositoryId: '10',
          source: 'scm_onboarding',
          created: true,
        };
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      method: 'POST',
      body: {},
    });

    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Connect repository'})
    );
    await userEvent.click(await screen.findByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('1 mapping')).toBeInTheDocument();
  });
});
