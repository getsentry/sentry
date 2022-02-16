import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';

import {TransactionMetric} from 'sentry/utils/metrics/fields';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {OrganizationContext} from 'sentry/views/organizationContext';
import WidgetContainer from 'sentry/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {MetricsSwitchContext} from 'sentry/views/performance/metricsSwitch';
import {PROJECT_PERFORMANCE_TYPE} from 'sentry/views/performance/utils';

const initializeData = (query = {}) => {
  const data = _initializeData({
    query: {statsPeriod: '7d', environment: ['prod'], project: [-42], ...query},
  });

  data.eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return data;
};

const WrappedComponent = ({data, isMetricsData = false, ...rest}) => {
  return (
    <MetricsSwitchContext.Provider value={{isMetricsData}}>
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
    </MetricsSwitchContext.Provider>
  );
};

const issuesPredicate = (url, options) =>
  url.includes('eventsv2') && options.query?.query.includes('error');

describe('Performance > Widgets > WidgetContainer', function () {
  let wrapper;

  let eventStatsMock;
  let eventsV2Mock;
  let metricsMock;
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
            'count_if(measurements.lcp,greaterOrEquals,4000)',
            'count_if(measurements.lcp,greaterOrEquals,2500)',
            'count_if(measurements.lcp,greaterOrEquals,0)',
            'equation|count_if(measurements.lcp,greaterOrEquals,2500) - count_if(measurements.lcp,greaterOrEquals,4000)',
            'equation|count_if(measurements.lcp,greaterOrEquals,0) - count_if(measurements.lcp,greaterOrEquals,2500)',
          ],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_if(measurements.lcp,greaterOrEquals,4000)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst LCP widget - metrics based', async function () {
    const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`;

    metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({
        field,
      }),
      match: [(...args) => !issuesPredicate(...args)],
    });
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_LCP_VITALS}
        isMetricsData
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Worst LCP Web Vitals'
    );

    expect(wrapper.find('a[data-test-id="view-all-button"]').text()).toEqual('View All');
    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction'],
          interval: '1h',
          per_page: 3,
          orderBy: `-${field}`,
          query: 'measurement_rating:poor',
          project: [-42],
          statsPeriod: '7d',
        }),
      })
    );
    expect(metricsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction', 'measurement_rating'],
          interval: '1h',
          project: [-42],
          query: 'transaction:[/bar/:ordId/,/foo/:ordId/]',
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
            'count_if(measurements.fcp,greaterOrEquals,3000)',
            'count_if(measurements.fcp,greaterOrEquals,1000)',
            'count_if(measurements.fcp,greaterOrEquals,0)',
            'equation|count_if(measurements.fcp,greaterOrEquals,1000) - count_if(measurements.fcp,greaterOrEquals,3000)',
            'equation|count_if(measurements.fcp,greaterOrEquals,0) - count_if(measurements.fcp,greaterOrEquals,1000)',
          ],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_if(measurements.fcp,greaterOrEquals,3000)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst FCP widget - metrics based', async function () {
    const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP})`;

    metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({
        field,
      }),
      match: [(...args) => !issuesPredicate(...args)],
    });
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_FCP_VITALS}
        isMetricsData
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Worst FCP Web Vitals'
    );

    expect(wrapper.find('a[data-test-id="view-all-button"]').text()).toEqual('View All');
    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],

          field: [field],
          groupBy: ['transaction'],
          interval: '1h',
          per_page: 3,
          orderBy: `-${field}`,
          query: 'measurement_rating:poor',
          project: [-42],
          statsPeriod: '7d',
        }),
      })
    );
    expect(metricsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction', 'measurement_rating'],
          interval: '1h',
          project: [-42],
          query: 'transaction:[/bar/:ordId/,/foo/:ordId/]',
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
            'count_if(measurements.fid,greaterOrEquals,300)',
            'count_if(measurements.fid,greaterOrEquals,100)',
            'count_if(measurements.fid,greaterOrEquals,0)',
            'equation|count_if(measurements.fid,greaterOrEquals,100) - count_if(measurements.fid,greaterOrEquals,300)',
            'equation|count_if(measurements.fid,greaterOrEquals,0) - count_if(measurements.fid,greaterOrEquals,100)',
          ],
          per_page: 3,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_if(measurements.fid,greaterOrEquals,300)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst FID widget - metrics based', async function () {
    const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID})`;

    metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({
        field,
      }),
      match: [(...args) => !issuesPredicate(...args)],
    });
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_FID_VITALS}
        isMetricsData
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Worst FID Web Vitals'
    );

    expect(wrapper.find('a[data-test-id="view-all-button"]').text()).toEqual('View All');
    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction'],
          interval: '1h',
          per_page: 3,
          orderBy: `-${field}`,
          query: 'measurement_rating:poor',
          project: [-42],
          statsPeriod: '7d',
        }),
      })
    );
    expect(metricsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction', 'measurement_rating'],
          interval: '1h',
          project: [-42],
          query: 'transaction:[/bar/:ordId/,/foo/:ordId/]',
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

  describe('Single Area Widget - metrics based', function () {
    const data = initializeData();

    it('P50 Duration', async function () {
      const field = `p50(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.P50_DURATION_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'p50 Duration'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('534ms');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });

    it('P75 Duration', async function () {
      const field = `p75(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.P75_DURATION_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'p75 Duration'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('534ms');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });

    it('P95 Duration', async function () {
      const field = `p95(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.P95_DURATION_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'p95 Duration'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('534ms');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });

    it('P95 Duration - with null values', async function () {
      const field = `p95(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      const metricsData = TestStubs.MetricsField({field});
      metricsData.groups[0].series[field][0] = null;
      metricsData.groups[0].series[field][1] = null;

      MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: metricsData,
        match: [(...args) => !issuesPredicate(...args)],
      });

      const previousData = TestStubs.MetricsField({field});
      previousData.groups[0].series[field][0] = null;
      previousData.groups[0].series[field][1] = null;

      MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: previousData,
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.P95_DURATION_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('HighlightNumber').text()).toEqual('536ms');
    });

    it('P99 Duration', async function () {
      const field = `p99(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.P99_DURATION_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'p99 Duration'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('534ms');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });

    it('P75 LCP', async function () {
      const field = `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.P75_LCP_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'p75 LCP'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('534ms');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });

    it('TPM', async function () {
      const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsField({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'Transactions Per Minute'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('534.302');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });

    it('Failure Rate', async function () {
      const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

      metricsMock = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsFieldByTransactionStatus({field}),
        match: [(...args) => !issuesPredicate(...args)],
      });

      const metricsMockPreviousData = MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics/data/`,
        body: TestStubs.MetricsFieldByTransactionStatus({field}),
        match: [
          (...args) => {
            return (
              !issuesPredicate(...args) &&
              args[1].query.statsPeriodStart &&
              args[1].query.statsPeriodEnd
            );
          },
        ],
      });

      wrapper = mountWithTheme(
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
          isMetricsData
        />,
        data.routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
        'Failure Rate'
      );

      expect(wrapper.find('HighlightNumber').text()).toEqual('39%');
      expect(metricsMock).toHaveBeenCalledTimes(1);
      expect(metricsMockPreviousData).toHaveBeenCalledTimes(1);

      expect(metricsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            groupBy: ['transaction.status'],
            interval: '1h',
            statsPeriod: '7d',
          }),
        })
      );
      expect(metricsMockPreviousData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [-42],
            environment: ['prod'],
            field: [field],
            groupBy: ['transaction.status'],
            interval: '1h',
            statsPeriodStart: '14d',
            statsPeriodEnd: '7d',
          }),
        })
      );
    });
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

  it('Most slow frames widget - metrics based', async function () {
    const field = `avg(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW})`;

    metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({field}),
      match: [(...args) => !issuesPredicate(...args)],
    });

    const previousMetricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({field}),
      match: [
        (...args) => {
          return (
            !issuesPredicate(...args) &&
            args[1].query.statsPeriodStart &&
            args[1].query.statsPeriodEnd
          );
        },
      ],
    });
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_SLOW_FRAMES}
        isMetricsData
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Slow Frames'
    );

    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(previousMetricsMock).toHaveBeenCalledTimes(1);
    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction'],
          interval: '1h',
          per_page: 3,
          orderBy: `-${field}`,
          project: [-42],
          statsPeriod: '7d',
        }),
      })
    );
    expect(metricsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          interval: '1h',
          project: [-42],
          query: 'transaction:/bar/:ordId/',
          statsPeriod: '7d',
        }),
      })
    );
    expect(previousMetricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          interval: '1h',
          project: [-42],
          query: 'transaction:/bar/:ordId/',
          statsPeriodEnd: '7d',
          statsPeriodStart: '14d',
        }),
      })
    );
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

  it('Most frozen frames widget - metrics based', async function () {
    const field = `avg(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN})`;

    metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({field}),
      match: [(...args) => !issuesPredicate(...args)],
    });

    const previousMetricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransaction({field}),
      match: [
        (...args) => {
          return (
            !issuesPredicate(...args) &&
            args[1].query.statsPeriodStart &&
            args[1].query.statsPeriodEnd
          );
        },
      ],
    });
    const data = initializeData();

    wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_FROZEN_FRAMES}
        isMetricsData
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Frozen Frames'
    );

    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(previousMetricsMock).toHaveBeenCalledTimes(1);
    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          groupBy: ['transaction'],
          interval: '1h',
          per_page: 3,
          orderBy: `-${field}`,
          project: [-42],
          statsPeriod: '7d',
        }),
      })
    );
    expect(metricsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          interval: '1h',
          project: [-42],
          query: 'transaction:/bar/:ordId/',
          statsPeriod: '7d',
        }),
      })
    );
    expect(previousMetricsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: [field],
          interval: '1h',
          project: [-42],
          query: 'transaction:/bar/:ordId/',
          statsPeriodEnd: '7d',
          statsPeriodStart: '14d',
        }),
      })
    );
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
