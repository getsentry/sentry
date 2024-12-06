import {DashboardFixture} from 'sentry-fixture/dashboard';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetBuilderV2 from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';

const {organization, projects, router} = initializeOrg({
  organization: {features: ['global-views', 'open-membership', 'dashboards-eap']},
  projects: [
    {id: '1', slug: 'project-1', isMember: true},
    {id: '2', slug: 'project-2', isMember: true},
    {id: '3', slug: 'project-3', isMember: false},
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/dashboard/1/',
      query: {project: '-1'},
    },
    params: {},
  },
});

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('NewWidgetBuiler', function () {
  const onCloseMock = jest.fn();
  const onSaveMock = jest.fn();

  beforeEach(function () {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['projects'])
    );

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(projects);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboard/1/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders', async function () {
    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
      />,
      {
        router,
        organization,
      }
    );

    expect(await screen.findByText('Create Custom Widget')).toBeInTheDocument();

    expect(await screen.findByLabelText('Close Widget Builder')).toBeInTheDocument();

    expect(await screen.findByRole('button', {name: 'All Projects'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: '14D'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'All Releases'})).toBeInTheDocument();

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Widget Description')).toBeInTheDocument();

    expect(await screen.findByLabelText('Dataset')).toHaveAttribute('role', 'radiogroup');
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Releases')).toBeInTheDocument();

    expect(screen.getByText('Table')).toBeInTheDocument();
    // ensure the dropdown input has the default value 'table'
    expect(screen.getByDisplayValue('table')).toBeInTheDocument();

    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();
    expect(await screen.findByTestId('add-description')).toBeInTheDocument();

    expect(screen.getByLabelText('Widget panel')).toBeInTheDocument();
  });

  it('edits name and description', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
      />,
      {
        router,
        organization,
      }
    );

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({title: 'some name'}),
      })
    );

    await userEvent.click(await screen.findByTestId('add-description'));

    await userEvent.type(
      await screen.findByPlaceholderText('Description'),
      'some description'
    );
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({description: 'some description'}),
      })
    );
  });

  it('changes the dataset', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
      />,
      {
        router,
        organization,
      }
    );

    await userEvent.click(await screen.findByLabelText('Issues'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({dataset: 'issue'}),
      })
    );
  });

  it('changes the visualization type', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
      />,
      {
        router,
        organization,
      }
    );

    // click dropdown
    await userEvent.click(await screen.findByText('Table'));
    // select new option
    await userEvent.click(await screen.findByText('Bar'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({displayType: 'bar'}),
      })
    );
  });

  it('render the filter alias field and add filter button on chart widgets', async function () {
    const chartsRouter = RouterFixture({
      ...router,
      location: {
        ...router.location,
        query: {...router.location.query, displayType: 'line'},
      },
    });

    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
      />,
      {
        router: chartsRouter,
        organization,
      }
    );

    // see if alias field and add button are there
    expect(screen.getByPlaceholderText('Legend Alias')).toBeInTheDocument();
    expect(screen.getByText('Add Filter')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Remove this filter')).not.toBeInTheDocument();
    });
    // add a field and see if delete buttons are there
    await userEvent.click(screen.getByText('Add Filter'));
    expect(screen.getAllByLabelText('Remove this filter')).toHaveLength(2);
  });

  it('does not render the filter alias field and add filter button on other widgets', async function () {
    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
      />,
      {
        router,
        organization,
      }
    );

    // see if alias field and add button are not there
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Legend Alias')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Filter')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Remove this filter')).not.toBeInTheDocument();
    });
  });
});
