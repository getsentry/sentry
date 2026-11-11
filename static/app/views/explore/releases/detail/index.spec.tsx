import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';

import {
  render,
  renderGlobalModal,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import ReleasesDetailContainer from 'sentry/views/explore/releases/detail';

describe('ReleasesDetailContainer', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/1.0.0/meta/',
      statusCode: 404,
      body: {},
    });
  });

  it('removes global date params from the URL without a history entry when they are present', async () => {
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();

    const {router} = render(<ReleasesDetailContainer />, {
      organization,
      onNuqsUrlUpdate,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/releases/1.0.0/',
          query: {
            project: '1',
            statsPeriod: '14d',
            utc: 'true',
            pageStatsPeriod: '7d',
          },
        },
        route: '/organizations/:orgId/releases/:release/',
      },
    });

    await waitFor(() =>
      expect(router.location.query).toEqual({project: '1', pageStatsPeriod: '7d'})
    );
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'replace'})})
    );
  });

  it('closes the project picker and requests details for the picked project when a project is picked', async () => {
    const projects = [
      ProjectFixture({id: '1', slug: 'project-one'}),
      ProjectFixture({id: '2', slug: 'project-two'}),
    ];
    ProjectsStore.loadInitialData(projects);
    OrganizationStore.onUpdate(organization);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: projects,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/1.0.0/meta/',
      body: ReleaseMetaFixture({
        version: '1.0.0',
        deployCount: 1,
        projects: projects.map(({id, slug, name}) => ({
          id: Number(id),
          slug,
          name,
          newGroups: 0,
          platform: 'javascript',
          platforms: ['javascript'],
        })),
      }),
    });
    const unscopedMocks = [
      '/organizations/org-slug/releases/1.0.0/',
      '/organizations/org-slug/releases/1.0.0/deploys/',
      '/organizations/org-slug/sessions/',
    ].map(url => MockApiClient.addMockResponse({url, body: {}}));
    const releaseMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/1.0.0/',
      body: ReleaseFixture({version: '1.0.0'}),
      match: [MockApiClient.matchQuery({project: ['2']})],
    });
    const deploysMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/1.0.0/deploys/',
      body: [],
      match: [MockApiClient.matchQuery({project: ['2']})],
    });
    const sessionsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: {groups: [], intervals: []},
      match: [MockApiClient.matchQuery({project: ['2']})],
    });

    renderGlobalModal();
    const {router} = render(<ReleasesDetailContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/explore/releases/1.0.0/'},
        route: '/organizations/:orgId/explore/releases/:release/',
      },
    });

    await selectEvent.select(
      await screen.findByText('Select a Project to continue'),
      'project-two'
    );

    await waitFor(() => expect(sessionsMock).toHaveBeenCalled());
    expect(router.location.query).toEqual({project: '2'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(releaseMock).toHaveBeenCalled();
    expect(deploysMock).toHaveBeenCalled();
    for (const unscopedMock of unscopedMocks) {
      expect(unscopedMock).not.toHaveBeenCalled();
    }
  });
});
