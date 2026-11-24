import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {localStorageWrapper} from 'sentry/utils/localStorage';

import DetectorViewContainer from './detectorViewContainer';

describe('DetectorViewContainer', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'project-1'}),
      ProjectFixture({id: '2', slug: 'project-2'}),
    ]);
    jest.spyOn(localStorageWrapper, 'getItem').mockImplementation(() =>
      JSON.stringify({
        projects: [2],
        environments: [],
        start: '2026-11-10T01:26:00',
        end: '2026-11-10T06:16:00',
        period: null,
        utc: null,
        pinnedFilters: ['projects', 'environments', 'datetime'],
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores last-used page filters on monitor lists', async () => {
    const {router} = render(<DetectorViewContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/organizations/${organization.slug}/monitors/`},
        route: '/organizations/:orgId/monitors/',
      },
    });

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({
          project: '2',
          start: '2026-11-10T01:26:00',
          end: '2026-11-10T06:16:00',
        })
      );
    });
  });

  it('does not restore a last-used date range on a monitor page', async () => {
    const {router} = render(<DetectorViewContainer />, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/organizations/${organization.slug}/monitors/1/`},
        route: '/organizations/:orgId/monitors/:detectorId/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/1/`
      );
    });
    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.end).toBeUndefined();
  });
});
