import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import Dashboard from 'sentry/views/dashboards/dashboard';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

import WidgetLegendSelectionState from './widgetLegendSelectionState';

jest.mock('sentry/components/lazyRender', () => ({
  LazyRender: ({children}: {children: React.ReactNode}) => children,
}));

describe('Dashboards > Dashboard', () => {
  const organization = OrganizationFixture({
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

  const widgetLegendState = new WidgetLegendSelectionState({
    organization,
    dashboard: mockDashboard,
    navigate: jest.fn(),
    location: LocationFixture(),
  });

  let initialData: ReturnType<typeof initializeOrg>;
  let tagsMock: jest.Mock;

  beforeEach(() => {
    initialData = initializeOrg({organization, projects: []});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/widgets/`,
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/stats/`,
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
          assignedTo: {
            email: 'test@sentry.io',
            type: 'user',
            id: '1',
            name: 'Test User',
          },
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
      body: TagsFixture(),
    });
  });

  it('fetches tags', () => {
    render(
      <Dashboard
        dashboard={mockDashboard}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={() => undefined}
        widgetLimitReached={false}
        isEditingDashboard={false}
        widgetLegendState={widgetLegendState}
      />
    );
    expect(tagsMock).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component is mounted with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    render(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        newWidget={newWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    await waitFor(() => expect(mockHandleAddCustomWidget).toHaveBeenCalled());
    expect(mockCallbackToUnsetNewWidget).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component updated with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    const {rerender} = render(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    expect(mockCallbackToUnsetNewWidget).not.toHaveBeenCalled();

    // Re-render with newWidget prop
    rerender(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        newWidget={newWidget}
        widgetLegendState={widgetLegendState}
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
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    expect(mockCallbackToUnsetNewWidget).not.toHaveBeenCalled();
  });

  it('handles duplicate widget in view mode', async () => {
    const mockOnUpdate = jest.fn();
    const mockHandleUpdateWidgetList = jest.fn();

    const dashboardWithOneWidget = {
      ...mockDashboard,
      widgets: [
        WidgetFixture({
          id: '1',
          layout: {
            h: 1,
            w: 1,
            x: 0,
            y: 0,
            minH: 1,
          },
        }),
      ],
    };

    render(
      <OrganizationContext value={initialData.organization}>
        <MEPSettingProvider forceTransactions={false}>
          <Dashboard
            dashboard={dashboardWithOneWidget}
            isEditingDashboard={false}
            onUpdate={mockOnUpdate}
            handleUpdateWidgetList={mockHandleUpdateWidgetList}
            handleAddCustomWidget={() => undefined}
            widgetLimitReached={false}
            onSetNewWidget={() => undefined}
            widgetLegendState={widgetLegendState}
          />
        </MEPSettingProvider>
      </OrganizationContext>
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(await screen.findByText('Duplicate Widget'));

    // The new widget is inserted after the duplicated widget
    const expectedWidgets = [
      // Duplicated Widget
      expect.objectContaining(
        WidgetFixture({
          id: '1',
          layout: expect.objectContaining({h: 1, w: 1, x: 0, y: 0, minH: 1}),
        })
      ),
      // New Widget is appended at the end
      expect.objectContaining(
        WidgetFixture({
          id: undefined,
          layout: expect.objectContaining({h: 1, w: 1, x: 0, y: 1, minH: 1}),
        })
      ),
    ];

    expect(mockHandleUpdateWidgetList).toHaveBeenCalledWith(expectedWidgets);
    expect(mockOnUpdate).toHaveBeenCalledWith(expectedWidgets);
  });

  it('hides widget context menu when dashboard is embedded', async () => {
    const dashboardWithOneWidget = {
      ...mockDashboard,
      widgets: [
        WidgetFixture({
          id: '1',
          title: 'Test Widget',
          layout: {
            h: 1,
            w: 1,
            x: 0,
            y: 0,
            minH: 1,
          },
        }),
      ],
    };

    render(
      <OrganizationContext value={initialData.organization}>
        <MEPSettingProvider forceTransactions={false}>
          <Dashboard
            dashboard={dashboardWithOneWidget}
            isEditingDashboard={false}
            onUpdate={() => undefined}
            handleUpdateWidgetList={() => undefined}
            handleAddCustomWidget={() => undefined}
            widgetLimitReached={false}
            isEmbedded
            widgetLegendState={widgetLegendState}
          />
        </MEPSettingProvider>
      </OrganizationContext>
    );

    await screen.findByText('Test Widget');
    expect(screen.queryByLabelText('Widget actions')).not.toBeInTheDocument();
  });

  describe('Issue Widgets', () => {
    beforeEach(() => {
      MemberListStore.init();
    });

    const mount = (dashboard: DashboardDetails) => {
      render(
        <OrganizationContext value={initialData.organization}>
          <MEPSettingProvider forceTransactions={false}>
            <Dashboard
              dashboard={dashboard}
              isEditingDashboard={false}
              onUpdate={() => undefined}
              handleUpdateWidgetList={() => undefined}
              handleAddCustomWidget={() => undefined}
              widgetLimitReached={false}
              widgetLegendState={widgetLegendState}
            />
          </MEPSettingProvider>
        </OrganizationContext>
      );
    };

    it('dashboard displays issue widgets if the user has issue widgets feature flag', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [newWidget, issueWidget],
      };

      mount(mockDashboardWithIssueWidget);
      expect(await screen.findByText('Test Discover Widget')).toBeInTheDocument();
      expect(screen.getByText('Test Issue Widget')).toBeInTheDocument();
    });

    it('renders assignee', async () => {
      MemberListStore.loadInitialData([
        UserFixture({
          name: 'Test User',
          email: 'test@sentry.io',
          avatar: {
            avatarType: 'letter_avatar',
            avatarUuid: null,
          },
        }),
      ]);
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [{...issueWidget}],
      };
      mount(mockDashboardWithIssueWidget);
      expect(await screen.findByTitle('Test User')).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    let widgets: Widget[];
    const mount = ({dashboard, isPreview = false, onEditWidget = jest.fn()}: any) => {
      const getDashboardComponent = () => (
        <OrganizationContext value={initialData.organization}>
          <MEPSettingProvider forceTransactions={false}>
            <Dashboard
              dashboard={dashboard}
              isEditingDashboard
              onUpdate={newWidgets => {
                widgets.splice(0, widgets.length, ...newWidgets);
              }}
              handleUpdateWidgetList={() => undefined}
              handleAddCustomWidget={() => undefined}
              widgetLimitReached={false}
              isPreview={isPreview}
              onEditWidget={onEditWidget}
              widgetLegendState={widgetLegendState}
            />
          </MEPSettingProvider>
        </OrganizationContext>
      );
      const {rerender} = render(getDashboardComponent());
      return {rerender: () => rerender(getDashboardComponent())};
    };

    beforeEach(() => {
      widgets = [newWidget];
    });

    it('displays the copy widget button in edit mode', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};

      mount({dashboard: dashboardWithOneWidget});
      expect(await screen.findByLabelText('Duplicate Widget')).toBeInTheDocument();
    });

    it('duplicates the widget', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};
      const {rerender} = mount({dashboard: dashboardWithOneWidget});

      await userEvent.click(await screen.findByLabelText('Duplicate Widget'));
      rerender();

      await waitFor(() => {
        expect(screen.getAllByText('Test Discover Widget')).toHaveLength(2);
      });
    });

    it('triggers the edit widget callback', async () => {
      const testData = initializeOrg({
        organization: {
          features: ['dashboards-basic', 'dashboards-edit'],
        },
      });
      const dashboardWithOneWidget = {
        ...mockDashboard,
        widgets: [newWidget],
      };
      const mockOnEditWidget = jest.fn();

      mount({
        dashboard: dashboardWithOneWidget,
        org: testData.organization,
        location: testData.router.location,
        onEditWidget: mockOnEditWidget,
      });

      await userEvent.click(await screen.findByLabelText('Edit Widget'));

      await waitFor(() => {
        expect(mockOnEditWidget).toHaveBeenCalled();
      });
    });

    it('does not show the add widget button if dashboard is in preview mode', async () => {
      const testData = initializeOrg({
        organization: {
          features: ['dashboards-basic', 'dashboards-edit'],
        },
      });
      const dashboardWithOneWidget = {
        ...mockDashboard,
        widgets: [newWidget],
      };

      mount({
        dashboard: dashboardWithOneWidget,
        org: testData.organization,
        isPreview: true,
      });

      await screen.findByText('Test Discover Widget');

      expect(screen.queryByRole('button', {name: /add widget/i})).not.toBeInTheDocument();
    });
  });
});
