import {CommitFixture} from 'sentry-fixture/commit';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import type {RouterConfig} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {ReleaseProject} from 'sentry/types/release';
import {ReleaseContext} from 'sentry/views/releases/detail';

import Commits from './commits';

describe('Commits', () => {
  const release = ReleaseFixture();
  const project = ReleaseProjectFixture() as Required<ReleaseProject>;
  const organization = OrganizationFixture();
  const repos = [RepositoryFixture({integrationId: '1'})];
  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/releases/${release.version}/commits/`,
      query: {},
    },
    route: '/organizations/:orgId/releases/:release/commits/',
  };

  function renderComponent() {
    return render(
      <ReleaseContext
        value={{
          release,
          project,
          deploys: [],
          refetchData: () => {},
          hasHealthData: false,
          releaseBounds: {} as any,
          releaseMeta: {} as any,
        }}
      >
        <Commits />
      </ReleaseContext>,
      {
        organization,
        initialRouterConfig,
      }
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: repos,
    });
  });

  it('should render no repositories message', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
    renderComponent();
    expect(
      await screen.findByText('Releases are better with commit data!')
    ).toBeInTheDocument();
  });

  it('should render no commits', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [],
    });
    renderComponent();
    expect(await screen.findByText(/There are no commits/)).toBeInTheDocument();
  });

  it('should render list of commits', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [CommitFixture()],
    });
    renderComponent();
    expect(
      await screen.findByText('(improve) Add Links to Spike-Protection Email (#2408)')
    ).toBeInTheDocument();
    expect(screen.getByText('f7f395d')).toBeInTheDocument();
  });

  it('should render repo picker', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: [
        repos[0]!,
        RepositoryFixture({
          id: '5',
          name: 'getsentry/sentry-frontend',
          integrationId: '1',
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [CommitFixture()],
    });
    renderComponent();
    expect(await screen.findByRole('button')).toHaveTextContent('example/repo-name');
    expect(screen.queryByText('getsentry/sentry-frontend')).not.toBeInTheDocument();
    await selectEvent.openMenu(
      screen.getByRole('button', {name: 'Filter example/repo-name'})
    );
    expect(await screen.findByText('getsentry/sentry-frontend')).toBeInTheDocument();
  });

  it('should render the commits from the selected repo', async () => {
    const otherRepo = RepositoryFixture({
      id: '5',
      name: 'getsentry/sentry-frontend',
      integrationId: '1',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: [repos[0]!, otherRepo],
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [
        CommitFixture(),
        CommitFixture({
          repository: otherRepo,
        }),
      ],
    });
    render(
      <ReleaseContext
        value={{
          release,
          project,
          deploys: [],
          refetchData: () => {},
          hasHealthData: false,
          releaseBounds: {} as any,
          releaseMeta: {} as any,
        }}
      >
        <Commits />
      </ReleaseContext>,
      {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            query: {activeRepo: otherRepo.name},
            pathname: `/organizations/${organization.slug}/releases/${release.version}/commits/`,
          },
        },
      }
    );
    expect(await screen.findByRole('button')).toHaveTextContent(otherRepo.name);
    expect(screen.queryByText('example/repo-name')).not.toBeInTheDocument();
  });
});
