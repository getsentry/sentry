import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import WidgetBuilderV2 from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';

const organization = OrganizationFixture({
  features: ['open-membership', 'visibility-explore-view'],
});

const projects = [
  ProjectFixture({id: '1', slug: 'project-1', isMember: true}),
  ProjectFixture({id: '2', slug: 'project-2', isMember: true}),
  ProjectFixture({id: '3', slug: 'project-3', isMember: false}),
];

describe('NewWidgetBuilder', () => {
  const onCloseMock = jest.fn();
  const onSaveMock = jest.fn();

  beforeEach(() => {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(projects);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
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
      body: {
        data: [
          [[1646100000], [{count: 1}]],
          [[1646120000], [{count: 1}]],
        ],
        start: 1646100000,
        end: 1646120000,
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders', async () => {
    render(
      <PageFiltersContainer skipLoadLastUsed skipInitializeUrlParams disablePersistence>
        <WidgetBuilderV2
          isOpen
          onClose={onCloseMock}
          dashboard={DashboardFixture([])}
          dashboardFilters={{}}
          onSave={onSaveMock}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </PageFiltersContainer>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {project: '-1'},
          },
        },
      }
    );

    expect(await screen.findByText('Custom Widget Builder')).toBeInTheDocument();

    expect(await screen.findByLabelText('Close Widget Builder')).toBeInTheDocument();

    expect(await screen.findByRole('button', {name: 'All Projects'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: '14D'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'All Releases'})).toBeInTheDocument();

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Description')).toBeInTheDocument();

    expect(await screen.findByRole('button', {name: 'Errors'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Errors'}));
    expect(await screen.findByRole('option', {name: 'Errors'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Transactions'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Spans'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Issues'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Releases'})).toBeInTheDocument();

    expect(screen.getByText('Table')).toBeInTheDocument();
    // ensure the dropdown input has the default value 'table'
    expect(screen.getByDisplayValue('table')).toBeInTheDocument();

    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Create a search query')).toBeInTheDocument();

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

  it('render the filter alias field and add filter button on chart widgets', async () => {
    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
        openWidgetTemplates={false}
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {project: '-1', displayType: 'line'},
          },
        },
      }
    );

    // see if alias field and add button are there
    expect(screen.getByPlaceholderText('Legend Alias')).toBeInTheDocument();
    expect(screen.getByText('+ Add Filter')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Remove this filter')).not.toBeInTheDocument();
    });
    // add a field and see if delete buttons are there
    await userEvent.click(screen.getByText('+ Add Filter'));
    expect(screen.getAllByLabelText('Remove this filter')).toHaveLength(2);
  });

  it('does not render the filter alias field and add filter button on other widgets', async () => {
    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
        openWidgetTemplates={false}
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {project: '-1'},
          },
        },
      }
    );

    // see if alias field and add button are not there
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Legend Alias')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('+ Add Filter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove this filter')).not.toBeInTheDocument();
  });

  it('renders the group by field on chart widgets', async () => {
    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
        openWidgetTemplates={false}
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {project: '-1', displayType: 'line'},
          },
        },
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Group')).toBeInTheDocument();
  });

  it('renders empty widget preview when no widget selected from templates', async () => {
    render(
      <WidgetBuilderV2
        isOpen
        onClose={onCloseMock}
        dashboard={DashboardFixture([])}
        dashboardFilters={{}}
        onSave={onSaveMock}
        openWidgetTemplates
        setOpenWidgetTemplates={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {project: '-1'},
          },
        },
      }
    );

    expect(await screen.findByText('Widget Library')).toBeInTheDocument();

    expect(await screen.findByText('Select a widget to preview')).toBeInTheDocument();
  });
});
