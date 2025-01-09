import type {InitializeDataSettings} from 'sentry-test/performance/initializePerformanceData';
import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {OrganizationContext} from 'sentry/views/organizationContext';
import WidgetContainer from 'sentry/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

import {QUERY_LIMIT_PARAM} from '../utils';

const initializeData = (query = {}, rest: InitializeDataSettings = {}) => {
  const data = _initializeData({
    query: {statsPeriod: '7d', environment: ['prod'], project: [-42], ...query},
    ...rest,
  });

  data.eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return data;
};

function WrappedComponent({data, withStaticFilters = false, ...rest}: any) {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <MetricsCardinalityProvider
        location={data.router.location}
        organization={data.organization}
      >
        <MEPSettingProvider forceTransactions>
          <PerformanceDisplayProvider
            value={{performanceType: ProjectPerformanceType.ANY}}
          >
            <WidgetContainer
              chartHeight={100}
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
      </MetricsCardinalityProvider>
    </OrganizationContext.Provider>
  );
}

const issuesPredicate = (url: string, options: any) =>
  url.includes('events') && options.query?.query.includes('error');

describe('Performance > Widgets > WidgetContainer', function () {
  let wrapper: ReturnType<typeof render> | undefined;

  let eventStatsMock: jest.Mock;
  let eventsTrendsStats: jest.Mock;
  let eventsMock: jest.Mock;

  let issuesListMock: jest.Mock;

  beforeEach(function () {
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: [],
    });
    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{}],
        meta: {},
      },
      match: [(...args) => !issuesPredicate(...args)],
    });
    issuesListMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
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

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics-compatibility/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics-compatibility-sums/`,
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

    wrapper = render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />
    );

    await waitFor(() => {
      expect(eventStatsMock).toHaveBeenCalledTimes(1);
    });

    // Change eventView reference
    data.eventView = data.eventView.clone();

    wrapper.rerender(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />
    );

    await waitFor(() => {
      expect(eventStatsMock).toHaveBeenCalledTimes(1);
    });

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

    await waitFor(() => {
      expect(eventStatsMock).toHaveBeenCalledTimes(2);
    });

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

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
        />
      </MEPSettingProvider>
    );

    await waitFor(() => {
      expect(eventsTrendsStats).toHaveBeenCalledTimes(1);
    });

    // Change eventView reference
    data.eventView = data.eventView.clone();

    wrapper.rerender(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
        />
      </MEPSettingProvider>
    );

    await waitFor(() => {
      expect(eventsTrendsStats).toHaveBeenCalledTimes(1);
    });

    // Change eventView statsperiod
    const modifiedData = initializeData({
      statsPeriod: '14d',
    });

    wrapper.rerender(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={modifiedData}
          defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
        />
      </MEPSettingProvider>
    );

    await waitFor(() => {
      expect(eventsTrendsStats).toHaveBeenCalledTimes(2);
    });

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
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query:
            'transaction.op:pageload tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: 'trend_percentage()',
          statsPeriod: '14d',
          trendFunction: 'p95(transaction.duration)',
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
      <PageAlertProvider>
        <PageAlert />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        />
      </PageAlertProvider>
    );

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

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
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

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
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

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
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
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
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
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: ['transaction', 'project.id', 'failure_count()'],
          per_page: QUERY_LIMIT_PARAM,
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
          per_page: QUERY_LIMIT_PARAM,
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
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
  });

  it('Most improved trends widget', async function () {
    const data = initializeData();

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.MOST_IMPROVED}
        />
      </MEPSettingProvider>
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
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query:
            'transaction.op:pageload tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: 'trend_percentage()',
          statsPeriod: '7d',
          trendFunction: 'p95(transaction.duration)',
          trendType: 'improved',
        }),
      })
    );
  });

  it('Most time spent in db queries widget', async function () {
    const data = initializeData();

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES}
        />
      </MEPSettingProvider>
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Most Time-Consuming Queries'
    );
    expect(await screen.findByRole('button', {name: 'View All'})).toHaveAttribute(
      'href',
      '/insights/backend/database/'
    );
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spansMetrics',
          environment: ['prod'],
          field: [
            'span.op',
            'span.group',
            'project.id',
            'span.description',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query: 'has:span.description span.module:db transaction.op:pageload',
          sort: '-time_spent_percentage()',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Most time consuming domains widget', async function () {
    const data = initializeData();

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS}
        />
      </MEPSettingProvider>
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Most Time-Consuming Domains'
    );
    expect(await screen.findByRole('button', {name: 'View All'})).toHaveAttribute(
      'href',
      '/insights/backend/http/'
    );
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spansMetrics',
          environment: ['prod'],
          field: [
            'project.id',
            'span.domain',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query: 'span.module:http',
          sort: '-time_spent_percentage()',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Most time consuming resources widget', async function () {
    const data = initializeData();

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES}
        />
      </MEPSettingProvider>
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Most Time-Consuming Assets'
    );
    expect(await screen.findByRole('button', {name: 'View All'})).toHaveAttribute(
      'href',
      '/insights/frontend/assets/'
    );
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spansMetrics',
          environment: ['prod'],
          field: [
            'span.description',
            'span.op',
            'project.id',
            'span.group',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query:
            '!span.description:browser-extension://* resource.render_blocking_status:blocking ( span.op:resource.script OR file_extension:css OR file_extension:[woff,woff2,ttf,otf,eot] OR file_extension:[jpg,jpeg,png,gif,svg,webp,apng,avif] OR span.op:resource.img ) transaction.op:pageload',
          sort: '-time_spent_percentage()',
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('Highest cache miss rate transactions widget', async function () {
    const data = initializeData();

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={
            PerformanceWidgetSetting.HIGHEST_CACHE_MISS_RATE_TRANSACTIONS
          }
        />
      </MEPSettingProvider>
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Highest Cache Miss Rates'
    );
    expect(await screen.findByRole('button', {name: 'View All'})).toHaveAttribute(
      'href',
      '/insights/backend/caches/'
    );
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: '0:0:1',
          dataset: 'spansMetrics',
          environment: ['prod'],
          field: ['transaction', 'project.id', 'cache_miss_rate()'],
          noPagination: true,
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query: 'span.op:[cache.get_item,cache.get]',
          statsPeriod: '7d',
          referrer:
            'api.performance.generic-widget-chart.highest-cache--miss-rate-transactions',
          sort: '-cache_miss_rate()',
        }),
      })
    );
  });

  it('Best Page Opportunities widget', async function () {
    const data = initializeData();

    wrapper = render(
      <MEPSettingProvider forceTransactions>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES}
        />
      </MEPSettingProvider>
    );

    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Best Page Opportunities'
    );
    expect(eventsMock).toHaveBeenCalledTimes(2);
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'metrics',
          field: [
            'project.id',
            'project',
            'transaction',
            'p75(measurements.lcp)',
            'p75(measurements.fcp)',
            'p75(measurements.cls)',
            'p75(measurements.ttfb)',
            'p75(measurements.inp)',
            'opportunity_score(measurements.score.total)',
            'performance_score(measurements.score.total)',
            'count()',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.inp)',
            'count_scores(measurements.score.ttfb)',
            'total_opportunity_score()',
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,""] !transaction:"<< unparameterized >>" avg(measurements.score.total):>=0',
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
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query:
            'transaction.op:pageload tpm():>0.01 count_percentage():>0.25 count_percentage():<4 trend_percentage():>0% confidence():>6',
          sort: '-trend_percentage()',
          statsPeriod: '7d',
          trendFunction: 'p95(transaction.duration)',
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

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: '0:0:1',
          environment: ['prod'],
          field: ['transaction', 'project.id', 'epm()', 'avg(measurements.frames_slow)'],
          noPagination: true,
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query: 'transaction.op:pageload epm():>0.01 avg(measurements.frames_slow):>0',
          sort: '-avg(measurements.frames_slow)',
          statsPeriod: '7d',
        }),
      })
    );

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
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

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: '0:0:1',
          environment: ['prod'],
          field: ['transaction', 'project.id', 'epm()', 'avg(measurements.frames_slow)'],
          noPagination: true,
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query: 'transaction.op:pageload epm():>0.01 avg(measurements.frames_slow):>0',
          sort: '-avg(measurements.frames_slow)',
          statsPeriod: '7d',
        }),
      })
    );

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
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

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
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
          per_page: QUERY_LIMIT_PARAM,
          project: ['-42'],
          query: 'transaction.op:pageload epm():>0.01 avg(measurements.frames_frozen):>0',
          sort: '-avg(measurements.frames_frozen)',
          statsPeriod: '7d',
        }),
      })
    );

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
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

    await userEvent.click(await screen.findByLabelText('More'));
    await userEvent.click(await screen.findByText('User Misery'));

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
    await userEvent.click(await screen.findByLabelText('More'));

    // Check that the "User Misery" option is disabled by clicking on it,
    // expecting that the selected option doesn't change
    const userMiseryOption = await screen.findByRole('option', {name: 'User Misery'});
    await userEvent.click(userMiseryOption);
    expect(await screen.findByTestId('performance-widget-title')).toHaveTextContent(
      'Failure Rate'
    );
  });
});
