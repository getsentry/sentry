import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useReorderStarredDashboards} from 'sentry/views/dashboards/hooks/useReorderStarredDashboards';

describe('useReorderStarredDashboards', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('sends the reordered dashboard ids to the starred order endpoint', async () => {
    const reorderMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/starred/order/',
      method: 'PUT',
      match: [MockApiClient.matchData({dashboard_ids: ['2', '1']})],
    });

    const {result} = renderHookWithProviders(() => useReorderStarredDashboards(), {
      organization,
    });

    act(() => {
      result.current([
        DashboardListItemFixture({id: '2', title: 'Dashboard 2'}),
        DashboardListItemFixture({id: '1', title: 'Dashboard 1'}),
      ]);
    });

    await waitFor(() => expect(reorderMock).toHaveBeenCalled());
  });
});
