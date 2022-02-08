import {act} from 'react-dom/test-utils';

import {selectDropdownMenuItem} from 'sentry-test/dropdownMenu';
import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';
import {triggerPress} from 'sentry-test/utils';

import DashboardList from 'sentry/views/dashboardsV2/manage/dashboardList';

describe('Dashboards > DashboardList', function () {
  let dashboards, widgets, deleteMock, dashboardUpdateMock, createMock;
  const organization = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
    projects: [TestStubs.Project()],
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    widgets = [
      TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          title: 'Errors',
          interval: '1d',
          id: '1',
        }
      ),
      TestStubs.Widget(
        [{name: '', conditions: 'event.type:transaction', fields: ['count()']}],
        {
          title: 'Transactions',
          interval: '1d',
          id: '2',
        }
      ),
      TestStubs.Widget(
        [
          {
            name: '',
            conditions: 'event.type:transaction transaction:/api/cats',
            fields: ['p50()'],
          },
        ],
        {
          title: 'p50 of /api/cats',
          interval: '1d',
          id: '3',
        }
      ),
    ];
    dashboards = [
      TestStubs.Dashboard([], {
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetDisplay: [],
      }),
      TestStubs.Dashboard(widgets, {
        id: '2',
        title: 'Dashboard 2',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetDisplay: ['line', 'table'],
      }),
    ];
    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/',
      method: 'DELETE',
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/',
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        title: 'Dashboard Demo',
        widgets: [
          {
            id: '1',
            title: 'Errors',
            displayType: 'big_number',
            interval: '5m',
          },
          {
            id: '2',
            title: 'Transactions',
            displayType: 'big_number',
            interval: '5m',
          },
          {
            id: '3',
            title: 'p50 of /api/cat',
            displayType: 'big_number',
            interval: '5m',
          },
        ],
      },
    });
    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      statusCode: 200,
    });
    dashboardUpdateMock = jest.fn();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders an empty list', function () {
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={[]}
        pageLinks=""
        location={{query: {}}}
      />
    );
    const content = wrapper.find('DashboardCard');
    // No dashboards
    expect(content).toHaveLength(0);
    expect(wrapper.find('EmptyStateWarning')).toHaveLength(1);
  });

  it('renders dashboard list', function () {
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{query: {}}}
      />
    );
    const content = wrapper.find('DashboardCard');
    expect(content).toHaveLength(2);
  });

  it('returns landing page url for dashboards', function () {
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{query: {}}}
      />
    );
    const card = wrapper.find('DashboardCard').last();
    const link = card.find('Link').last().prop('to');
    expect(link.pathname).toEqual(`/organizations/org-slug/dashboard/2/`);
  });

  it('persists global selection headers', function () {
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{query: {statsPeriod: '7d'}}}
      />
    );
    const card = wrapper.find('DashboardCard').last();
    const link = card.find('Link').last().prop('to');
    expect(link.pathname).toEqual(`/organizations/org-slug/dashboard/2/`);
    expect(link.query).toEqual({statsPeriod: '7d'});
  });

  it('can delete dashboards', async function () {
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );
    const card = wrapper.find('DashboardCard').last();
    expect(card.find('Title').text()).toEqual(dashboards[1].title);

    await selectDropdownMenuItem({
      wrapper,
      specifiers: {prefix: 'DashboardCard', last: true},
      itemKey: 'dashboard-delete',
    });

    expect(deleteMock).not.toHaveBeenCalled();

    // Confirm
    const modal = await mountGlobalModal();
    modal.find('Button').last().simulate('click');

    await tick();

    expect(deleteMock).toHaveBeenCalled();
    expect(dashboardUpdateMock).toHaveBeenCalled();
  });

  it('cannot delete last dashboard', async function () {
    const singleDashboard = [
      TestStubs.Dashboard([], {
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetDisplay: [],
      }),
    ];
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={singleDashboard}
        pageLinks=""
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );
    let card = wrapper.find('DashboardCard').last();
    expect(card.find('Title').text()).toEqual(singleDashboard[0].title);

    await act(async () => {
      triggerPress(card.find('DropdownTrigger'));

      await tick();
      wrapper.update();
    });

    card = wrapper.find('DashboardCard').last();
    const dashboardDelete = card.find(`MenuItemWrap[data-test-id="dashboard-delete"]`);
    expect(dashboardDelete.prop('isDisabled')).toBe(true);
  });

  it('can duplicate dashboards', async function () {
    const wrapper = mountWithTheme(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );
    const card = wrapper.find('DashboardCard').last();
    expect(card.find('Title').text()).toEqual(dashboards[1].title);

    await selectDropdownMenuItem({
      wrapper,
      specifiers: {prefix: 'DashboardCard', last: true},
      itemKey: 'dashboard-duplicate',
    });

    expect(createMock).toHaveBeenCalled();
    expect(dashboardUpdateMock).toHaveBeenCalled();
  });
});
