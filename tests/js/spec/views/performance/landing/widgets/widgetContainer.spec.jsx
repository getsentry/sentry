import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act} from 'sentry-test/reactTestingLibrary';

import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {OrganizationContext} from 'sentry/views/organizationContext';
import WidgetContainer from 'sentry/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {PROJECT_PERFORMANCE_TYPE} from 'sentry/views/performance/utils';

const initializeData = (query = {}, rest = {}) => {
  const data = _initializeData({
    query: {statsPeriod: '7d', environment: ['prod'], project: [-42], ...query},
    ...rest,
  });

  data.eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return data;
};

const WrappedComponent = ({data, isMEPEnabled = false, ...rest}) => {
  return (
    <MEPSettingProvider _isMEPEnabled={isMEPEnabled}>
      <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
        <OrganizationContext.Provider value={data.organization}>
          <WidgetContainer
            allowedCharts={[
              PerformanceWidgetSetting.TPM_AREA,
              PerformanceWidgetSetting.FAILURE_RATE_AREA,
              PerformanceWidgetSetting.USER_MISERY_AREA,
              PerformanceWidgetSetting.DURATION_HISTOGRAM,
            ]}
            rowChartSettings={[]}
            forceDefaultChartSetting
            {...data}
            {...rest}
          />
        </OrganizationContext.Provider>
      </PerformanceDisplayProvider>
    </MEPSettingProvider>
  );
};

const issuesPredicate = (url, options) =>
  url.includes('eventsv2') && options.query?.query.includes('error');

