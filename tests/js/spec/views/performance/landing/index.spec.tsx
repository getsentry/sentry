import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData} from 'sentry-test/performance/initializePerformanceData';

import EventView from 'app/utils/discover/eventView';
import {OrganizationContext} from 'app/views/organizationContext';
import {PerformanceLanding} from 'app/views/performance/landing';
import {LandingDisplayField} from 'app/views/performance/landing/utils';

const WrappedComponent = ({data}) => {
  const eventView = EventView.fromLocation(data.router.location);

  return (
    <OrganizationContext.Provider value={data.organization}>
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
        eventView={eventView}
        projects={data.projects}
        shouldShowOnboarding={false}
        handleSearch={() => {}}
        handleTrendsClick={() => {}}
        setError={() => {}}
      />
    </OrganizationContext.Provider>
  );
};

describe('Performance > Landing > Index', function () {
  let eventStatsMock: any;
  let eventsV2Mock: any;
  beforeEach(function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
      body: [],
    });
    // @ts-expect-error
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-trends-stats/`,
      body: [],
    });
    // @ts-expect-error
    eventsV2Mock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/eventsv2/`,
      body: [],
    });
  });

  afterEach(function () {
    // @ts-expect-error
    MockApiClient.clearMockResponses();
  });

  it('renders basic UI elements', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-landing-v3"]').exists()).toBe(
      true
    );
  });

  it('renders frontend pageload view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD},
    });

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="frontend-pageload-view"]').exists()).toBe(
      true
    );

    expect(wrapper.find('Table')).toHaveLength(1);

    const titles = wrapper.find('div[data-test-id="performance-widget-title"]');
    expect(titles).toHaveLength(3);

    expect(titles.at(0).text()).toEqual('p75 LCP');
    expect(titles.at(1).text()).toEqual('LCP Distribution');
    expect(titles.at(2).text()).toEqual('FCP Distribution');
  });

  it('renders frontend other view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_OTHER},
    });

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);
  });

  it('renders backend view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.BACKEND},
    });

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);
  });

  it('renders mobile view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.MOBILE},
    });

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);
  });

  it('renders all transactions view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.ALL},
    });

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);

    expect(eventStatsMock).toHaveBeenCalledTimes(4); // Currently defaulting to 4 event stat charts on all transactions view + 1 event chart.
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);

    const titles = wrapper.find('div[data-test-id="performance-widget-title"]');
    expect(titles).toHaveLength(5);

    expect(titles.at(0).text()).toEqual('User Misery');
    expect(titles.at(1).text()).toEqual('Transactions Per Minute');
    expect(titles.at(2).text()).toEqual('Failure Rate');
    expect(titles.at(3).text()).toEqual('Transactions Per Minute');
    expect(titles.at(4).text()).toEqual('Most Related Errors');
  });
});
