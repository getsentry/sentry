import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import localStorage from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import ManageDashboards, {LAYOUT_KEY} from 'sentry/views/dashboards/manage';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

jest.mock('sentry/utils/localStorage');

const FEATURES = [
  'global-views',
  'dashboards-basic',
  'dashboards-edit',
  'discover-query',
];

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('sentry/utils/useLocation');

const mockUseNavigate = jest.mocked(useNavigate);
const mockUseLocation = jest.mocked(useLocation);

describe('Dashboards > Detail', function () {
  const mockUnauthorizedOrg = OrganizationFixture({
    features: ['global-views', 'dashboards-basic', 'discover-query'],
  });

  const mockAuthorizedOrg = OrganizationFixture({
    features: FEATURES,
  });
  beforeEach(function () {
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
  afterEach(function () {
    MockApiClient.clearMockResponses();
    localStorage.clear();
  });

  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard'})],
    });

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('All Dashboards')).toBeInTheDocument();

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();

    expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0);
  });

  it('shows error message when receiving error', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      statusCode: 400,
    });
    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('denies access on missing feature', async function () {
    render(<ManageDashboards />, {
      organization: mockUnauthorizedOrg,
    });

    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });

  it('denies access on no projects', async function () {
    act(() => ProjectsStore.loadInitialData([]));

    render(<ManageDashboards />, {
      organization: mockAuthorizedOrg,
    });

    expect(
      await screen.findByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });

  it('creates new dashboard', async function () {
    const org = OrganizationFixture({features: FEATURES});
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      organization: org,
    });

    await userEvent.click(await screen.findByTestId('dashboard-create'));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/dashboards/new/',
      query: {},
    });
  });

  it('can sort', async function () {
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

  it('can search', async function () {
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

  it('uses pagination correctly', async function () {
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

  it('disables pagination correctly', async function () {
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

  it('toggles between grid and list view', async function () {
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

    expect(await screen.findByTestId('table')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('table'));

    expect(localStorage.setItem).toHaveBeenCalledWith(LAYOUT_KEY, '"table"');
    expect(await screen.findByTestId('grid-editable')).toBeInTheDocument();

    expect(await screen.findByTestId('grid')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('grid'));

    expect(localStorage.setItem).toHaveBeenCalledWith(LAYOUT_KEY, '"grid"');
    expect(await screen.findByTestId('dashboard-grid')).toBeInTheDocument();
  });

  it('uses recently viewed sort by default on table view', async function () {
    const org = OrganizationFixture({
      features: [...FEATURES, 'dashboards-starred-reordering'],
    });
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    // mock the view type to table
    localStorage.setItem(LAYOUT_KEY, '"table"');

    render(<ManageDashboards />, {
      organization: org,
    });

    const sortBy = await screen.findByTestId('sort-by-select');
    expect(sortBy).toBeInTheDocument();
    // The prefix and the selection are concatenated when using text content
    expect(sortBy).toHaveTextContent('Sort ByRecently Viewed');
  });

  it('does not show My Dashboards as a sort option in table view', async function () {
    const org = OrganizationFixture({
      features: [...FEATURES, 'dashboards-starred-reordering'],
    });
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    // mock the view type to table
    localStorage.setItem(LAYOUT_KEY, '"table"');

    render(<ManageDashboards />, {
      organization: org,
    });

    const sortBy = await screen.findByTestId('sort-by-select');
    expect(sortBy).toBeInTheDocument();
    // The prefix and the selection are concatenated when using text content
    expect(sortBy).toHaveTextContent('Sort ByRecently Viewed');
    expect(screen.queryByText('My Dashboards')).not.toBeInTheDocument();
  });

  it('redirects the URL to the default sort option when the sort option is not valid', async function () {
    const org = OrganizationFixture({
      features: [...FEATURES, 'dashboards-starred-reordering'],
    });
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLocation.mockReturnValue(LocationFixture({query: {sort: 'invalid'}}));

    render(<ManageDashboards />, {
      organization: org,
    });

    expect(await screen.findByText('My Dashboards')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({query: {sort: 'mydashboards'}})
      );
    });
  });

  it('shows the most favorited sort option for the %s view type', async function () {
    const org = OrganizationFixture({
      features: [...FEATURES, 'dashboards-starred-reordering'],
    });
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      organization: org,
    });

    await selectEvent.openMenu(await screen.findByRole('button', {name: /sort by/i}));
    await userEvent.click(await screen.findByRole('option', {name: 'Most Starred'}));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({query: {sort: 'mostFavorited'}})
    );
  });
});
