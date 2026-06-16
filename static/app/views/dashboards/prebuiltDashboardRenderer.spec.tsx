import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

jest.mock('sentry/views/dashboards/detail', () => ({
  DashboardDetailWithInjectedProps: ({pageAlerts}: {pageAlerts?: ReactNode}) => (
    <div data-test-id="dashboard-detail">{pageAlerts}</div>
  ),
}));

jest.mock('sentry/views/dashboards/utils/usePopulateLinkedDashboards', () => ({
  useGetPrebuiltDashboard: () => ({
    dashboard: {id: '42', widgets: []},
    isLoading: false,
  }),
}));

describe('PrebuiltDashboardRenderer', () => {
  const initialRouterConfig = {
    location: {
      pathname: '/insights/backend/',
      query: {
        project: '1',
        environment: 'production',
        statsPeriod: '7d',
      },
    },
  };

  it('redirects to the corresponding dashboard with page filter query params when flag is enabled', async () => {
    const organization = OrganizationFixture({
      features: ['insights-to-dashboards-ui-rollout'],
    });

    const {router} = render(
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.BACKEND_OVERVIEW} />,
      {organization, initialRouterConfig}
    );

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/dashboard/42/`
      );
    });
    expect(router.location.query).toEqual(
      expect.objectContaining({
        project: '1',
        environment: 'production',
        statsPeriod: '7d',
      })
    );
  });

  it('does not redirect when flag is disabled', async () => {
    const organization = OrganizationFixture({features: []});

    const {router} = render(
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.BACKEND_OVERVIEW} />,
      {organization, initialRouterConfig}
    );

    // Wait for any potential async redirect to settle
    await waitFor(() => {
      expect(router.location.pathname).toBe('/insights/backend/');
    });
  });
});
