import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {CommitFixture} from 'sentry-fixture/commit';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import type {RouterConfig} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import type {ReleaseProject} from 'sentry/types/release';
import {ReleaseContext} from 'sentry/views/explore/releases/detail';

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

  function renderComponent({
    query = {},
    onNuqsUrlUpdate,
  }: {
    onNuqsUrlUpdate?: OnUrlUpdateFunction;
    query?: Record<string, string>;
  } = {}) {
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
        onNuqsUrlUpdate,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            pathname: `/organizations/${organization.slug}/releases/${release.version}/commits/`,
            query,
          },
        },
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

  it('pushes the picked repo and clears the cursor when another repo is selected', async () => {
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
    const commitsMock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [CommitFixture()],
    });
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();
    const {router} = renderComponent({
      query: {cursor: '0:40:0', project: '1'},
      onNuqsUrlUpdate,
    });

    await selectEvent.select(
      await screen.findByRole('button', {name: 'Filter example/repo-name'}),
      'getsentry/sentry-frontend'
    );

    await waitFor(() =>
      expect(router.location.query).toEqual({
        activeRepo: 'getsentry/sentry-frontend',
        project: '1',
      })
    );
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'push'})})
    );
    expect(commitsMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          repo_name: 'getsentry/sentry-frontend',
          cursor: '0:40:0',
        }),
      })
    );
    expect(commitsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({repo_name: 'getsentry/sentry-frontend'}),
      })
    );
  });

  it('pushes the next cursor and requests the next page when Next is clicked', async () => {
    const commitsMock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [CommitFixture()],
      headers: {
        Link: '<http://127.0.0.1:8000/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/?cursor=0:40:0>; rel="next"; results="true"; cursor="0:40:0"',
      },
    });
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();
    const {router} = renderComponent({query: {project: '1'}, onNuqsUrlUpdate});

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    await waitFor(() =>
      expect(router.location.query).toEqual({cursor: '0:40:0', project: '1'})
    );
    const [{searchParams, options}] = onNuqsUrlUpdate.mock.calls[0]!;
    expect(searchParams.get('cursor')).toBe('0:40:0');
    expect(options.history).toBe('push');
    expect(commitsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({query: expect.objectContaining({cursor: '0:40:0'})})
    );
  });

  it('requests only the next page when Next is clicked from a paged URL', async () => {
    const commitsMock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/releases/${encodeURIComponent(
        release.version
      )}/commits/`,
      body: [CommitFixture()],
      headers: {
        Link: '<http://127.0.0.1:8000/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", <http://127.0.0.1:8000/?cursor=0:80:0>; rel="next"; results="true"; cursor="0:80:0"',
      },
    });
    const {router} = renderComponent({query: {cursor: '0:40:0', project: '1'}});

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    await waitFor(() => expect(commitsMock).toHaveBeenCalledTimes(2));
    expect(router.location.query).toEqual({cursor: '0:80:0', project: '1'});
    expect(commitsMock.mock.calls.map(([, options]) => options.query.cursor)).toEqual([
      '0:40:0',
      '0:80:0',
    ]);
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
