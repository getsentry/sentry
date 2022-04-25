import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import AddToDashboardModal from 'sentry/components/modals/widgetBuilder/addToDashboardModal';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
} from 'sentry/views/dashboardsV2/types';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

const mockWidgetAsQueryParams = {
  defaultTableColumns: ['field1', 'field2'],
  defaultTitle: 'Default title',
  defaultWidgetQuery: '',
  displayType: DisplayType.LINE,
  environment: [],
  project: [],
  source: DashboardWidgetSource.DISCOVERV2,
};

describe('add to dashboard modal', () => {
  let eventsStatsMock;
  const initialData = initializeOrg({
    ...initializeOrg(),
    organization: {
      features: ['new-widget-builder-experience', 'new-widget-builder-experience-design'],
    },
  });
  const testDashboard: DashboardDetails = {
    id: '1',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
  };
  const widget = {
    title: 'Test title',
    description: 'Test description',
    displayType: DisplayType.LINE,
    interval: '5m',
    queries: [
      {
        conditions: '',
        fields: ['count()'],
        aggregates: ['count()'],
        fieldAliases: [],
        columns: [],
        orderby: '',
        name: '',
      },
    ],
  };
  const defaultSelection = {
    projects: [],
    environments: [],
    datetime: {
      start: null,
      end: null,
      period: '24h',
      utc: false,
    },
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [{...testDashboard, widgetDisplay: [DisplayType.AREA]}],
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
  });

  it('renders with the widget title and description', async function () {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(screen.getByText('Test title')).toBeInTheDocument();
    expect(screen.getByText('Select Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This is a preview of how the widget will appear in your dashboard.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add + Stay in Discover'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeDisabled();
  });

  it('enables the buttons when a dashboard is selected', async function () {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(screen.getByRole('button', {name: 'Add + Stay in Discover'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeDisabled();

    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    expect(screen.getByRole('button', {name: 'Add + Stay in Discover'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeEnabled();
  });

  it('includes a New Dashboard option in the selector with saved dashboards', async function () {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    selectEvent.openMenu(screen.getByText('Select Dashboard'));
    expect(screen.getByText('+ Create New Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('calls the events stats endpoint with the query and selection values', async function () {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          project: [],
          interval: '5m',
          orderby: '',
          statsPeriod: '24h',
          yAxis: ['count()'],
        }),
      })
    );
  });

  it('navigates to the widget builder when clicking Open in Widget Builder', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    userEvent.click(screen.getByText('Open in Widget Builder'));
    expect(initialData.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/dashboard/1/widget/new/',
      query: mockWidgetAsQueryParams,
    });
  });

  it('updates the selected dashboard with the widget when clicking Add + Stay in Discover', async () => {
    const dashboardDetailGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: {id: '1', widgets: []},
    });
    const dashboardDetailPutMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {},
    });
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    userEvent.click(screen.getByText('Add + Stay in Discover'));
    expect(dashboardDetailGetMock).toHaveBeenCalled();

    // mocked widgets response is an empty array, assert this new widget
    // is sent as an update to the dashboard
    await waitFor(() => {
      expect(dashboardDetailPutMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({data: expect.objectContaining({widgets: [widget]})})
      );
    });
  });

  it('disables Add + Stay in Discover when a new dashboard is selected', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widget={widget}
        selection={defaultSelection}
        router={initialData.router}
        widgetAsQueryParams={mockWidgetAsQueryParams}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(
      screen.getByText('Select Dashboard'),
      '+ Create New Dashboard'
    );

    expect(screen.getByRole('button', {name: 'Add + Stay in Discover'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeEnabled();
  });
});
