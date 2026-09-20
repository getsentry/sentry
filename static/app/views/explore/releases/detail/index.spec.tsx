import {HealthFixture} from 'sentry-fixture/health';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {ReleaseProject} from 'sentry/types/release';
import ReleasesDetailContainer from 'sentry/views/explore/releases/detail/';

describe('releases/detail', () => {
  const organization = OrganizationFixture();
  const version = '1.2.3';
  const project = ProjectFixture({
    id: '12345',
    slug: 'my-project',
    name: 'My Project',
    platform: 'android',
  });
  const releaseProjects: Array<Required<ReleaseProject>> = [
    {
      id: 12345,
      slug: 'my-project',
      name: 'My Project',
      newGroups: 0,
      platform: 'android',
      platforms: ['android'],
      hasHealthData: false,
      healthData: HealthFixture(),
    },
  ];
  const release = ReleaseFixture({
    version,
    projects: releaseProjects,
    currentProjectMeta: {
      nextReleaseVersion: null,
      prevReleaseVersion: null,
      firstReleaseVersion: null,
      lastReleaseVersion: null,
      sessionsUpperBound: null,
      sessionsLowerBound: null,
    },
  });

  let releaseRequest: jest.Mock;
  let sessionRequest: jest.Mock;

  beforeEach(() => {
    act(() => ProjectsStore.loadInitialData([project]));
    act(() =>
      PageFiltersStore.onInitializeUrlState({
        projects: [],
        environments: [],
        datetime: {period: null, utc: null, start: null, end: null},
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${version}/meta/`,
      body: ReleaseMetaFixture({version, deployCount: 0, projects: releaseProjects}),
    });
    releaseRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${version}/`,
      body: release,
    });
    sessionRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      body: null,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
  });

  it('strips a trailing slash from the project URL param before requesting the release', async () => {
    render(<ReleasesDetailContainer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/releases/${version}/`,
          query: {project: '12345/'},
        },
        route: '/organizations/:orgId/releases/:release/',
      },
    });

    expect(await screen.findByText(version)).toBeInTheDocument();
    expect(releaseRequest).toHaveBeenCalledTimes(1);
    expect(releaseRequest.mock.calls[0][1].query.project).toBe('12345');
    expect(sessionRequest.mock.calls[0][1].query.project).toBe('12345');
  });
});
