import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatTimeSeriesResultsToChartData} from 'sentry/views/insights/browser/webVitals/components/charts/formatTimeSeriesResultsToChartData';
import PerformanceScoreBreakdownChartWidget from 'sentry/views/insights/common/components/widgets/performanceScoreBreakdownChartWidget';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('PerformanceScoreBreakdownChartWidget', function () {
  const organization = OrganizationFixture();
  let eventsStatsMock: jest.Mock;

  beforeEach(function () {
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
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        'performance_score(measurements.score.lcp)': {
          data: [[1743348600, [{count: 0.6106921965623204}]]],
        },
        'performance_score(measurements.score.fcp)': {
          data: [[1743435000, [{count: 0.7397871866098699}]]],
        },
      },
    });
  });

  afterEach(function () {
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
      '/organizations/org-slug/events-stats/',
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

  describe('formatTimeSeriesResultsToChartData', function () {
    it('formats time series results using provided order', function () {
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
