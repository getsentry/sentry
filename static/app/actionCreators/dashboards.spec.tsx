import {DashboardFixture} from 'sentry-fixture/dashboard';

import {updateDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';

jest.mock('sentry/actionCreators/indicator');

describe('updateDashboard', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('does not include revisionSource in the request body by default', async () => {
    const dashboard = DashboardFixture([]);
    const mockPut = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/${dashboard.id}/`,
      method: 'PUT',
      body: dashboard,
    });

    await updateDashboard('org-slug', dashboard);

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

    await updateDashboard('org-slug', dashboard, {
      revisionSource: 'edit-with-agent',
    });

    expect(mockPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({revisionSource: 'edit-with-agent'}),
      })
    );
  });

  it.each([
    'You cannot update widgets that are not part of this dashboard.',
    'You cannot use a query not owned by this widget',
  ])('suggests refreshing the page when the dashboard is stale: %s', async detail => {
    const dashboard = DashboardFixture([]);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/${dashboard.id}/`,
      method: 'PUT',
      statusCode: 400,
      body: [detail],
    });

    await expect(updateDashboard('org-slug', dashboard)).rejects.toBeDefined();

    expect(addErrorMessage).toHaveBeenCalledWith(
      'This dashboard may have been updated somewhere else. Refresh the page and try again.'
    );
  });

  it('passes through other validation errors unchanged', async () => {
    const dashboard = DashboardFixture([]);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/${dashboard.id}/`,
      method: 'PUT',
      statusCode: 400,
      body: {title: ['This field may not be blank.']},
    });

    await expect(updateDashboard('org-slug', dashboard)).rejects.toBeDefined();

    expect(addErrorMessage).toHaveBeenCalledWith('This field may not be blank.');
  });
});
