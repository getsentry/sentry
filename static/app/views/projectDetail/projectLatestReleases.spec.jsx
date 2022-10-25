import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectLatestReleases from 'sentry/views/projectDetail/projectLatestReleases';

describe('ProjectDetail > ProjectLatestReleases', function () {
  let endpointMock, endpointOlderReleasesMock;
  const {organization, project, router} = initializeOrg();

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [
        TestStubs.Release({version: '1.0.0'}),
        TestStubs.Release({version: '1.0.1'}),
      ],
    });
    endpointOlderReleasesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [TestStubs.Release({version: '1.0.0'})],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders a list', function () {
    render(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(1);
    expect(endpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 5},
      })
    );
    expect(endpointOlderReleasesMock).toHaveBeenCalledTimes(0);

    expect(screen.getByText('Latest Releases')).toBeInTheDocument();

    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1.0.1')).toBeInTheDocument();
    expect(screen.getAllByText('Mar 23, 2020 1:02 AM')).toHaveLength(2);
  });

  it('shows the empty state', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [],
    });

    render(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(await screen.findByText('No releases found')).toBeInTheDocument();
  });

  it('shows configure releases buttons', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });

    render(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(await screen.findByRole('button', {name: 'Start Setup'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/releases/'
    );

    userEvent.click(screen.getByRole('button', {name: 'Get Tour'}));

    renderGlobalModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls API with the right params', function () {
    render(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(1);
    expect(endpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 5, statsPeriod: '7d', environment: 'staging'},
      })
    );
  });

  it('does not call API if project is not stabilized yet', function () {
    render(
      <ProjectLatestReleases
        organization={organization}
        projectSlug={project.slug}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
        projectId={project.slug}
        isProjectStabilized={false}
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(0);
  });
});
