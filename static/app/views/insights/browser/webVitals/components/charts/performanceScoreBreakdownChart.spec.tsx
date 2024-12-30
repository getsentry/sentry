import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  formatTimeSeriesResultsToChartData,
  PerformanceScoreBreakdownChart,
} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreBreakdownChart';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('PerformanceScoreBreakdownChart', function () {
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
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
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
    render(<PerformanceScoreBreakdownChart />, {organization});
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

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
