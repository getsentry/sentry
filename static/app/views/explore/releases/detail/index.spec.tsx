import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';
import type {RouterConfig} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {ReleaseProject} from 'sentry/types/release';
import ReleasesDetailContainer from 'sentry/views/explore/releases/detail';

describe('ReleasesDetailContainer', () => {
  const organization = OrganizationFixture();
  const project = ReleaseProjectFixture({
    id: 1,
    slug: 'sentry-android-shop',
    platform: 'android',
  }) as Required<ReleaseProject>;
  const release = ReleaseFixture({
    version: 'test-release',
    projects: [project],
  });
  const releaseMeta = ReleaseMetaFixture({
    version: 'test-release',
    projects: [project],
  });

  function renderContainer(query: Record<string, string | string[]>) {
    const pathname = `/organizations/${organization.slug}/explore/releases/test-release/`;
    const initialRouterConfig: RouterConfig = {
      location: {pathname, query},
      route: '/organizations/:orgId/explore/releases/:release/',
    };

    return render(<ReleasesDetailContainer />, {
      organization,
      initialRouterConfig,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    ProjectsStore.reset();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: String(project.id), slug: project.slug}),
    ]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      body: releaseMeta,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/',
      method: 'GET',
      body: release,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/deploys/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      method: 'GET',
      body: {groups: []},
    });
  });

  it('strips a trailing slash from the project query param', async () => {
    const {router} = renderContainer({project: '1/'});

    await waitFor(() => {
      expect(router.location.query.project).toBe('1');
    });
  });

  it('keeps the project query param unchanged when there is no trailing slash', async () => {
    const {router} = renderContainer({project: '1'});

    // Give effects a chance to run; the URL must stay untouched.
    await waitFor(() => {
      expect(router.location.query.project).toBe('1');
    });
    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/explore/releases/test-release/`
    );
  });
});
