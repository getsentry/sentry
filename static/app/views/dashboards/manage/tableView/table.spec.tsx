import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DashboardTable} from './table';

describe('DashboardTable', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'GET',
      body: {dashboards: []},
    });
  });

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

  it('renders environments', () => {
    render(
      <DashboardTable
        dashboards={[
          DashboardListItemFixture({
            environment: ['production', 'staging'],
          }),
        ]}
        cursorKey="test"
        isLoading={false}
        title={''}
      />
    );

    expect(screen.getByText('production, staging')).toBeInTheDocument();
  });

  it('should render last visited', () => {
    const now = new Date().toISOString();
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
            lastVisited: now,
          }),
        ]}
        isLoading={false}
        title="My custom dashboard"
        cursorKey="test"
      />
    );

    expect(screen.getByText('My custom dashboard')).toBeInTheDocument();

    const row = screen.getByTestId('table-row-0');

    const lastVisitedCell = within(row).getByRole('time');
    expect(lastVisitedCell).toBeInTheDocument();

    // Since the timestamp is rendered as a relative time, this
    // matches the format of the "0ms ago" text more robustly in
    // case the timestamp does not exactly match
    const lastVisitedContent = lastVisitedCell.textContent;
    expect(lastVisitedContent).toMatch(/[\d\w]+s ago$/);
  });

  it('renders release filters', () => {
    render(
      <DashboardTable
        dashboards={[DashboardListItemFixture({filters: {release: ['1.0.0']}})]}
        cursorKey="test"
        isLoading={false}
        title={''}
      />
    );

    const filterCells = screen.getAllByLabelText('release:[1.0.0]');
    expect(filterCells[0]).toHaveTextContent('release is 1.0.0');
  });

  it('should update the dashboard favorite status', async () => {
    const mockFavoriteRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/favorite/',
      method: 'PUT',
      body: {isFavorited: true},
    });

    render(
      <DashboardTable
        dashboards={[DashboardListItemFixture({isFavorited: false})]}
        cursorKey="test"
        isLoading={false}
        title="My custom dashboards"
      />
    );

    const starButton = screen.getByLabelText('Star');
    await userEvent.click(starButton);

    expect(mockFavoriteRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/1/favorite/',
      expect.objectContaining({
        method: 'PUT',
        data: {isFavorited: true},
      })
    );
  });
});
