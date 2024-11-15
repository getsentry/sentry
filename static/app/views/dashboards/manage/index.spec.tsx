import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import localStorage from 'sentry/utils/localStorage';
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

const mockUseNavigate = jest.mocked(useNavigate);

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
  });
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({title: 'Test Dashboard'})],
    });

    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Dashboards')).toBeInTheDocument();

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();

    expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0);
  });

  it('shows error message when receiving error', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      statusCode: 400,
    });
    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('denies access on missing feature', async function () {
    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: mockUnauthorizedOrg,
    });

    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });

  it('denies access on no projects', async function () {
    act(() => ProjectsStore.loadInitialData([]));

    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
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
      ...RouteComponentPropsFixture(),
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
      ...RouteComponentPropsFixture(),
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
      ...RouteComponentPropsFixture(),
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
      ...RouteComponentPropsFixture(),
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
      ...RouteComponentPropsFixture(),
      organization: mockAuthorizedOrg,
    });

    expect(await screen.findByText('Test Dashboard 1')).toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText('Previous'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toggles between grid and list view', async function () {
    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: {
        ...mockAuthorizedOrg,
        features: [...FEATURES, 'dashboards-table-view'],
      },
    });

    expect(await screen.findByTestId('list')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('list'));

    expect(localStorage.setItem).toHaveBeenCalledWith(LAYOUT_KEY, '"list"');

    expect(await screen.findByTestId('grid')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('grid'));

    expect(localStorage.setItem).toHaveBeenCalledWith(LAYOUT_KEY, '"grid"');
  });
});
