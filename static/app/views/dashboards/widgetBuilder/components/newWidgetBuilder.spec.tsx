import {DashboardFixture} from 'sentry-fixture/dashboard';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/spans/fields/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
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

    // Test sort by selector for table display type
    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('High to low')).toBeInTheDocument();
    expect(screen.getByText(`Select a column\u{2026}`)).toBeInTheDocument();

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();
    expect(await screen.findByTestId('add-description')).toBeInTheDocument();

    expect(screen.getByLabelText('Widget panel')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Group by')).not.toBeInTheDocument();
    });
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

  it('renders the group by field on chart widgets', async function () {
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

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('Add Group')).toBeInTheDocument();
  });

  it('renders the limit sort by field on chart widgets', async function () {
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

    expect(await screen.findByText('Limit to 5 results')).toBeInTheDocument();
    expect(await screen.findByText('High to low')).toBeInTheDocument();
    expect(await screen.findByText('(Required)')).toBeInTheDocument();
  });

  it('does not render sort by field on big number widgets', async function () {
    const bigNumberRouter = RouterFixture({
      ...router,
      location: {
        ...router.location,
        query: {...router.location.query, displayType: 'big_number'},
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
        router: bigNumberRouter,
        organization,
      }
    );

    await waitFor(() => {
      expect(screen.queryByText('Sort by')).not.toBeInTheDocument();
    });
  });
});
