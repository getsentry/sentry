import {Organization} from 'sentry-fixture/organization';
import {Tags} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import Dashboard from 'sentry/views/dashboards/dashboard';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboards/types';

import {OrganizationContext} from '../organizationContext';

describe('Dashboards > Dashboard', () => {
  const organization = Organization({
    features: ['dashboards-basic', 'dashboards-edit'],
  });
  const mockDashboard = {
    dateCreated: '2021-08-10T21:20:46.798237Z',
    id: '1',
    title: 'Test Dashboard',
    widgets: [],
    projects: [],
    filters: {},
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
        aggregates: ['count()'],
        columns: [],
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
        aggregates: [],
        columns: ['title', 'assignee'],
        orderby: '',
      },
    ],
  };

  let initialData, tagsMock;

  beforeEach(() => {
    initialData = initializeOrg({organization, router: {}, projects: []});
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
    tagsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: Tags(),
    });
  });

  it('fetches tags', () => {
    render(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={() => undefined}
        router={initialData.router}
        location={initialData.router.location}
        widgetLimitReached={false}
        isEditing={false}
      />,
      {context: initialData.routerContext}
    );
    expect(tagsMock).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component is mounted with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    render(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        router={initialData.router}
        location={initialData.router.location}
        newWidget={newWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
      />,
      {context: initialData.routerContext}
    );
    await waitFor(() => expect(mockHandleAddCustomWidget).toHaveBeenCalled());
    expect(mockCallbackToUnsetNewWidget).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component updated with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    const {rerender} = render(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        router={initialData.router}
        location={initialData.router.location}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
      />,
      {context: initialData.routerContext}
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    expect(mockCallbackToUnsetNewWidget).not.toHaveBeenCalled();

    // Re-render with newWidget prop
    rerender(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        router={initialData.router}
        location={initialData.router.location}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        newWidget={newWidget}
      />
    );
    await waitFor(() => expect(mockHandleAddCustomWidget).toHaveBeenCalled());
    expect(mockCallbackToUnsetNewWidget).toHaveBeenCalled();
  });

  it('dashboard does not try to add new widget if no newWidget', () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    render(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        router={initialData.router}
        location={initialData.router.location}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
      />,
      {context: initialData.routerContext}
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    expect(mockCallbackToUnsetNewWidget).not.toHaveBeenCalled();
  });

  describe('Issue Widgets', () => {
    beforeEach(() => {
      MemberListStore.init();
    });

    const mount = (dashboard, mockedOrg = initialData.organization) => {
      render(
        <OrganizationContext.Provider value={initialData.organization}>
          <MEPSettingProvider forceTransactions={false}>
            <Dashboard
              paramDashboardId="1"
              dashboard={dashboard}
              organization={mockedOrg}
              isEditing={false}
              onUpdate={() => undefined}
              handleUpdateWidgetList={() => undefined}
              handleAddCustomWidget={() => undefined}
              router={initialData.router}
              location={initialData.router.location}
              widgetLimitReached={false}
            />
          </MEPSettingProvider>
        </OrganizationContext.Provider>
      );
    };

    it('dashboard displays issue widgets if the user has issue widgets feature flag', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [newWidget, issueWidget],
      };

      mount(mockDashboardWithIssueWidget, organization);
      expect(await screen.findByText('Test Discover Widget')).toBeInTheDocument();
      expect(screen.getByText('Test Issue Widget')).toBeInTheDocument();
    });

    it('renders suggested assignees', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [{...issueWidget}],
      };
      mount(mockDashboardWithIssueWidget, organization);
      expect(await screen.findByText('T')).toBeInTheDocument();
      await userEvent.hover(screen.getByText('T'));
      expect(await screen.findByText('Suggestion: test@sentry.io')).toBeInTheDocument();
      expect(screen.getByText('Matching Issue Owners Rule')).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    let widgets: Widget[];
    const mount = (
      dashboard,
      mockedOrg = initialData.organization,
      mockedRouter = initialData.router,
      mockedLocation = initialData.router.location
    ) => {
      const getDashboardComponent = () => (
        <OrganizationContext.Provider value={initialData.organization}>
          <MEPSettingProvider forceTransactions={false}>
            <Dashboard
              paramDashboardId="1"
              dashboard={dashboard}
              organization={mockedOrg}
              isEditing
              onUpdate={newWidgets => {
                widgets.splice(0, widgets.length, ...newWidgets);
              }}
              handleUpdateWidgetList={() => undefined}
              handleAddCustomWidget={() => undefined}
              router={mockedRouter}
              location={mockedLocation}
              widgetLimitReached={false}
            />
          </MEPSettingProvider>
        </OrganizationContext.Provider>
      );
      const {rerender} = render(getDashboardComponent());
      return {rerender: () => rerender(getDashboardComponent())};
    };

    beforeEach(() => {
      widgets = [newWidget];
    });

    it('displays the copy widget button in edit mode', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};

      mount(dashboardWithOneWidget);
      expect(await screen.findByLabelText('Duplicate Widget')).toBeInTheDocument();
    });

    it('duplicates the widget', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};
      const {rerender} = mount(dashboardWithOneWidget);

      await userEvent.click(await screen.findByLabelText('Duplicate Widget'));
      rerender();

      await waitFor(() => {
        expect(screen.getAllByText('Test Discover Widget')).toHaveLength(2);
      });
    });

    it('opens the widget builder when editing with the modal access flag', async function () {
      const testData = initializeOrg({
        organization: {
          features: ['dashboards-basic', 'dashboards-edit'],
        },
      });
      const dashboardWithOneWidget = {
        ...mockDashboard,
        widgets: [newWidget],
      };

      mount(
        dashboardWithOneWidget,
        testData.organization,
        testData.router,
        testData.router.location
      );

      await userEvent.click(await screen.findByLabelText('Edit Widget'));

      expect(testData.router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/dashboard/1/widget/0/edit/',
        })
      );
    });
  });
});
