import {withRouter, browserHistory} from 'react-router';
import React from 'react';

import OrganizationEvents, {parseRowFromLinks} from 'app/views/organizationEvents/events';
import {chart, doZoom} from 'app-test/helpers/charts';
import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {mockRouterPush} from 'app-test/helpers/mockRouterPush';
import {mount} from 'enzyme';
import OrganizationEventsContainer from 'app/views/organizationEvents';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('app/utils/withLatestContext');

const pageOneLinks =
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

const pageTwoLinks =
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", ' +
  '<https://sentry.io/api/0/organizations/sentry/events/?statsPeriod=14d&cursor=0:200:0>; rel="next"; results="false"; cursor="0:200:0"';

const OrganizationEventsWithRouter = withRouter(OrganizationEvents);

describe('OrganizationEventsErrors', function() {
  const {organization, router, routerContext} = initializeOrg({
    projects: [{isMember: true}, {isMember: true, slug: 'new-project', id: 3}],
    organization: {
      features: ['events'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
    },
  });

  let eventsMock;
  let eventsStatsMock;
  let eventsMetaMock;

  beforeAll(function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
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
        return TestStubs.EventsStats(opts.query);
      },
    });
    eventsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
    });
  });

  it('renders with errors', async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      statusCode: 500,
      body: {details: 'Error'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      statusCode: 500,
      body: {details: 'Error'},
    });
    const wrapper = mount(
      <OrganizationEvents organization={organization} location={{query: {}}} />,
      routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('EventsChart')).toHaveLength(1);
    expect(wrapper.find('EventsTable')).toHaveLength(1);
    expect(wrapper.find('RouteError')).toHaveLength(1);
  });

  it('renders events table', async function() {
    const wrapper = mount(
      <OrganizationEvents organization={organization} location={{query: {}}} />,
      routerContext
    );
    await tick();
    wrapper.update();
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMetaMock).not.toHaveBeenCalled();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(wrapper.find('IdBadge')).toHaveLength(2);
  });

  it('renders TotalEventCount with internal flag', async function() {
    const newOrg = TestStubs.Organization({
      ...organization,
      features: [...organization.features, 'internal-catchall'],
    });
    const wrapper = mount(
      <OrganizationEvents organization={newOrg} location={{query: {}}} />,
      {...routerContext, context: {...routerContext.context, organization: newOrg}}
    );
    await tick();
    wrapper.update();
    expect(eventsMetaMock).toHaveBeenCalled();
    expect(wrapper.find('Feature').text()).toEqual(' of 5 (estimated)');
  });

  // This tests the component's `shouldComponentUpdate`
  // Use `search` to compare instead of `query` because that's what we check in `AsyncComponent`
  it('location.query changes updates events table', async function() {
    const wrapper = mount(
      <OrganizationEventsWithRouter
        organization={organization}
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

    const location = {
      query: {
        start: '2017-10-01T04:00:00',
        end: '2017-10-02T03:59:59',
      },
      search: '?start=2017-10-01T04:00:00&end=2017-10-02T03:59:59',
    };

    wrapper.setContext({
      router: {
        ...router,
        location,
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
    let chartRender;
    let tableRender;
    let wrapper;
    let newParams;

    beforeEach(function() {
      const newLocation = {
        ...router.location,
        query: {
          ...router.location.query,
        },
      };

      const newRouter = {
        ...router,
        location: newLocation,
      };

      const newRouterContext = {
        ...routerContext,
        context: {
          ...routerContext.context,
          router: newRouter,
          location: newLocation,
        },
      };

      wrapper = mount(
        <OrganizationEventsContainer
          router={newRouter}
          organization={organization}
          location={newRouter.location}
        >
          <OrganizationEventsWithRouter
            location={newRouter.location}
            organization={organization}
          />
        </OrganizationEventsContainer>,
        newRouterContext
      );
      mockRouterPush(wrapper, router);

      // XXX: Note this spy happens AFTER initial render!
      tableRender = jest.spyOn(wrapper.find('EventsTable').instance(), 'render');
    });

    afterAll(function() {
      if (chartRender) {
        chartRender.mockRestore();
      }

      tableRender.mockRestore();
    });

    it('zooms using chart', async function() {
      expect(tableRender).toHaveBeenCalledTimes(0);

      await tick();
      wrapper.update();

      chartRender = jest.spyOn(wrapper.find('LineChart').instance(), 'render');

      doZoom(wrapper.find('EventsChart').first(), chart);
      await tick();
      wrapper.update();

      // After zooming, line chart should re-render once, but table does
      expect(chartRender).toHaveBeenCalledTimes(1);
      expect(tableRender).toHaveBeenCalledTimes(3);

      newParams = {
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
        getUtcToLocalDateObject('2018-11-29T00:00:00')
      );
      expect(wrapper.find('TimeRangeSelector').prop('end')).toEqual(
        getUtcToLocalDateObject('2018-12-02T00:00:00')
      );
    });
  });
});

describe('OrganizationEventsContainer', function() {
  let wrapper;
  let eventsMock;
  let eventsStatsMock;
  let eventsMetaMock;

  const {organization, router, routerContext} = initializeOrg({
    projects: [
      {isMember: true, isBookmarked: true},
      {isMember: true, slug: 'new-project', id: 3},
    ],
    organization: {
      features: ['events', 'internal-catchall'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
    },
  });

  beforeAll(function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
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
        return TestStubs.EventsStats(opts.query);
      },
    });
    eventsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
    });

    wrapper = mount(
      <OrganizationEventsContainer
        router={router}
        organization={organization}
        location={router.location}
      >
        <OrganizationEventsWithRouter
          location={router.location}
          organization={organization}
        />
      </OrganizationEventsContainer>,
      routerContext
    );

    mockRouterPush(wrapper, router);
  });

  it('performs the correct queries when there is a search query', async function() {
    wrapper.find('SmartSearchBar input').simulate('change', {target: {value: 'http'}});
    wrapper.find('SmartSearchBar input').simulate('submit');

    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {query: 'http', statsPeriod: '14d'},
    });

    await tick();
    await tick();
    wrapper.update();

    expect(eventsMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: {query: 'http', statsPeriod: '14d'},
      })
    );

    // 28d because of previous period
    expect(eventsStatsMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({query: 'http', statsPeriod: '28d'}),
      })
    );

    expect(eventsMetaMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-meta/',
      expect.objectContaining({
        query: {query: 'http', statsPeriod: '14d'},
      })
    );
  });

  it('updates when changing projects', async function() {
    ProjectsStore.loadInitialData(organization.projects);

    expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([]);

    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    wrapper
      .find('MultipleProjectSelector AutoCompleteItem')
      .at(0)
      .simulate('click');

    await tick();
    wrapper.update();

    expect(eventsStatsMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({project: [2], statsPeriod: '28d'}),
      })
    );

    expect(eventsMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        // This is not an array because of `mockRouterPush`
        query: {project: '2', statsPeriod: '14d'},
      })
    );
  });

  it('handles direct event hit', async function() {
    const eventId = 'a'.repeat(32);

    browserHistory.replace = jest.fn();
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: (url, opts) => [
        TestStubs.OrganizationEvent({...opts.query, eventID: eventId}),
      ],
      headers: {'X-Sentry-Direct-Hit': '1'},
    });

    wrapper = mount(
      <OrganizationEvents organization={organization} location={{query: eventId}} />,
      routerContext
    );

    expect(eventsMock).toHaveBeenCalled();
    expect(browserHistory.replace).toHaveBeenCalledWith(
      `/organizations/org-slug/projects/project-slug/events/${eventId}/`
    );
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
