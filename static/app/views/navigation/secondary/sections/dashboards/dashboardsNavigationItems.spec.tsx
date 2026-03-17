import {DashboardListItemFixture} from 'sentry-fixture/dashboard';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DashboardsNavigationItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavigationItems';

describe('DashboardsNavigationItems', () => {
  it('should render', () => {
    render(
      <DashboardsNavigationItems
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
