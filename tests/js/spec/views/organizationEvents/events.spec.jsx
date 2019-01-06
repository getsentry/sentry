import React from 'react';

import {EventsChart} from 'app/views/organizationEvents/eventsChart';
import {EventsTable} from 'app/views/organizationEvents/eventsTable';
import {OrganizationEvents, parseRowFromLinks} from 'app/views/organizationEvents/events';
import {chart, doZoom} from 'app-test/helpers/charts';
import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {getLocalDateObject} from 'app/utils/dates';
import {mockRouterPush} from 'app-test/helpers/mockRouterPush';
import {mount} from 'enzyme';
import OrganizationEventsContainer from 'app/views/organizationEvents';

jest.mock('app/utils/withLatestContext');

const pageOneLinks =
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

const pageTwoLinks =
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", ' +
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:200:0>; rel="next"; results="false"; cursor="0:200:0"';

describe('OrganizationEventsErrors', function() {
  const {organization, router, routerContext} = initializeOrg({
    projects: [{isMember: true}, {isMember: true, slug: 'new-project', id: 3}],
    organization: {
      features: ['global-views'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
    },
  });
  const org = organization;

  let eventsMock;
  let eventsStatsMock;
  let eventsMetaMock;

  beforeAll(function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/environments/`,
      body: TestStubs.Environments(),
    });
  });

  beforeEach(function() {
    // Search bar makes this request when mounted
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{count: 1, tag: 'transaction'}, {count: 2, tag: 'mechanism'}],
    });
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: (url, opts) => [TestStubs.OrganizationEvent(opts.query)],
      headers: {Link: pageOneLinks},
    });
    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: (url, opts) => {
        return TestStubs.HealthGraph(opts.query);
      },
    });
    eventsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
    });
  });

  it('renders with errors', async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/events/`,
      statusCode: 500,
      body: {details: 'Error'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/events-stats/`,
      statusCode: 500,
      body: {details: 'Error'},
    });
    let wrapper = mount(
      <OrganizationEvents organization={org} location={{query: {}}} />,
      routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('EventsChart')).toHaveLength(1);
    expect(wrapper.find('EventsTable')).toHaveLength(1);
    expect(wrapper.find('RouteError')).toHaveLength(1);
  });

  it('renders events table', async function() {
    let wrapper = mount(
      <OrganizationEvents organization={org} location={{query: {}}} />,
      routerContext
    );
    await tick();
    wrapper.update();
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMetaMock).toHaveBeenCalled();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(wrapper.find('IdBadge')).toHaveLength(2);
  });

  // This tests the component's `shouldComponentUpdate`
  // Use `search` to compare instead of `query` because that's what we check in `AsyncComponent`
  it('location.query changes updates events table', async function() {
    let wrapper = mount(
      <OrganizationEvents
        organization={org}
        location={{
          search: '?statsPeriod=14d',
          query: {
            statsPeriod: '14d',
          },
        }}
      />,
      routerContext
    );

    expect(eventsMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        query: {
          statsPeriod: '14d',
        },
      })
    );

    eventsMock.mockClear();

    wrapper.setProps({
      location: {
        query: {
          start: '2017-10-01T04:00:00',
          end: '2017-10-02T03:59:59',
        },
        search: '?start=2017-10-01T04:00:00&end=2017-10-02T03:59:59',
      },
    });
    wrapper.update();

    expect(eventsMock).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        query: {
          start: '2017-10-01T04:00:00',
          end: '2017-10-02T03:59:59',
        },
      })
    );
  });

  describe('Events Integration', function() {
    let chartRender = jest.spyOn(EventsChart.prototype, 'render');
    let tableRender = jest.spyOn(EventsTable.prototype, 'render');
    let wrapper;
    let newParams;

    beforeEach(function() {
      chartRender.mockClear();
      tableRender.mockClear();
      router.location.query.zoom = '1';

      wrapper = mount(
        <OrganizationEventsContainer
          router={router}
          organization={org}
          location={router.location}
        >
          <OrganizationEvents location={router.location} organization={org} />
        </OrganizationEventsContainer>,
        routerContext
      );
      mockRouterPush(wrapper, router);
    });

    it('renders', function() {
      expect(chartRender).toHaveBeenCalledTimes(1);
      expect(tableRender).toHaveBeenCalledTimes(1);
    });

    it('zooms using chart', async function() {
      expect(tableRender).toHaveBeenCalledTimes(1);
      expect(chartRender).toHaveBeenCalledTimes(1);

      await tick();
      wrapper.update();

      doZoom(wrapper.find('EventsChart').first(), chart);
      await tick();
      wrapper.update();

      // After zooming, chart should not re-render, but table does
      expect(chartRender).toHaveBeenCalledTimes(1);

      // Table should be in loading state
      expect(tableRender).toHaveBeenCalledTimes(2);
      expect(wrapper.find('EventsTable').prop('zoomChanged')).toBe(true);

      newParams = {
        zoom: '1',
        start: '2018-11-29T00:00:00',
        end: '2018-12-02T00:00:00',
      };

      expect(routerContext.context.router.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: newParams,
        })
      );

      wrapper.update();

      expect(wrapper.find('TimeRangeSelector').prop('start')).toEqual(
        getLocalDateObject('2018-11-29T00:00:00')
      );
      expect(wrapper.find('TimeRangeSelector').prop('end')).toEqual(
        getLocalDateObject('2018-12-02T00:00:00')
      );
    });
  });
});

describe('parseRowFromLinks', function() {
  it('calculates rows for first page', function() {
    expect(parseRowFromLinks(pageOneLinks, 10)).toBe('1-10');
    expect(parseRowFromLinks(pageOneLinks, 100)).toBe('1-100');
  });

  it('calculates rows for the second page', function() {
    expect(parseRowFromLinks(pageTwoLinks, 10)).toBe('101-110');
    expect(parseRowFromLinks(pageTwoLinks, 100)).toBe('101-200');
  });
});
