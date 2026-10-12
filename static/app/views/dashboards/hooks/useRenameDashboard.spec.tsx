import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {useRenameDashboard} from 'sentry/views/dashboards/hooks/useRenameDashboard';

describe('useRenameDashboard', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('sends only the title', async () => {
    const renameMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {id: '1', title: 'Renamed Dashboard'},
    });

    const {result} = renderHookWithProviders(() => useRenameDashboard(), {organization});

    act(() => {
      result.current.mutate({dashboardId: '1', title: 'Renamed Dashboard'});
    });

    await waitFor(() => expect(renameMock).toHaveBeenCalled());
    expect(renameMock).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/1/',
      expect.objectContaining({method: 'PUT', data: {title: 'Renamed Dashboard'}})
    );
  });

  it('refreshes the starred dashboards, which render the title of their own', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {id: '1', title: 'Renamed Dashboard'},
    });
    const starredMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
      match: [MockApiClient.matchQuery({filter: 'onlyFavorites'})],
    });

    const {result} = renderHookWithProviders(
      () => ({
        starred: useGetStarredDashboards(),
        rename: useRenameDashboard(),
      }),
      {organization}
    );

    await waitFor(() => expect(starredMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.rename.mutate({dashboardId: '1', title: 'Renamed Dashboard'});
    });

    await waitFor(() => expect(starredMock).toHaveBeenCalledTimes(2));
  });
});
