import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  formatTimeSeriesResultsToChartData,
  PerformanceScoreBreakdownChart,
} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('PerformanceScoreBreakdownChart', function () {
  const organization = OrganizationFixture();
  let eventsMock, eventsStatsMock;

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
    jest.mocked(useOrganization).mockReturnValue(organization);

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
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

  it('renders using frontend score calculation', async () => {
    render(<PerformanceScoreBreakdownChart />);
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          yAxis: [
            'p75(measurements.lcp)',
            'p75(measurements.fcp)',
            'p75(measurements.cls)',
            'p75(measurements.ttfb)',
            'p75(measurements.fid)',
            'count()',
          ],
        }),
      })
    );
  });

  it('renders using backend scores', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        useStoredScores: 'true',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PerformanceScoreBreakdownChart />);
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          field: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.fid)',
            'performance_score(measurements.score.ttfb)',
            'avg(measurements.score.total)',
            'avg(measurements.score.weight.lcp)',
            'avg(measurements.score.weight.fcp)',
            'avg(measurements.score.weight.cls)',
            'avg(measurements.score.weight.fid)',
            'avg(measurements.score.weight.ttfb)',
            'count()',
            'count_scores(measurements.score.total)',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.ttfb)',
            'count_scores(measurements.score.fid)',
          ],
        }),
      })
    );

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          yAxis: [
            'weighted_performance_score(measurements.score.lcp)',
            'weighted_performance_score(measurements.score.fcp)',
            'weighted_performance_score(measurements.score.cls)',
            'weighted_performance_score(measurements.score.fid)',
            'weighted_performance_score(measurements.score.inp)',
            'weighted_performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.fid)',
            'performance_score(measurements.score.inp)',
            'performance_score(measurements.score.ttfb)',
            'count()',
          ],
        }),
      })
    );
  });

  it('renders using backend scores and frontend scores to fill historic data', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {useStoredScores: 'true'},
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
          period: null,
          start: '2021-01-01T00:00:00',
          end: '2021-01-02T00:00:00',
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
    render(<PerformanceScoreBreakdownChart />);
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenCalledTimes(2);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          yAxis: [
            'p75(measurements.lcp)',
            'p75(measurements.fcp)',
            'p75(measurements.cls)',
            'p75(measurements.ttfb)',
            'p75(measurements.fid)',
            'count()',
          ],
        }),
      })
    );
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          yAxis: [
            'weighted_performance_score(measurements.score.lcp)',
            'weighted_performance_score(measurements.score.fcp)',
            'weighted_performance_score(measurements.score.cls)',
            'weighted_performance_score(measurements.score.fid)',
            'weighted_performance_score(measurements.score.inp)',
            'weighted_performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.fid)',
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
          fid: [],
          cls: [],
          ttfb: [],
          inp: [],
          total: [],
        },
        ['#444674', '#895289', '#d6567f', '#f38150', '#f2b712'],
        false,
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
