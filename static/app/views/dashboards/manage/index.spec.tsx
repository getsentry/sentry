import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import ManageDashboards from 'sentry/views/dashboards/manage';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

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

    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });
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

    await waitFor(() => {
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
  });

  it('denies access on missing feature', async function () {
    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: mockUnauthorizedOrg,
    });

    await waitFor(() => {
      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
    });
  });

  it('denies access on no projects', async function () {
    act(() => ProjectsStore.loadInitialData([]));

    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: mockAuthorizedOrg,
    });

    await waitFor(() => {
      expect(
        screen.getByText('You need at least one project to use this view')
      ).toBeInTheDocument();
    });
  });

  it('creates new dashboard', async function () {
    const org = OrganizationFixture({features: FEATURES});
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: org,
    });

    await waitFor(() => {
      userEvent.click(screen.getByTestId('dashboard-create'));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: {},
      });
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

    await waitFor(() => {
      selectEvent.select(
        screen.getByRole('button', {name: /sort by/i}),
        'Dashboard Name (A-Z)'
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({query: {sort: 'title'}})
      );
    });
  });

  it('can search', async function () {
    const org = OrganizationFixture({features: FEATURES});
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<ManageDashboards />, {
      ...RouteComponentPropsFixture(),
      organization: org,
    });

    await waitFor(async () => {
      await userEvent.click(screen.getByPlaceholderText('Search Dashboards'));
      await userEvent.keyboard('dash');
      await userEvent.keyboard('[Enter]');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({query: {query: 'dash'}})
      );
    });
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
    await waitFor(async () => {
      await userEvent.click(screen.getByLabelText('Next'));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            cursor: '0:9:0',
          },
        })
      );
    });
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
    await waitFor(async () => {
      await userEvent.click(screen.getByLabelText('Previous'));
    });

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
