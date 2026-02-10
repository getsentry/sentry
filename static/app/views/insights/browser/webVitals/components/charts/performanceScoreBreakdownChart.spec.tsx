import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useLocation} from 'sentry/utils/useLocation';
import {formatTimeSeriesResultsToChartData} from 'sentry/views/insights/browser/webVitals/components/charts/formatTimeSeriesResultsToChartData';
import PerformanceScoreBreakdownChartWidget from 'sentry/views/insights/common/components/widgets/performanceScoreBreakdownChartWidget';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/components/pageFilters/usePageFilters');

describe('PerformanceScoreBreakdownChartWidget', () => {
  const organization = OrganizationFixture();
  let eventsStatsMock: jest.Mock;

  beforeEach(() => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'performance_score(measurements.score.lcp)',
            values: [{timestamp: 1743348600000, value: 0.6106921965623204}],
          }),
          TimeSeriesFixture({
            yAxis: 'performance_score(measurements.score.fcp)',
            values: [{timestamp: 1743435000000, value: 0.7397871866098699}],
          }),
        ],
      },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PerformanceScoreBreakdownChartWidget />, {organization});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          yAxis: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.inp)',
            'performance_score(measurements.score.ttfb)',
            'count()',
          ],
        }),
      })
    );
  });

  describe('formatTimeSeriesResultsToChartData', () => {
    it('formats time series results using provided order', () => {
      const result = formatTimeSeriesResultsToChartData(
        {
          lcp: [],
          fcp: [],
          cls: [],
          ttfb: [],
          inp: [],
          total: [],
        },
        ['#444674', '#895289', '#d6567f', '#f38150', '#f2b712'],
        ['lcp', 'fcp', 'inp', 'cls', 'ttfb']
      );
      expect(result).toEqual([
        {
          color: '#444674',
          data: [],
          seriesName: 'LCP',
        },
        {
          color: '#895289',
          data: [],
          seriesName: 'FCP',
        },
        {
          color: '#d6567f',
          data: [],
          seriesName: 'INP',
        },
        {
          color: '#f38150',
          data: [],
          seriesName: 'CLS',
        },
        {
          color: '#f2b712',
          data: [],
          seriesName: 'TTFB',
        },
      ]);
    });
  });
});
