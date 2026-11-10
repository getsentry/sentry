import {DetailedProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {StatusCheckRules} from './statusCheckRules';

describe('StatusCheckRules', () => {
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

  it('renders enabled by default when the project has no preprod options', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({options: {}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<StatusCheckRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle status checks'})
    ).toBeChecked();
    expect(
      screen.getByText('No status check rules configured. Create one to get started.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Create Status Check Rule'})
    ).toBeInTheDocument();
  });

  it('reflects an enabled project from the explicit field', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({
      options: {},
      preprodSizeStatusChecksEnabled: true,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<StatusCheckRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle status checks'})
    ).toBeChecked();
  });

  it('reflects a disabled project from the option key when the explicit field is absent', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({
      options: {'sentry:preprod_size_status_checks_enabled': false},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(<StatusCheckRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Toggle status checks'})
    ).not.toBeChecked();
    expect(
      screen.getByText('Enable status checks above to configure rules.')
    ).toBeInTheDocument();
  });

  it('replaces the URL with the new rule expanded when a rule is created', async () => {
    mockRepositories();
    const project = DetailedProjectFixture({options: {}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: project,
    });

    const {router} = render(<StatusCheckRules />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {...initialRouterConfig.location, query: {other: 'kept'}},
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Create Status Check Rule'})
    );

    await waitFor(() =>
      expect(router.location.query).toEqual({
        other: 'kept',
        expanded: expect.any(String),
      })
    );
    expect(router.historyAction).toBe('REPLACE');
  });
});
