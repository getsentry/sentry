import {
  initializeData as _initializeData,
  initializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

const initializeData = (query = {}, rest: initializeDataSettings = {}) => {
  const data = _initializeData({
    query: {statsPeriod: '7d', environment: ['prod'], project: [-42], ...query},
    ...rest,
  });

  data.eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return data;
};

const WrappedComponent = ({data, withStaticFilters = false, ...rest}) => {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <MEPSettingProvider>
        <PerformanceDisplayProvider
          value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}
        >
          <WidgetContainer
            allowedCharts={[
              PerformanceWidgetSetting.TPM_AREA,
              PerformanceWidgetSetting.FAILURE_RATE_AREA,
              PerformanceWidgetSetting.USER_MISERY_AREA,
              PerformanceWidgetSetting.DURATION_HISTOGRAM,
            ]}
            rowChartSettings={[]}
            withStaticFilters={withStaticFilters}
            forceDefaultChartSetting
            {...data}
            {...rest}
          />
        </PerformanceDisplayProvider>
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
};

const issuesPredicate = (url, options) =>
  url.includes('eventsv2') && options.query?.query.includes('error');

describe('Performance > Widgets > WidgetContainer', function () {
  let wrapper;

  let eventStatsMock;
  let eventsV2Mock;
  let eventsTrendsStats;
  let eventsMock;

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

    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{}],
        meta: {},
      },
    });
  });

  afterEach(function () {
    if (wrapper) {
      wrapper.unmount();
      wrapper = undefined;
    }
  });

  it('Check requests when changing widget props', function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />
    );

    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    // Change eventView reference
    data.eventView = data.eventView.clone();

    wrapper.rerender(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />
    );

    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    // Change eventView statsperiod
    const modifiedData = initializeData({
      statsPeriod: '14d',
    });

    wrapper.rerender(
      <WrappedComponent
        data={modifiedData}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />
    );

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

  it('Check requests when changing widget props for GenericDiscoverQuery based widget', function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
      />
    );

    expect(eventsTrendsStats).toHaveBeenCalledTimes(1);

    // Change eventView reference
    data.eventView = data.eventView.clone();

    wrapper.rerender(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
      />
    );

    expect(eventsTrendsStats).toHaveBeenCalledTimes(1);

    // Change eventView statsperiod
    const modifiedData = initializeData({
      statsPeriod: '14d',
    });

    wrapper.rerender(
      <WrappedComponent
        data={modifiedData}
        defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
      />
    );

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

    wrapper = render(
      <PageErrorProvider>
        <PageErrorAlert />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        />
      </PageErrorProvider>
    );

    // Provider update is after request promise.
    await act(async () => {});

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Transactions Per Minute'
    );

    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    expect(await screen.findByTestId('page-error-alert')).toHaveTextContent(
      'Request did not work :('
    );
  });

  it('TPM Widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

  it('Widget with MEP enabled and metric meta set to true', async function () {
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
        isMetricsData: true,
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{}],
        meta: {isMetricsData: true},
      },
    });

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />
    );

    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metrics'}),
      })
    );

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metrics'}),
      })
    );

    expect(await screen.findByTestId('has-metrics-data-tag')).toHaveTextContent(
      'processed'
    );
  });

  it('Widget with MEP enabled and metric meta set to undefined', async function () {
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
        isMetricsData: undefined,
      },
    });

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />
    );

    expect(await screen.findByTestId('no-metrics-data-tag')).toBeInTheDocument();
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metrics'}),
      })
    );
  });

  it('Widget with MEP enabled and metric meta set to false', async function () {
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
        isMetricsData: false,
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{}],
        meta: {isMetricsData: false},
      },
    });

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />
    );

    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metrics'}),
      })
    );

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metrics'}),
      })
    );

    expect(await screen.findByTestId('has-metrics-data-tag')).toHaveTextContent(
      'indexed'
    );
  });

  it('User misery Widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_LCP_VITALS}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Worst LCP Web Vitals'
    );
    expect(await screen.findByTestId('view-all-button')).toHaveTextContent('View All');

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
          per_page: 4,
          project: ['-42'],
          query: 'transaction.op:pageload',
          sort: '-count_web_vitals(measurements.lcp, poor)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst LCP widget - MEP', async function () {
    const data = initializeData(
      {},
      {
        features: ['performance-use-metrics'],
      }
    );

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_LCP_VITALS}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Worst LCP Web Vitals'
    );
    expect(await screen.findByTestId('view-all-button')).toHaveTextContent('View All');

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
          per_page: 4,
          project: ['-42'],
          query: 'transaction.op:pageload !transaction:"<< unparameterized >>"',
          sort: '-count_web_vitals(measurements.lcp, poor)',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Worst FCP widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_FCP_VITALS}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Worst FCP Web Vitals'
    );
    expect(await screen.findByTestId('view-all-button')).toHaveTextContent('View All');

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
          per_page: 4,
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.WORST_FID_VITALS}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Worst FID Web Vitals'
    );
    expect(await screen.findByTestId('view-all-button')).toHaveTextContent('View All');
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
          per_page: 4,
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.LCP_HISTOGRAM}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'LCP Distribution'
    );

    // TODO(k-fish): Add histogram mock
  });

  it('FCP Histogram Widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FCP_HISTOGRAM}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'FCP Distribution'
    );

    // TODO(k-fish): Add histogram mock
  });

  it('Most errors widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ERRORS}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ISSUES}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ISSUES}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Most Related Issues'
    );
    expect(issuesListMock).toHaveBeenCalledTimes(1);

    wrapper.rerender(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ERRORS}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Most Related Errors'
    );
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
  });

  it('Most improved trends widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_REGRESSED}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_SLOW_FRAMES}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    expect(await screen.findByTestId('empty-message')).toBeInTheDocument();
  });

  it('Most slow frames widget - MEP', async function () {
    const data = initializeData(
      {},
      {
        features: ['performance-use-metrics'],
      }
    );

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_SLOW_FRAMES}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    expect(await screen.findByTestId('empty-message')).toBeInTheDocument();
  });

  it('Most frozen frames widget', async function () {
    const data = initializeData();

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_FROZEN_FRAMES}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
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

    expect(await screen.findByTestId('empty-message')).toBeInTheDocument();
  });

  it('Able to change widget type from menu', async function () {
    const data = initializeData();

    const setRowChartSettings = jest.fn(() => {});

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        setRowChartSettings={setRowChartSettings}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Failure Rate'
    );

    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(setRowChartSettings).toHaveBeenCalledTimes(0);

    userEvent.click(await screen.findByLabelText('More'));
    userEvent.click(await screen.findByText('User Misery'));

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'User Misery'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(2);
    expect(setRowChartSettings).toHaveBeenCalledTimes(1);
  });

  it('Chart settings passed from the row are disabled in the menu', async function () {
    const data = initializeData();

    const setRowChartSettings = jest.fn(() => {});

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        setRowChartSettings={setRowChartSettings}
        rowChartSettings={[
          PerformanceWidgetSetting.FAILURE_RATE_AREA,
          PerformanceWidgetSetting.USER_MISERY_AREA,
        ]}
      />
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Failure Rate'
    );

    // Open context menu
    userEvent.click(await screen.findByLabelText('More'));

    // Check that the the "User Misery" option is disabled by clicking on it,
    // expecting that the selected option doesn't change
    const userMiseryOption = await screen.findByTestId('user_misery_area');
    userEvent.click(userMiseryOption);
    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Failure Rate'
    );
  });
});
