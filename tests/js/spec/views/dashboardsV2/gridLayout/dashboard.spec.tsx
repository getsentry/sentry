import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme as rtlMountWithTheme,
  screen,
} from 'sentry-test/reactTestingLibrary';

import Dashboard from 'sentry/views/dashboardsV2/dashboard';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';

describe('Dashboards > Dashboard', () => {
  const organization = TestStubs.Organization({
    features: ['dashboards-basic', 'dashboards-edit', 'dashboard-grid-layout'],
  });
  const mockDashboard = {
    dateCreated: '2021-08-10T21:20:46.798237Z',
    id: '1',
    title: 'Test Dashboard',
    widgets: [],
  };
  const newWidget: Widget = {
    id: '1',
    title: 'Test Discover Widget',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '',
        fields: ['count()'],
        orderby: '',
      },
    ],
  };
  const issueWidget: Widget = {
    id: '2',
    title: 'Test Issue Widget',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.ISSUE,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '',
        fields: ['title'],
        orderby: '',
      },
    ],
  };

  let initialData;

  beforeEach(() => {
    initialData = initializeOrg({organization, router: {}, project: 1, projects: []});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/widgets/`,
      method: 'POST',
      body: [],
    });
  });

  it('dashboard adds new widget if component is mounted with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const wrapper = mountWithTheme(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        onSetWidgetToBeUpdated={() => undefined}
        router={initialData.router}
        location={initialData.location}
        newWidget={newWidget}
        layout={[]}
        onLayoutChange={() => undefined}
        widgetLimitReached={false}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();
    expect(mockHandleAddCustomWidget).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component updated with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const wrapper = mountWithTheme(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        onSetWidgetToBeUpdated={() => undefined}
        router={initialData.router}
        location={initialData.location}
        layout={[]}
        onLayoutChange={() => undefined}
        widgetLimitReached={false}
      />,
      initialData.routerContext
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    wrapper.setProps({newWidget});
    await tick();
    wrapper.update();
    expect(mockHandleAddCustomWidget).toHaveBeenCalled();
  });

  it('dashboard does not display issue widgets if the user does not have issue widgets feature flag', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockDashboardWithIssueWidget = {
      ...mockDashboard,
      widgets: [newWidget, issueWidget],
    };
    rtlMountWithTheme(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboardWithIssueWidget}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        onSetWidgetToBeUpdated={() => undefined}
        router={initialData.router}
        location={initialData.location}
        layout={[]}
        onLayoutChange={() => undefined}
        widgetLimitReached={false}
      />
    );
    expect(screen.getByText('Test Discover Widget')).toBeInTheDocument();
    expect(screen.queryByText('Test Issue Widget')).not.toBeInTheDocument();
  });

  it('dashboard displays issue widgets if the user has issue widgets feature flag', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const organizationWithFlag = TestStubs.Organization({
      features: [
        'dashboards-basic',
        'dashboards-edit',
        'dashboard-grid-layout',
        'issues-in-dashboards',
      ],
    });
    const mockDashboardWithIssueWidget = {
      ...mockDashboard,
      widgets: [newWidget, issueWidget],
    };
    rtlMountWithTheme(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboardWithIssueWidget}
        organization={organizationWithFlag}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        onSetWidgetToBeUpdated={() => undefined}
        router={initialData.router}
        location={initialData.location}
        layout={[]}
        onLayoutChange={() => undefined}
        widgetLimitReached={false}
      />
    );
    expect(screen.getByText('Test Discover Widget')).toBeInTheDocument();
    expect(screen.getByText('Test Issue Widget')).toBeInTheDocument();
  });
});
