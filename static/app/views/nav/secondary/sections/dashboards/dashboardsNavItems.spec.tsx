import {DashboardListItemFixture} from 'sentry-fixture/dashboard';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DashboardsNavItems} from 'sentry/views/nav/secondary/sections/dashboards/dashboardsNavItems';

describe('DashboardsNavItems', () => {
  it('should render', () => {
    render(
      <DashboardsNavItems
        initialDashboards={[
          DashboardListItemFixture({
            id: '1',
            title: 'Dashboard 1',
          }),
          DashboardListItemFixture({
            id: '2',
            title: 'Dashboard 2',
          }),
        ]}
      />
    );

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
  });
});
