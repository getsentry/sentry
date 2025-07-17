import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DashboardTable} from './table';

describe('DashboardTable', () => {
  it('should render', () => {
    render(
      <DashboardTable
        dashboards={[
          DashboardListItemFixture({
            id: '1',
            title: 'Test',
            projects: [],
            createdBy: UserFixture({
              name: 'Test User',
            }),
            isFavorited: true,
            widgetPreview: [],
          }),
        ]}
        isLoading={false}
        title="My custom dashboards"
        cursorKey="test"
      />
    );

    expect(screen.getByText('My custom dashboards')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('My Projects')).toBeInTheDocument();

    // 0 widgets
    expect(screen.getByText('0')).toBeInTheDocument();

    // The dashboard is starred, so the button should prompt "Unstar"
    expect(screen.getByLabelText('Unstar')).toBeInTheDocument();
  });
});
