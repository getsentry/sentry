import {type QueryClient, useQueryClient} from '@tanstack/react-query';
import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {getStarredDashboardsQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {useToggleDashboardFavorite} from 'sentry/views/dashboards/hooks/useToggleDashboardFavorite';

const organization = OrganizationFixture({
  slug: 'org-slug',
  features: ['dashboards-starred', 'dashboards-user-last-visited'],
});

const starredQueryKey = getStarredDashboardsQueryKey(organization);
const tableQueryKey = dashboardsApiOptions(organization, {
  query: {sort: 'recentlyViewed', pin: 'favorites'},
}).queryKey;

function renderToggleHook(org = organization) {
  return renderHookWithProviders(
    () => ({
      queryClient: useQueryClient(),
      toggleFavorite: useToggleDashboardFavorite(),
    }),
    {organization: org}
  );
}

function starredIds(queryClient: QueryClient) {
  return queryClient.getQueryData(starredQueryKey)?.json.map(dashboard => dashboard.id);
}

function tableIds(queryClient: QueryClient) {
  return queryClient.getQueryData(tableQueryKey)?.json.map(dashboard => dashboard.id);
}

describe('useToggleDashboardFavorite', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('updates both the table and the starred sidebar when a dashboard is starred', async () => {
    const favoriteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/favorite/',
      method: 'PUT',
      body: {},
    });

    const {result} = renderToggleHook();
    const existingFavorite = DashboardListItemFixture({id: '1', isFavorited: true});
    const dashboardToStar = DashboardListItemFixture({id: '2', isFavorited: false});

    act(() => {
      result.current.queryClient.setQueryData(starredQueryKey, {
        json: [existingFavorite],
        headers: {},
      });
      result.current.queryClient.setQueryData(tableQueryKey, {
        json: [existingFavorite, dashboardToStar],
        headers: {},
      });
    });

    act(() => {
      result.current.toggleFavorite({dashboard: dashboardToStar, shouldFavorite: true});
    });

    // The sidebar gains the newly starred dashboard and the table re-sorts the
    // favorited rows to the top: both update from the single click.
    await waitFor(() => {
      expect(starredIds(result.current.queryClient)).toEqual(['1', '2']);
    });
    expect(tableIds(result.current.queryClient)).toEqual(['2', '1']);
    expect(favoriteMock).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/2/favorite/',
      expect.objectContaining({method: 'PUT', data: {shouldFavorite: true}})
    );
  });

  it('does not reorder the table without the dashboards-user-last-visited flag', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/favorite/',
      method: 'PUT',
      body: {},
    });

    const {result} = renderToggleHook(
      OrganizationFixture({slug: 'org-slug', features: ['dashboards-starred']})
    );
    const existingFavorite = DashboardListItemFixture({id: '1', isFavorited: true});
    const dashboardToStar = DashboardListItemFixture({id: '2', isFavorited: false});

    act(() => {
      result.current.queryClient.setQueryData(starredQueryKey, {
        json: [existingFavorite],
        headers: {},
      });
      result.current.queryClient.setQueryData(tableQueryKey, {
        json: [existingFavorite, dashboardToStar],
        headers: {},
      });
    });

    act(() => {
      result.current.toggleFavorite({dashboard: dashboardToStar, shouldFavorite: true});
    });

    await waitFor(() => {
      expect(starredIds(result.current.queryClient)).toEqual(['1', '2']);
    });
    expect(tableIds(result.current.queryClient)).toEqual(['1', '2']);
  });
});
