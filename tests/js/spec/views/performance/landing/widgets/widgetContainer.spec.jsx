import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData} from 'sentry-test/performance/initializePerformanceData';

import {PerformanceDisplayProvider} from 'app/utils/performance/contexts/performanceDisplayContext';
import {OrganizationContext} from 'app/views/organizationContext';
import WidgetContainer from 'app/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'app/views/performance/landing/widgets/widgetDefinitions';
import {PROJECT_PERFORMANCE_TYPE} from 'app/views/performance/utils';

const WrappedComponent = ({data, ...rest}) => {
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <OrganizationContext.Provider value={data.organization}>
        <WidgetContainer
          {...data}
          {...rest}
          allowedCharts={[
            PerformanceWidgetSetting.TPM_AREA,
            PerformanceWidgetSetting.FAILURE_RATE_AREA,
            PerformanceWidgetSetting.USER_MISERY_AREA,
          ]}
          forceDefaultChartSetting
        />
      </OrganizationContext.Provider>
    </PerformanceDisplayProvider>
  );
};

describe('Performance > Widgets > WidgetContainer', function () {
  let eventStatsMock;
  let eventsV2Mock;
  let eventsTrendsStats;
  beforeEach(function () {
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: [],
    });
    eventsV2Mock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/eventsv2/`,
      body: [],
    });
    eventsTrendsStats = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trends-stats/',
      body: [],
    });
  });

  it('TPM Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Transactions Per Minute'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
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
          statsPeriod: '28d',
          yAxis: 'tpm()',
        }),
      })
    );
  });

  it('Failure Rate Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure Rate'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
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
          statsPeriod: '28d',
          yAxis: 'failure_rate()',
        }),
      })
    );
  });

  it('User misery Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'User Misery'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
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
          statsPeriod: '28d',
          yAxis: 'user_misery()',
        }),
      })
    );
  });

  it('Worst LCP widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_LCP_VITALS}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Worst LCP Web Vitals'
    );
    expect(wrapper.find('a[data-test-id="view-all-button"]').text()).toEqual('View All');
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: [
            'transaction',
            'title',
            'project.id',
            'count_if(measurements.lcp,greaterOrEquals,4000)',
            'count_if(measurements.lcp,greaterOrEquals,2500)',
            'count_if(measurements.lcp,greaterOrEquals,0)',
            'equation|count_if(measurements.lcp,greaterOrEquals,2500) - count_if(measurements.lcp,greaterOrEquals,4000)',
            'equation|count_if(measurements.lcp,greaterOrEquals,0) - count_if(measurements.lcp,greaterOrEquals,2500)',
          ],
          per_page: 3,
          project: [],
          query: '',
          sort: '-count_if(measurements.lcp,greaterOrEquals,4000)',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('LCP Histogram Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.LCP_HISTOGRAM}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'LCP Distribution'
    );

    // TODO(k-fish): Add histogram mock
  });

  it('FCP Histogram Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FCP_HISTOGRAM}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'FCP Distribution'
    );

    // TODO(k-fish): Add histogram mock
  });

  it('Most errors widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ERRORS}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Related Errors'
    );
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['transaction', 'project.id', 'failure_count()'],
          per_page: 3,
          project: [],
          query: '',
          sort: '-failure_count()',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('Most related issues widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ISSUES}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Related Issues'
    );
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['issue', 'transaction', 'title', 'project.id', 'count()'],
          per_page: 3,
          project: [],
          query: 'event.type:error !tags[transaction]:""',
          sort: '-count()',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('Most improved trends widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Improved'
    );
    expect(eventsTrendsStats).toHaveBeenCalledTimes(1);
    expect(eventsTrendsStats).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['transaction', 'project'],
          interval: undefined,
          middle: undefined,
          per_page: 3,
          project: [],
          query:
            'tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: 'trend_percentage()',
          statsPeriod: '14d',
          trendFunction: 'avg(transaction.duration)',
          trendType: 'improved',
        }),
      })
    );
  });

  it('Most regressed trends widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_REGRESSED}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Regressed'
    );
    expect(eventsTrendsStats).toHaveBeenCalledTimes(1);
    expect(eventsTrendsStats).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['transaction', 'project'],
          interval: undefined,
          middle: undefined,
          per_page: 3,
          project: [],
          query:
            'tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: '-trend_percentage()',
          statsPeriod: '14d',
          trendFunction: 'avg(transaction.duration)',
          trendType: 'regression',
        }),
      })
    );
  });

  it('Most slow frames widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_SLOW_FRAMES}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Slow Frames'
    );

    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: [
            'transaction',
            'project.id',
            'epm()',
            'p75(measurements.frames_slow_rate)',
          ],
          per_page: 3,
          project: [],
          query: 'epm():>0.01 p75(measurements.frames_slow_rate):>0',
          sort: '-p75(measurements.frames_slow_rate)',
          statsPeriod: '14d',
        }),
      })
    );

    expect(wrapper.find('div[data-test-id="empty-message"]').exists()).toBe(true);
  });

  it('Able to change widget type from menu', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure Rate'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    wrapper.find('IconEllipsis[data-test-id="context-menu"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('MenuItem').at(2).text()).toEqual('User Misery');
    wrapper.find('MenuItem').at(2).simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'User Misery'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(2);
  });
});
