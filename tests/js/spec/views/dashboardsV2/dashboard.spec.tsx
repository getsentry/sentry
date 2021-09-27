import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import Dashboard from 'app/views/dashboardsV2/dashboard';
import {DisplayType} from 'app/views/dashboardsV2/types';

describe('Dashboards > Dashboard', () => {
  // @ts-expect-error
  const organization = TestStubs.Organization({
    features: ['dashboards-basic', 'dashboards-edit'],
  });
  const mockDashboard = {
    dateCreated: '2021-08-10T21:20:46.798237Z',
    id: '1',
    title: 'Test Dashboard',
    widgets: [],
  };
  const newWidget = {
    title: 'Test Query',
    displayType: DisplayType.LINE,
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

  let initialData;

  beforeEach(() => {
    initialData = initializeOrg({organization, router: {}, project: 1, projects: []});
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/widgets/`,
      method: 'POST',
      body: [],
    });
  });
  it('dashboard adds new widget if component is mounted with newWidget prop', async () => {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={mock}
        onSetWidgetToBeUpdated={() => undefined}
        router={initialData.router}
        location={initialData.location}
        newWidget={newWidget}
      />,
      initialData.routerContext
    );
    // @ts-expect-error
    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component updated with newWidget prop', async () => {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Dashboard
        paramDashboardId="1"
        dashboard={mockDashboard}
        organization={initialData.organization}
        isEditing={false}
        onUpdate={mock}
        onSetWidgetToBeUpdated={() => undefined}
        router={initialData.router}
        location={initialData.location}
      />,
      initialData.routerContext
    );
    expect(mock).not.toHaveBeenCalled();
    wrapper.setProps({newWidget});
    // @ts-expect-error
    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalled();
  });
});
