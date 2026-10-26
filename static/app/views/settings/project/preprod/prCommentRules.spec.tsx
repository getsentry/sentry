import {DetailedProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PrCommentRules} from 'sentry/views/settings/project/preprod/prCommentRules';

describe('PrCommentRules', () => {
  const {organization} = initializeOrg();
  const initialRouterConfig = {
    location: {
      pathname: `/settings/projects/test-project/preprod/`,
    },
    route: '/settings/projects/:projectId/preprod/',
  };

  function mockRepositories(repositories = [RepositoryFixture()]) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: repositories,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders disabled by default when the project has no preprod options', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({options: {}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle PR comments'})
    ).not.toBeChecked();
    expect(
      screen.getByText('Enable PR comments above to configure rules.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Create PR Comment Rule'})
    ).not.toBeInTheDocument();
  });

  it('reflects an enabled project from the explicit field', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({
      options: {},
      preprodSizePrCommentsEnabled: true,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle PR comments'})
    ).toBeChecked();
    expect(
      screen.getByText('No PR comment rules configured. Create one to get started.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Create PR Comment Rule'})
    ).toBeInTheDocument();
  });

  it('reflects an enabled project from the option key when the explicit field is absent', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({
      options: {'sentry:preprod_size_pr_comments_enabled': true},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle PR comments'})
    ).toBeChecked();
    expect(
      screen.getByRole('button', {name: 'Create PR Comment Rule'})
    ).toBeInTheDocument();
  });

  it('reflects a disabled project from the option key when the explicit field is absent', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({
      options: {'sentry:preprod_size_pr_comments_enabled': false},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle PR comments'})
    ).not.toBeChecked();
    expect(
      screen.getByText('Enable PR comments above to configure rules.')
    ).toBeInTheDocument();
  });

  it('enables PR comments when toggled on', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({options: {}});
    const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: project,
    });
    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {},
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Toggle PR comments'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSizePrCommentsEnabled: true},
        })
      )
    );
  });

  it('creates a rule when the create button is clicked', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({
      options: {},
      preprodSizePrCommentsEnabled: true,
    });
    const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: project,
    });
    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {},
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Create PR Comment Rule'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {
            preprodSizePrCommentsRules: [
              expect.objectContaining({
                metric: 'install_size',
                measurement: 'absolute',
                value: 0,
                artifactType: 'main_artifact',
              }),
            ],
          },
        })
      )
    );
  });

  it('shows the connect-a-repository empty state when there are no repositories', async () => {
    mockRepositories([]);
    const project = DetailedProjectFixture({
      options: {},
      preprodSizePrCommentsEnabled: true,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<PrCommentRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByText(
        'Connect at least one repository to get Size Analysis PR comments'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Toggle PR comments'})
    ).not.toBeInTheDocument();
  });
});
