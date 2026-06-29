import {DashboardFixture} from 'sentry-fixture/dashboard';

import {updateDashboard} from 'sentry/actionCreators/dashboards';

describe('updateDashboard', () => {
  const api = new MockApiClient();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not include revisionSource in the request body by default', async () => {
    const dashboard = DashboardFixture([]);
    const mockPut = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/${dashboard.id}/`,
      method: 'PUT',
      body: dashboard,
    });

    await updateDashboard(api, 'org-slug', dashboard);

    expect(mockPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.not.objectContaining({revisionSource: expect.anything()}),
      })
    );
  });

  it('includes revisionSource in the request body when provided', async () => {
    const dashboard = DashboardFixture([]);
    const mockPut = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/${dashboard.id}/`,
      method: 'PUT',
      body: dashboard,
    });

    await updateDashboard(api, 'org-slug', dashboard, {
      revisionSource: 'edit-with-agent',
    });

    expect(mockPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({revisionSource: 'edit-with-agent'}),
      })
    );
  });
});
