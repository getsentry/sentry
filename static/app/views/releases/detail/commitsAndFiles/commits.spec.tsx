import selectEvent from 'react-select-event';
import {CommitFixture} from 'sentry-fixture/commit';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import RepositoryStore from 'sentry/stores/repositoryStore';
import type {ReleaseProject} from 'sentry/types';
import {ReleaseContext} from 'sentry/views/releases/detail';

import Commits from './commits';

describe('Commits', () => {
  const release = ReleaseFixture();
  const project = ReleaseProjectFixture() as Required<ReleaseProject>;
  const {routerProps, routerContext, organization} = initializeOrg({
    router: {params: {release: release.version}},
  });
  const repos = [RepositoryFixture({integrationId: '1'})];

  function renderComponent() {
    return render(
      <ReleaseContext.Provider
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
        <Commits releaseRepos={[]} projectSlug={project.slug} {...routerProps} />
      </ReleaseContext.Provider>,
      {context: routerContext}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: repos,
    });
    RepositoryStore.init();
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
      url: `/organizations/org-slug/releases/${encodeURIComponent(
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
      url: `/organizations/org-slug/releases/${encodeURIComponent(
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
      url: `/organizations/org-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [CommitFixture()],
    });
    renderComponent();
    expect(await screen.findByRole('button')).toHaveTextContent('example/repo-name');
    expect(screen.queryByText('getsentry/sentry-frontend')).not.toBeInTheDocument();
    selectEvent.openMenu(screen.getByRole('button'));
    expect(screen.getByText('getsentry/sentry-frontend')).toBeInTheDocument();
  });

  it('should render the commits from the selected repo', async () => {
    const otherRepo = RepositoryFixture({
      id: '5',
      name: 'getsentry/sentry-frontend',
      integrationId: '1',
    });
    // Current repo is stored in query parameter activeRepo
    const {routerContext: newRouterContext, routerProps: newRouterProps} = initializeOrg({
      router: {
        params: {release: release.version},
        location: {query: {activeRepo: otherRepo.name}},
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: [repos[0]!, otherRepo],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(
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
      <ReleaseContext.Provider
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
        <Commits releaseRepos={[]} projectSlug={project.slug} {...newRouterProps} />
      </ReleaseContext.Provider>,
      {context: newRouterContext}
    );
    expect(await screen.findByRole('button')).toHaveTextContent(otherRepo.name);
    expect(screen.queryByText('example/repo-name')).not.toBeInTheDocument();
  });
});