describe('Performance > Widgets > WidgetContainer', function () {
  let wrapper;

  let eventStatsMock;
  let eventsV2Mock;
  let eventsTrendsStats;

  let issuesListMock;

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
      match: [(...args) => !issuesPredicate(...args)],
    });
    issuesListMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/eventsv2/`,
      body: {
        data: [
          {
            'issue.id': 123,
            transaction: '/issue/:id/',
            title: 'Error: Something is broken.',
            'project.id': 1,
            count: 3100,
            issue: 'JAVASCRIPT-ABCD',
          },
        ],
      },
      match: [(...args) => issuesPredicate(...args)],
    });

    eventsTrendsStats = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events-trends-stats/',
      body: [],
    });
  });

  afterEach(function () {
    if (wrapper) {
      wrapper.unmount();
      wrapper = undefined;
    }
  });

  it('Check requests when changing widget props', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    // Change eventView reference
    wrapper.setProps({
      eventView: data.eventView.clone(),
    });

    await tick();
    wrapper.update();

    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    const modifiedData = initializeData({
      statsPeriod: '14d',
    });

    // Change eventView statsperiod
    wrapper.setProps({
      eventView: modifiedData.eventView,
    });

    await tick();
    wrapper.update();

    expect(eventStatsMock).toHaveBeenCalledTimes(2);

    expect(eventStatsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          interval: '1h',
          partial: '1',
          query: 'transaction.op:pageload',
          statsPeriod: '28d',
          yAxis: 'tpm()',
        }),
      })
    );
  });

  it('Check requests when changing widget props for GenericDiscoverQuery based widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(eventsTrendsStats).toHaveBeenCalledTimes(1);

    // Change eventView reference
    wrapper.setProps({
      eventView: data.eventView.clone(),
    });

    await tick();
    wrapper.update();

    expect(eventsTrendsStats).toHaveBeenCalledTimes(1);

    const modifiedData = initializeData({
      statsPeriod: '14d',
    });

    // Change eventView statsperiod
    wrapper.setProps({
      eventView: modifiedData.eventView,
    });

    await tick();
    wrapper.update();

    expect(eventsTrendsStats).toHaveBeenCalledTimes(2);

    expect(eventsTrendsStats).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: '0:0:1',
          environment: ['prod'],
          field: ['transaction', 'project'],
          interval: undefined,
          middle: undefined,
          noPagination: true,
          per_page: 3,
          project: ['-42'],
          query:
            'transaction.op:pageload tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: 'trend_percentage()',
          statsPeriod: '14d',
          trendFunction: 'avg(transaction.duration)',
          trendType: 'improved',
        }),
      })
    );
  });

  it('should call PageError Provider when errors are present', async function () {
    const data = initializeData();

    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      statusCode: 400,
      body: {
        detail: 'Request did not work :(',
      },
    });

    wrapper = mountWithTheme(
      <PageErrorProvider>
        <PageErrorAlert />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        />
      </PageErrorProvider>,
      data.routerContext
    );

    // Provider update is after request promise.
    await act(async () => {
      await tick();
      wrapper.update();
    });

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Transactions Per Minute'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('div[data-test-id="page-error-alert"]').text()).toEqual(
      'Request did not work :('
    );
  });

  it('TPM Widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          interval: '1h',
          partial: '1',
          query: 'transaction.op:pageload',
          statsPeriod: '14d',
          yAxis: 'tpm()',
        }),
      })
    );
  });

  it('Failure Rate Widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          interval: '1h',
          partial: '1',
          query: 'transaction.op:pageload',
          statsPeriod: '14d',
          yAxis: 'failure_rate()',
        }),
      })
    );
  });

  it('Failure Rate Widget with MEP', async function () {
    const data = initializeData(
      {},
      {
        features: ['performance-use-metrics'],
      }
    );

    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: {
        data: [],
        meta: {
          isMetricsData: true,
        },
      },
    });

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        isMEPEnabled
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure RateSampled'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          interval: '1h',
          partial: '1',
          query: 'transaction.op:pageload',
          statsPeriod: '14d',
          yAxis: 'failure_rate()',
        }),
      })
    );

    expect(wrapper.find('span[data-test-id="has-metrics-data-tag"]').text()).toEqual(
      'Sampled'
    );
  });

  it('User misery Widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          interval: '1h',
          partial: '1',
          query: 'transaction.op:pageload',
          statsPeriod: '14d',
          yAxis: 'user_misery()',
        }),
      })
    );
  });

  it('Worst LCP widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          environment: ['prod'],
          field: [
            'transaction',
            'title',
            'project.id',
            'count_web_vitals(measurements.lcp, poor)',
            'count_web_vitals(measurements.lcp, meh)',
            'count_web_vitals(measurements.lcp, good)',
          ],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_web_vitals(measurements.lcp, poor)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst FCP widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_FCP_VITALS}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Worst FCP Web Vitals'
    );
    expect(wrapper.find('a[data-test-id="view-all-button"]').text()).toEqual('View All');
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [
            'transaction',
            'title',
            'project.id',
            'count_web_vitals(measurements.fcp, poor)',
            'count_web_vitals(measurements.fcp, meh)',
            'count_web_vitals(measurements.fcp, good)',
          ],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_web_vitals(measurements.fcp, poor)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst FID widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_FID_VITALS}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Worst FID Web Vitals'
    );
    expect(wrapper.find('a[data-test-id="view-all-button"]').text()).toEqual('View All');
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [
            'transaction',
            'title',
            'project.id',
            'count_web_vitals(measurements.fid, poor)',
            'count_web_vitals(measurements.fid, meh)',
            'count_web_vitals(measurements.fid, good)',
          ],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_web_vitals(measurements.fid, poor)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('LCP Histogram Widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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

    wrapper = mountWithTheme(
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

    wrapper = mountWithTheme(
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
          environment: ['prod'],
          field: ['transaction', 'project.id', 'failure_count()'],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload failure_count():>0',
          sort: '-failure_count()',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Most related issues widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
    expect(issuesListMock).toHaveBeenCalledTimes(1);
    expect(issuesListMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: ['issue', 'transaction', 'title', 'project.id', 'count()'],
          per_page: 3,
          project: ['-42'],
          query: 'event.type:error !tags[transaction]:"" count():>0',
          sort: '-count()',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Switching from issues to errors widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
    expect(issuesListMock).toHaveBeenCalledTimes(1);

    wrapper.setProps({
      defaultChartSetting: PerformanceWidgetSetting.MOST_RELATED_ERRORS,
    });

    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Related Errors'
    );
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
  });

  it('Most improved trends widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          environment: ['prod'],
          field: ['transaction', 'project'],
          interval: undefined,
          middle: undefined,
          per_page: 3,
          project: ['-42'],
          query:
            'transaction.op:pageload tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: 'trend_percentage()',
          statsPeriod: '7d',
          trendFunction: 'avg(transaction.duration)',
          trendType: 'improved',
        }),
      })
    );
  });

  it('Most regressed trends widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          environment: ['prod'],
          field: ['transaction', 'project'],
          interval: undefined,
          middle: undefined,
          per_page: 3,
          project: ['-42'],
          query:
            'transaction.op:pageload tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: '-trend_percentage()',
          statsPeriod: '7d',
          trendFunction: 'avg(transaction.duration)',
          trendType: 'regression',
        }),
      })
    );
  });

  it('Most slow frames widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
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
          cursor: '0:0:1',
          environment: ['prod'],
          field: ['transaction', 'project.id', 'epm()', 'avg(measurements.frames_slow)'],
          noPagination: true,
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload epm():>0.01 avg(measurements.frames_slow):>0',
          sort: '-avg(measurements.frames_slow)',
          statsPeriod: '7d',
        }),
      })
    );

    expect(wrapper.find('div[data-test-id="empty-message"]').exists()).toBe(true);
  });

  it('Most frozen frames widget', async function () {
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_FROZEN_FRAMES}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Frozen Frames'
    );

    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: '0:0:1',
          environment: ['prod'],
          field: [
            'transaction',
            'project.id',
            'epm()',
            'avg(measurements.frames_frozen)',
          ],
          noPagination: true,
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload epm():>0.01 avg(measurements.frames_frozen):>0',
          sort: '-avg(measurements.frames_frozen)',
          statsPeriod: '7d',
        }),
      })
    );

    expect(wrapper.find('div[data-test-id="empty-message"]').exists()).toBe(true);
  });

  it('Able to change widget type from menu', async function () {
    const data = initializeData();

    const setRowChartSettings = jest.fn(() => {});

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        setRowChartSettings={setRowChartSettings}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure Rate'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(setRowChartSettings).toHaveBeenCalledTimes(0);

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
    expect(setRowChartSettings).toHaveBeenCalledTimes(1);
  });

  it('Chart settings passed from the row are disabled in the menu', async function () {
    const data = initializeData();

    const setRowChartSettings = jest.fn(() => {});

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        setRowChartSettings={setRowChartSettings}
        rowChartSettings={[
          PerformanceWidgetSetting.FAILURE_RATE_AREA,
          PerformanceWidgetSetting.USER_MISERY_AREA,
        ]}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure Rate'
    );

    wrapper.find('IconEllipsis[data-test-id="context-menu"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('MenuItem').at(1).text()).toEqual('Failure Rate');
    expect(wrapper.find('MenuItem').at(1).props().isActive).toBe(true);
    expect(wrapper.find('MenuItem').at(1).props().disabled).toBe(false);

    expect(wrapper.find('MenuItem').at(2).text()).toEqual('User Misery');
    expect(wrapper.find('MenuItem').at(2).props().disabled).toBe(true);
  });
});
