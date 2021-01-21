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
  const tableWidget = {
    title: 'SDK',
    interval: '5m',
    displayType: 'table',
    queries: [{conditions: 'event.type:error', fields: ['sdk.name'], name: 'sdk'}],
  };
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
    },
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

  it('sets errorMessage when the first request fails', async function () {
    const okMock = MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/events-stats/',
        body: [],
      },
      {
        predicate(_url, options) {
          return options.query.query === 'event.type:error';
        },
      }
    );
    const failMock = MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/events-stats/',
        statusCode: 400,
        body: {detail: 'Bad request data'},
      },
      {
        predicate(_url, options) {
          return options.query.query === 'event.type:default';
        },
      }
    );

    let error = '';
    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {({errorMessage}) => {
          error = errorMessage;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      initialData.routerContext
    );
    await tick();
    await tick();

    // Child should be rendered and 2 requests should be sent.
    expect(wrapper.find('[data-test-id="child"]')).toHaveLength(1);
    expect(okMock).toHaveBeenCalledTimes(1);
    expect(failMock).toHaveBeenCalledTimes(1);
    expect(error).toEqual('Bad request data');
  });

  it('adjusts interval based on date window', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const widget = {...singleQueryWidget, interval: '1m'};

    const longSelection = {
      projects: [1],
      environments: ['prod'],
      datetime: {
        period: '90d',
      },
    };
    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={longSelection}
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
        query: expect.objectContaining({interval: '4h'}),
      })
    );
  });

  it('adjusts interval based on date window 14d', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
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

  it('can send table result queries', async function () {
    const tableMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
    });

    let childProps = undefined;
    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={tableWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      initialData.routerContext
    );
    await tick();
    await tick();

    // Child should be rendered and 2 requests should be sent.
    expect(wrapper.find('[data-test-id="child"]')).toHaveLength(1);
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(childProps.timeseriesResults).toBeUndefined();
    expect(childProps.tableResults[0].data).toHaveLength(1);
    expect(childProps.tableResults[0].meta).toBeDefined();
  });

  it('can send multiple table queries', async function () {
    const firstQuery = MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {'sdk.name': 'string'},
          data: [{'sdk.name': 'python'}],
        },
      },
      {
        predicate(_url, options) {
          return options.query.query === 'event.type:error';
        },
      }
    );
    const secondQuery = MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        body: {
          meta: {title: 'string'},
          data: [{title: 'ValueError'}],
        },
      },
      {
        predicate(_url, options) {
          return options.query.query === 'title:ValueError';
        },
      }
    );

    const widget = {
      title: 'SDK',
      interval: '5m',
      displayType: 'table',
      queries: [
        {conditions: 'event.type:error', fields: ['sdk.name'], name: 'sdk'},
        {conditions: 'title:ValueError', fields: ['title'], name: 'title'},
      ],
    };

    let childProps = undefined;
    const wrapper = mountWithTheme(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      initialData.routerContext
    );
    await tick();
    await tick();

    // Child should be rendered and 2 requests should be sent.
    expect(wrapper.find('[data-test-id="child"]')).toHaveLength(1);
    expect(firstQuery).toHaveBeenCalledTimes(1);
    expect(secondQuery).toHaveBeenCalledTimes(1);

    expect(childProps.tableResults).toHaveLength(2);
    expect(childProps.tableResults[0].data[0]['sdk.name']).toBeDefined();
    expect(childProps.tableResults[1].data[0].title).toBeDefined();
  });
});
