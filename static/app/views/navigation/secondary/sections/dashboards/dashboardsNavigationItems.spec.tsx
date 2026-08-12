import {DashboardListItemFixture} from 'sentry-fixture/dashboard';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DashboardsNavigationItems} from 'sentry/views/navigation/secondary/sections/dashboards/dashboardsNavigationItems';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('DashboardsNavigationItems', () => {
  it('renders a reorderable list of starred dashboards', () => {
    render(
      <SecondaryNavigationContextProvider>
        <DashboardsNavigationItems
          dashboards={[
            DashboardListItemFixture({id: '1', title: 'Dashboard 1'}),
            DashboardListItemFixture({id: '2', title: 'Dashboard 2'}),
          ]}
        />
      </SecondaryNavigationContextProvider>
    );

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Drag to reorder'})).toHaveLength(2);
  });
});
