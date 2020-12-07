import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import WidgetQueries from 'app/views/dashboardsV2/widgetQueries';

describe('Dashboards > WidgetQueries', function () {
  const initialData = initializeOrg({
    organization: TestStubs.Organization(),
  });

  const multipleQueryWidget = {
    title: 'Errors',
    interval: '5m',
    displayType: 'line',
    queries: [
      {conditions: 'event.type:error', fields: ['count()'], name: 'errors'},
      {conditions: 'event.type:default', fields: ['count()'], name: 'default'},
    ],
  };
  const singleQueryWidget = {
    title: 'Errors',
    interval: '5m',
    displayType: 'line',
    queries: [{conditions: 'event.type:error', fields: ['count()'], name: 'errors'}],
  };

  const api = new Client();

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('can send multiple API requests', async function () {
    const errorMock = MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/events-stats/',
        body: [],
      },
      {
        predicate(_url, options) {
          return (
            options.query.query === 'event.type:error' ||
            options.query.query === 'event.type:default'
          );
        },
      }
    );
    const selection = {
      projects: [1],
      environments: ['prod'],
      datetime: {
        period: '14d',
      },
    };

    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      initialData.routerContext
    );
    await tick();
    await tick();

    // Child should be rendered and 2 requests should be sent.
    expect(wrapper.find('[data-test-id="child"]')).toHaveLength(1);
    expect(errorMock).toHaveBeenCalledTimes(2);
  });

  it('adjusts interval based on date window', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const selection = {
      projects: [1],
      environments: ['prod'],
      datetime: {
        period: '90d',
      },
    };
    const widget = {...singleQueryWidget, interval: '1m'};

    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      initialData.routerContext
    );
    await tick();

    // Child should be rendered and interval bumped up.
    expect(wrapper.find('[data-test-id="child"]')).toHaveLength(1);
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({interval: '1h'}),
      })
    );
  });

  it('adjusts interval based on date window 14d', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const selection = {
      projects: [1],
      environments: ['prod'],
      datetime: {
        period: '14d',
      },
    };
    const widget = {...singleQueryWidget, interval: '1m'};

    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      initialData.routerContext
    );
    await tick();

    // Child should be rendered and interval bumped up.
    expect(wrapper.find('[data-test-id="child"]')).toHaveLength(1);
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({interval: '30m'}),
      })
    );
  });
});
