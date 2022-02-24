import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import EventView from 'sentry/utils/discover/eventView';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {PerformanceLanding} from 'sentry/views/performance/landing';
import {REACT_NATIVE_COLUMN_TITLES} from 'sentry/views/performance/landing/data';
import * as utils from 'sentry/views/performance/landing/utils';
import {LandingDisplayField} from 'sentry/views/performance/landing/utils';

const WrappedComponent = ({data}) => {
  const eventView = EventView.fromLocation(data.router.location);

  return (
    <OrganizationContext.Provider value={data.organization}>
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
        eventView={eventView}
        projects={data.projects}
        selection={eventView.getPageFilters()}
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
  let wrapper: any;

  act(() => void TeamStore.loadInitialData([], false, null));
  beforeEach(function () {
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
      body: [],
    });
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-trends-stats/`,
      body: [],
    });
    eventsV2Mock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/eventsv2/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();

    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error.mockRestore();

    if (wrapper) {
      wrapper.unmount();
      wrapper = undefined;
    }
  });

  it('renders basic UI elements', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
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

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="frontend-pageload-view"]').exists()).toBe(
      true
    );

    expect(wrapper.find('Table')).toHaveLength(1);

    const titles = wrapper.find('div[data-test-id="performance-widget-title"]');
    expect(titles).toHaveLength(5);

    expect(titles.at(0).text()).toEqual('p75 LCP');
    expect(titles.at(1).text()).toEqual('LCP Distribution');
    expect(titles.at(2).text()).toEqual('FCP Distribution');
    expect(titles.at(3).text()).toEqual('Worst LCP Web Vitals');
    expect(titles.at(4).text()).toEqual('Worst FCP Web Vitals');
  });

  it('renders frontend other view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_OTHER},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);
  });

  it('renders backend view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.BACKEND},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);
  });

  it('renders mobile view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.MOBILE},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);
  });

  it('renders react-native table headers in mobile view', async function () {
    jest.spyOn(utils, 'checkIsReactNative').mockReturnValueOnce(true);
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.MOBILE},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    const table = wrapper.find('Table');
    expect(table.exists()).toBe(true);
    expect(table.props().columnTitles).toEqual(REACT_NATIVE_COLUMN_TITLES);
  });

  it('renders all transactions view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.ALL},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('Table').exists()).toBe(true);

    expect(eventStatsMock).toHaveBeenCalledTimes(1); // Only one request is made since the query batcher is working.

    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          interval: '1h',
          partial: '1',
          project: [],
          query: '',
          referrer: 'api.organization-event-stats',
          statsPeriod: '28d',
          yAxis: ['user_misery()', 'tpm()', 'failure_rate()'],
        }),
      })
    );

    expect(eventsV2Mock).toHaveBeenCalledTimes(1);

    const titles = wrapper.find('div[data-test-id="performance-widget-title"]');
    expect(titles).toHaveLength(5);

    expect(titles.at(0).text()).toEqual('User Misery');
    expect(titles.at(1).text()).toEqual('Transactions Per Minute');
    expect(titles.at(2).text()).toEqual('Failure Rate');
    expect(titles.at(3).text()).toEqual('Most Related Issues');
    expect(titles.at(4).text()).toEqual('Most Improved');
  });

  it('Can switch between landing displays', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD, abc: '123'},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="frontend-pageload-view"]').exists()).toBe(
      true
    );

    wrapper.find('a[data-test-id="landing-tab-all"]').simulate('click');
    await tick();
    wrapper.update();

    expect(browserHistory.push).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pathname: data.location.pathname,
        query: {query: '', abc: '123'},
      })
    );
  });

  it('Updating projects switches performance view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD},
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="frontend-pageload-view"]').exists()).toBe(
      true
    );

    const updatedData = initializeData({
      projects: [TestStubs.Project({id: 123, platform: 'unknown'})],
      project: 123 as any,
    });

    wrapper.setProps({
      data: updatedData,
    } as any);
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="all-transactions-view"]').exists()).toBe(true);
  });

  it('View correctly defaults based on project without url param', async function () {
    const data = initializeData({
      projects: [TestStubs.Project({id: 99, platform: 'javascript-react'})],
      project: 99 as any,
    });

    wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="frontend-pageload-view"]').exists()).toBe(
      true
    );
  });
});
