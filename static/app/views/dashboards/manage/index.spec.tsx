import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import ManageDashboards, {LAYOUT_KEY} from 'sentry/views/dashboards/manage';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

jest.mock('sentry/utils/localStorage');

const FEATURES = [
  'dashboards-basic',
  'dashboards-edit',
  'discover-query',
  'dashboards-prebuilt-insights-dashboards',
];

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('sentry/utils/useLocation');

const mockUseNavigate = jest.mocked(useNavigate);
const mockUseLocation = jest.mocked(useLocation);

describe('Dashboards > Detail', () => {
  const mockUnauthorizedOrg = OrganizationFixture({
    features: ['dashboards-basic', 'discover-query'],
  });

  const mockAuthorizedOrg = OrganizationFixture({
    features: FEATURES,
  });
  beforeEach(() => {
    act(() => ProjectsStore.loadInitialData([ProjectFixture()]));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/?sort=name&per_page=9',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/starred/',
      body: [],
    });

    mockUseLocation.mockReturnValue(LocationFixture());
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    localStorageWrapper.clear();
  });

  it('renders', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard'})],
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Custom Dashboards')).toBeInTheDocument();

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();

    expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0);
  });

  it('shows error message when receiving error', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      statusCode: 400,
    });
    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('denies access on missing feature', async () => {
    render(<ManageDashboards />, {
      organization: mockUnauthorizedOrg,
    });

    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });

  it('denies access on no projects', async () => {
    act(() => ProjectsStore.loadInitialData([]));

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(
      await screen.findByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });

  it('does not fetch dashboards when there are no projects', async () => {
    act(() => ProjectsStore.loadInitialData([]));

    const dashboardsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(
      await screen.findByText('You need at least one project to use this view')
    ).toBeInTheDocument();

    expect(dashboardsRequest).not.toHaveBeenCalled();
  });

  it('creates new dashboard', async () => {
    const org = OrganizationFixture({features: FEATURES});
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      organization: org,
    });

    await userEvent.click(await screen.findByTestId('dashboard-create'));

    expect(mockNavigate).toHaveBeenCalledWith('/organizations/org-slug/dashboards/new/');
  });

  it('can sort', async () => {
    const org = OrganizationFixture({features: FEATURES});
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      organization: org,
    });

    await selectEvent.select(
      await screen.findByRole('button', {name: /sort by/i}),
      'Dashboard Name (A-Z)'
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({query: {sort: 'title'}})
    );
  });

  it('can search', async () => {
    const org = OrganizationFixture({features: FEATURES});
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      organization: org,
    });

    await userEvent.click(await screen.findByPlaceholderText('Search Dashboards'));
    await userEvent.keyboard('dash');
    await userEvent.keyboard('[Enter]');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({query: {query: 'dash'}})
    );
  });

  it('uses pagination correctly', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard 1'})],
      headers: {Link: getPaginationPageLink({numRows: 15, pageSize: 9, offset: 0})},
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Test Dashboard 1')).toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText('Next'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          cursor: '0:9:0',
        },
      })
    );
  });

  it('disables pagination correctly', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard 1'})],
      headers: {Link: getPaginationPageLink({numRows: 15, pageSize: 9, offset: 0})},
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Test Dashboard 1')).toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText('Previous'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toggles between grid and list view', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard 1'})],
      headers: {Link: getPaginationPageLink({numRows: 15, pageSize: 9, offset: 0})},
    });

    render(<ManageDashboards />, {
      organization: {
        ...mockAuthorizedOrg,
      },
    });

    expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();

    expect(await screen.findByTestId('grid')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('grid'));

    expect(localStorageWrapper.setItem).toHaveBeenCalledWith(LAYOUT_KEY, '"grid"');
    expect(await screen.findByTestId('dashboard-grid')).toBeInTheDocument();

    expect(await screen.findByTestId('table')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('table'));

    expect(localStorageWrapper.setItem).toHaveBeenCalledWith(LAYOUT_KEY, '"table"');
    expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();
  });

  it('defaults to table view when no layout preference is stored', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard 1'})],
      headers: {Link: getPaginationPageLink({numRows: 15, pageSize: 9, offset: 0})},
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();
  });

  it('respects stored grid layout preference', async () => {
    localStorageWrapper.setItem(LAYOUT_KEY, '"grid"');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard 1'})],
      headers: {Link: getPaginationPageLink({numRows: 15, pageSize: 9, offset: 0})},
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByTestId('dashboard-grid')).toBeInTheDocument();
  });
});
