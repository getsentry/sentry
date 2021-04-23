import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import DashboardList from 'app/views/dashboardsV2/manage/dashboardList';

describe('Dashboards > DashboardList', function () {
  let dashboards, widgets;
  const organization = TestStubs.Organization({
    features: ['dashboards-manage'],
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
    expect(link.pathname).toEqual(`/organizations/org-slug/dashboards/2/`);
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
    expect(link.pathname).toEqual(`/organizations/org-slug/dashboards/2/`);
    expect(link.query).toEqual({statsPeriod: '7d'});
  });
});
