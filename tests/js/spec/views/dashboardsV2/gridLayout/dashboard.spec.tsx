import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme as rtlMountWithTheme,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import Dashboard from 'sentry/views/dashboardsV2/dashboard';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';

describe('Dashboards > Dashboard', () => {
  const organization = TestStubs.Organization({
    features: ['dashboards-basic', 'dashboards-edit', 'dashboard-grid-layout'],
  });
  const organizationWithFlag = TestStubs.Organization({
    features: [
      'dashboards-basic',
      'dashboards-edit',
      'dashboard-grid-layout',
      'issues-in-dashboards',
    ],
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
        fields: ['title', 'assignee'],
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: [
        {
          annotations: [],
          id: '1',
          title: 'Error: Failed',
          project: {
            id: '3',
          },
          owners: [
            {
              type: 'ownershipRule',
              owner: 'user:2',
            },
          ],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [
        {
          user: {
            id: '2',
            name: 'test@sentry.io',
            email: 'test@sentry.io',
            avatar: {
              avatarType: 'letter_avatar',
              avatarUuid: null,
            },
          },
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags(),
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

  describe('Issue Widgets', () => {
    afterEach(() => {
      // @ts-ignore
      MemberListStore.init();
    });
    const mount = (dashboard, mockedOrg = initialData.organization) => {
      rtlMountWithTheme(
        <Dashboard
          paramDashboardId="1"
          dashboard={dashboard}
          organization={mockedOrg}
          isEditing={false}
          onUpdate={() => undefined}
          handleUpdateWidgetList={() => undefined}
          handleAddCustomWidget={() => undefined}
          onSetWidgetToBeUpdated={() => undefined}
          router={initialData.router}
          location={initialData.location}
          widgetLimitReached={false}
        />
      );
    };

    it('dashboard does not display issue widgets if the user does not have issue widgets feature flag', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [newWidget, issueWidget],
      };
      mount(mockDashboardWithIssueWidget);
      expect(screen.getByText('Test Discover Widget')).toBeInTheDocument();
      expect(screen.queryByText('Test Issue Widget')).not.toBeInTheDocument();
    });

    it('dashboard displays issue widgets if the user has issue widgets feature flag', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [newWidget, issueWidget],
      };
      mount(mockDashboardWithIssueWidget, organizationWithFlag);
      expect(screen.getByText('Test Discover Widget')).toBeInTheDocument();
      expect(screen.getByText('Test Issue Widget')).toBeInTheDocument();
    });

    it('renders suggested assignees', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [{...issueWidget}],
      };
      mount(mockDashboardWithIssueWidget, organizationWithFlag);
      expect(await screen.findByText('T')).toBeInTheDocument();
      userEvent.hover(screen.getByText('T'));
      expect(await screen.findByText('Suggestion:')).toBeInTheDocument();
      expect(screen.getByText('test@sentry.io')).toBeInTheDocument();
      expect(screen.getByText('Matching Issue Owners Rule')).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    let widgets: Widget[];
    const mount = dashboard => {
      const getDashboardComponent = () => (
        <Dashboard
          paramDashboardId="1"
          dashboard={dashboard}
          organization={initialData.organization}
          isEditing
          onUpdate={newWidgets => {
            widgets.splice(0, widgets.length, ...newWidgets);
          }}
          handleUpdateWidgetList={() => undefined}
          handleAddCustomWidget={() => undefined}
          onSetWidgetToBeUpdated={() => undefined}
          router={initialData.router}
          location={initialData.location}
          widgetLimitReached={false}
        />
      );
      const {rerender} = rtlMountWithTheme(getDashboardComponent());
      return {rerender: () => rerender(getDashboardComponent())};
    };

    beforeEach(() => {
      widgets = [newWidget];
    });

    it('displays the copy widget button in edit mode', () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};
      mount(dashboardWithOneWidget);
      expect(screen.getByLabelText('Duplicate Widget')).toBeInTheDocument();
    });

    it('duplicates the widget', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};
      const {rerender} = mount(dashboardWithOneWidget);
      userEvent.click(screen.getByLabelText('Duplicate Widget'));
      rerender();
      expect(screen.getAllByText('Test Discover Widget')).toHaveLength(2);
    });
  });
});
