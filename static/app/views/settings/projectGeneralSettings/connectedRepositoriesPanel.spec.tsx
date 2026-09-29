import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConnectedRepositoriesPanel} from 'sentry/views/settings/projectGeneralSettings/connectedRepositoriesPanel';

describe('ConnectedRepositoriesPanel', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const repoUrl = `/projects/${organization.slug}/${project.slug}/repo/`;

  function renderPanel() {
    return render(<ConnectedRepositoriesPanel project={project} />, {organization});
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
});
