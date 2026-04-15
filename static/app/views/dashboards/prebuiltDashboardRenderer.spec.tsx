import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

jest.mock('sentry/views/dashboards/detail', () => ({
  DashboardDetailWithInjectedProps: () => <div data-test-id="dashboard-detail" />,
}));

jest.mock('sentry/views/dashboards/utils/usePopulateLinkedDashboards', () => ({
  useGetPrebuiltDashboard: () => ({
    dashboard: {id: '42', widgets: []},
    isLoading: false,
  }),
}));

describe('PrebuiltDashboardRenderer', () => {
  const organization = OrganizationFixture();

  it('renders dashboard link with page filter query params from the URL', async () => {
    render(
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.BACKEND_OVERVIEW} />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/insights/backend/',
            query: {
              project: '1',
              environment: 'production',
              statsPeriod: '7d',
            },
          },
        },
      }
    );

    const link = await screen.findByRole('link', {
      name: 'View this page on Dashboards',
    });

    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining(`/organizations/${organization.slug}/dashboard/42/`)
    );
    expect(link).toHaveAttribute('href', expect.stringContaining('project=1'));
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('environment=production')
    );
    expect(link).toHaveAttribute('href', expect.stringContaining('statsPeriod=7d'));
  });
});
