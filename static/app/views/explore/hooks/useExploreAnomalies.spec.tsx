import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import type {PageFilterDatetime} from 'sentry/types/core';
import type {AnomalyDataPoint} from 'sentry/utils/anomalyDetection/anomalyDetectionPayload';
import {getAnomalyDetectionDisabledReason} from 'sentry/utils/anomalyDetection/getAnomalyDetectionDisabledReason';
import {
  getAnomalyScoringPlan,
  getAnomalyScoringWarning,
  getIntervalMinutes,
  SEER_INTERVALS,
} from 'sentry/utils/anomalyDetection/getAnomalyScoringPlan';
import {getUtcDateString} from 'sentry/utils/dates';
import {getIntervalOptionsForPageFilter} from 'sentry/utils/useChartInterval';
import {AnomalyType} from 'sentry/views/alerts/types';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {
  getAnomalyAggregate,
  getAnomalyFetchDatetime,
  SETTLE_WAIT_MS,
  splitAnomalyDataPoints,
  timeSeriesToAnomalyDataPoints,
  useExploreAnomalies,
} from './useExploreAnomalies';

const organization = OrganizationFixture();
const DAY = 24 * 60;

function relative(period: string): PageFilterDatetime {
  return {period, start: null, end: null, utc: false};
}

describe('getAnomalyFetchDatetime', () => {
  it.each([
    // scored minutes + (Seer's history days + 1) * 1440
    ['1h', '5m', 60 + 8 * DAY],
    ['24h', '5m', DAY + 8 * DAY],
    ['24h', '30m', DAY + 22 * DAY],
    ['3d', '1h', 3 * DAY + 29 * DAY],
    ['7d', '3h', 7 * DAY + 29 * DAY],
    // Only the last 28 days are scored, so the fetch doesn't grow past that
    ['90d', '1d', 28 * DAY + 29 * DAY],
  ])('fetches %s at %s as %s minutes', (period, interval, minutes) => {
    const datetime = relative(period);
    expect(
      getAnomalyFetchDatetime(datetime, getAnomalyScoringPlan(datetime, interval))
    ).toEqual({period: `${minutes}m`, start: null, end: null, utc: false});
  });

  it('reaches back from the end of an absolute range', () => {
    const datetime = {
      period: null,
      start: '2026-11-01T00:00:00',
      end: '2026-11-03T00:00:00',
      utc: true,
    };
    expect(
      getAnomalyFetchDatetime(datetime, getAnomalyScoringPlan(datetime, '1h'))
    ).toEqual({
      period: null,
      start: '2026-10-03T00:00:00',
      end: '2026-11-03T00:00:00',
      utc: true,
    });
  });
});

describe('splitAnomalyDataPoints', () => {
  const points: AnomalyDataPoint[] = Array.from({length: 10}, (_, i) => [
    i * 300,
    {count: i},
  ]);

  it('scores the last stretch and uses the rest as history', () => {
    // A 15 minute chart at 5m is the last 3 points
    const plan = getAnomalyScoringPlan(relative('15m'), '5m');
    const {currentData, historicalData} = splitAnomalyDataPoints(points, plan);

    expect(currentData).toEqual(points.slice(7));
    expect(historicalData).toEqual(points.slice(0, 7));
  });

  it('leaves no history when the fetch only covers the chart', () => {
    const plan = getAnomalyScoringPlan(relative('24h'), '5m');
    const {currentData, historicalData} = splitAnomalyDataPoints(points, plan);

    expect(currentData).toEqual(points);
    expect(historicalData).toEqual([]);
  });
});

describe('every time range and interval', () => {
  const MAX_POINTS = 10_100; // MAX_ROLLUP_POINTS on the backend

  const relativeRanges = [
    '5m',
    '10m',
    '30m',
    '1h',
    '3h',
    '6h',
    '12h',
    '24h',
    '2d',
    '3d',
    '4d',
    '5d',
    '7d',
    '10d',
    '14d',
    '30d',
    '60d',
    '90d',
  ];
  const absoluteRanges: Array<[string, string]> = [
    ['2026-11-01T00:00:00', '2026-11-01T02:00:00'],
    ['2026-11-01T00:00:00', '2026-11-03T00:00:00'],
    ['2026-11-01T00:00:00', '2026-11-07T12:00:00'],
    ['2026-10-01T00:00:00', '2026-11-09T00:00:00'],
    ['2026-08-01T00:00:00', '2026-11-01T00:00:00'],
  ];
  const ranges: PageFilterDatetime[] = [
    ...relativeRanges.map(relative),
    ...absoluteRanges.map(([start, end]) => ({period: null, start, end, utc: true})),
  ];

  const cases = ranges.flatMap(datetime => {
    const options = getIntervalOptionsForPageFilter(datetime).map(o => o.value);
    // The interval picker adds 1d for ranges of two weeks or more
    if (getDiffInMinutes(datetime) >= 14 * DAY) {
      options.push('1d');
    }
    return options.map(interval => ({datetime, interval}));
  });

  it.each(cases)(
    '$datetime.period $datetime.start at $interval is scored safely',
    ({datetime, interval}) => {
      const chartMinutes = getDiffInMinutes(datetime);
      expect(
        getAnomalyDetectionDisabledReason({
          datetime,
          groupBys: [''],
          projects: [1],
          transformations: [],
          yAxisCount: 1,
        })
      ).toBeNull();

      const plan = getAnomalyScoringPlan(datetime, interval);
      const seerInterval = SEER_INTERVALS.find(i => i.minutes === plan.intervalMinutes);

      // Seer accepts the interval, and the scored stretch fits in one request,
      // so its flags line up with their timestamps
      expect(seerInterval).toBeDefined();
      expect(plan.historyDays).toBe(seerInterval!.days);
      expect(plan.scoredMinutes).toBeLessThanOrEqual(plan.historyDays * DAY);
      expect(plan.scoredMinutes).toBe(Math.min(chartMinutes, plan.historyDays * DAY));

      // Never coarser than the chart unless the range needs it
      if (
        !plan.isPartial &&
        plan.intervalMinutes > Math.max(5, getIntervalMinutes(interval))
      ) {
        const finer = SEER_INTERVALS.filter(i => i.minutes < plan.intervalMinutes);
        expect(finer.every(i => i.days * DAY < chartMinutes)).toBe(true);
      }

      // The fetch covers Seer's history before the scored stretch and stays
      // under the backend's point limit
      const fetch = getAnomalyFetchDatetime(datetime, plan);
      const fetchMinutes = getDiffInMinutes(fetch);
      expect(fetchMinutes - plan.scoredMinutes).toBe((plan.historyDays + 1) * DAY);
      expect(fetchMinutes / plan.intervalMinutes).toBeLessThanOrEqual(MAX_POINTS);
      if (datetime.end) {
        expect(fetch.end).toBe(getUtcDateString(moment.utc(datetime.end)));
      }

      // There's a warning exactly when the chart isn't scored as shown
      const warning = getAnomalyScoringWarning(plan, interval);
      expect(warning !== null).toBe(plan.isResampled || plan.isPartial);
    }
  );
});

describe('getAnomalyAggregate', () => {
  it.each([
    ['count()', 'count'],
    ['count(span.duration)', 'count'],
    ['count_unique(user)', 'other'],
    ['p95(span.duration)', 'other'],
  ])('maps %s to %s', (yAxis, expected) => {
    expect(getAnomalyAggregate(yAxis)).toBe(expected);
  });
});

describe('timeSeriesToAnomalyDataPoints', () => {
  it('converts to seconds, sorts, fills counts with 0 and drops incomplete buckets', () => {
    expect(
      timeSeriesToAnomalyDataPoints(
        [
          TimeSeriesFixture({
            values: [
              {timestamp: 2_000_000, value: null},
              {timestamp: 1_000_000, value: 4},
              {timestamp: 3_000_000, value: 9, incomplete: true},
            ],
          }),
        ],
        'count(span.duration)'
      )
    ).toEqual([
      [1000, {count: 4}],
      [2000, {count: 0}],
    ]);
  });

  it('carries the last value forward for functions where empty is not zero', () => {
    expect(
      timeSeriesToAnomalyDataPoints(
        [
          TimeSeriesFixture({
            values: [
              {timestamp: 1_000_000, value: null},
              {timestamp: 2_000_000, value: 120},
              {timestamp: 3_000_000, value: null},
              {timestamp: 4_000_000, value: 80},
            ],
          }),
        ],
        'p95(span.duration)'
      )
    ).toEqual([
      [2000, {count: 120}],
      [3000, {count: 120}],
      [4000, {count: 80}],
    ]);
  });
});

describe('useExploreAnomalies', () => {
  const visualize = new VisualizeFunction('count(span.duration)');

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {period: '24h', start: null, end: null, utc: false},
        projects: [2],
      })
    );
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('re-runs the chart query at the scoring interval without a group by', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [TimeSeriesFixture({yAxis: 'count(span.duration)'})],
        meta: {dataset: 'spans', start: 0, end: 0},
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useExploreAnomalies({
          enabled: true,
          extrapolate: true,
          isMainChartLoaded: true,
          query: 'span.op:db',
          queryExtras: {caseInsensitive: true},
          visualize,
        }),
      {organization}
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(result.current.plan.interval).toBe('5m');
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: `${DAY + 8 * DAY}m`,
          interval: '5m',
          yAxis: ['count(span.duration)'],
          groupBy: [],
          query: 'span.op:db',
          caseInsensitive: 1,
          project: [2],
        }),
      })
    );
    expect(request.mock.calls[0][1].query.topEvents).toBeUndefined();
  });

  it("applies the chart's fill but not its smoothing to the scored series", async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: [], meta: {dataset: 'spans', start: 0, end: 0}},
    });

    renderHookWithProviders(
      () =>
        useExploreAnomalies({
          enabled: true,
          extrapolate: true,
          isMainChartLoaded: true,
          query: '',
          visualize: new VisualizeFunction('p95(span.duration)', {
            transformations: ['fill(linear)', 'smooth(sma,3)'],
          }),
        }),
      {
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
      }
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(request.mock.calls[0][1].query['transformations[0]']).toEqual([
      'fill(linear)',
    ]);
  });

  it('scores a long, coarse chart at 1h over its last 28 days', async () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {period: '90d', start: null, end: null, utc: false},
        projects: [2],
      })
    );
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: [], meta: {dataset: 'spans', start: 0, end: 0}},
    });

    const {result} = renderHookWithProviders(
      () =>
        useExploreAnomalies({
          enabled: true,
          extrapolate: true,
          isMainChartLoaded: true,
          query: '',
          visualize,
        }),
      {organization}
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    // The chart defaults to 3h for 90 days
    expect(result.current.plan).toMatchObject({
      interval: '1h',
      isResampled: true,
      isPartial: true,
    });
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          interval: '1h',
          statsPeriod: `${28 * DAY + 29 * DAY}m`,
        }),
      })
    );
  });

  it.each([
    ['the toggle is off', {enabled: false, isMainChartLoaded: true}],
    ['the main chart is loading', {enabled: true, isMainChartLoaded: false}],
  ])('does not fetch when %s', (_, flags) => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: [], meta: {dataset: 'spans', start: 0, end: 0}},
    });

    renderHookWithProviders(
      () =>
        useExploreAnomalies({
          ...flags,
          extrapolate: true,
          query: '',
          visualize,
        }),
      {organization}
    );

    expect(request).not.toHaveBeenCalled();
  });

  describe('Seer call', () => {
    const MINUTE = 60_000;
    const NOW = 1_800_000_000_000;
    // The default 24h chart is scored at 5m: its last 288 points are scored and
    // the 20 before them are the history
    const SCORED = 288;
    const values = Array.from({length: SCORED + 20}, (_, i) => ({
      timestamp: NOW - (SCORED + 20 - i) * 5 * MINUTE,
      value: i,
    }));
    const historyValues = values.slice(0, 20);
    const currentValues = values.slice(20);

    function mockHistory() {
      return MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        body: {
          timeSeries: [TimeSeriesFixture({yAxis: 'count(span.duration)', values})],
          meta: {dataset: 'spans', start: 0, end: 0},
        },
      });
    }

    function mockSeer() {
      return MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/anomalies/`,
        method: 'POST',
        body: [{timestamp: 1, value: 2, anomaly: {}}],
      });
    }

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    const baseProps = {
      enabled: true,
      extrapolate: true,
      isMainChartLoaded: true,
      query: 'span.op:db',
      visualize,
    };

    it('sends the scored stretch, the history and the config', async () => {
      mockHistory();
      const seer = mockSeer();

      const {result} = renderHookWithProviders(() => useExploreAnomalies(baseProps), {
        organization,
      });

      act(() => jest.advanceTimersByTime(SETTLE_WAIT_MS));
      await waitFor(() => expect(result.current.anomalies).toHaveLength(1));
      expect(seer).toHaveBeenCalledTimes(1);
      expect(seer.mock.calls[0][1].data).toEqual({
        organization_id: organization.id,
        project_id: '2',
        config: {
          direction: 'both',
          sensitivity: 'medium',
          expected_seasonality: 'auto',
          time_period: 5,
          aggregate: 'count',
        },
        current_data: currentValues.map(v => [v.timestamp / 1000, {count: v.value}]),
        historical_data: historyValues.map(v => [v.timestamp / 1000, {count: v.value}]),
      });
    });

    it('waits for edits to settle and only sends the last query', async () => {
      mockHistory();
      const seer = mockSeer();

      const {rerender, result} = renderHookWithProviders(
        (props: typeof baseProps) => useExploreAnomalies(props),
        {organization, initialProps: baseProps}
      );
      rerender({...baseProps, query: 'span.op:db span.status:ok'});
      rerender({...baseProps, query: 'span.op:http'});

      act(() => jest.advanceTimersByTime(SETTLE_WAIT_MS));
      await waitFor(() => expect(result.current.anomalies).toHaveLength(1));
      expect(seer).toHaveBeenCalledTimes(1);
    });

    it('groups anomalous points into periods', async () => {
      mockHistory();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/anomalies/`,
        method: 'POST',
        body: [
          {
            timestamp: currentValues[0]!.timestamp / 1000,
            value: 1,
            anomaly: {anomaly_score: 0.9, anomaly_type: AnomalyType.HIGH_CONFIDENCE},
          },
          {
            timestamp: currentValues[1]!.timestamp / 1000,
            value: 2,
            anomaly: {anomaly_score: 0.1, anomaly_type: AnomalyType.NONE},
          },
        ],
      });

      const {result} = renderHookWithProviders(() => useExploreAnomalies(baseProps), {
        organization,
      });
      expect(result.current.status).toBe('loading');

      act(() => jest.advanceTimersByTime(SETTLE_WAIT_MS));
      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(result.current.anomalyPeriods).toEqual([
        expect.objectContaining({
          start: currentValues[0]!.timestamp,
          // Periods cover their buckets in full
          end: currentValues[0]!.timestamp + 5 * MINUTE,
          priority: 'high',
        }),
      ]);
    });

    it('reports empty when Seer has too little history to score', async () => {
      mockHistory();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/anomalies/`,
        method: 'POST',
        body: [],
      });

      const {result} = renderHookWithProviders(() => useExploreAnomalies(baseProps), {
        organization,
      });

      act(() => jest.advanceTimersByTime(SETTLE_WAIT_MS));
      await waitFor(() => expect(result.current.status).toBe('empty'));
      expect(result.current.anomalyPeriods).toEqual([]);
    });

    it('reports an error when Seer fails', async () => {
      mockHistory();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/anomalies/`,
        method: 'POST',
        statusCode: 400,
        body: {detail: 'Unable to get historical anomaly data'},
      });

      const {result} = renderHookWithProviders(() => useExploreAnomalies(baseProps), {
        organization,
      });

      act(() => jest.advanceTimersByTime(SETTLE_WAIT_MS));
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.anomalyPeriods).toEqual([]);
    });

    it('reuses the cached result when toggled off and on again', async () => {
      mockHistory();
      const seer = mockSeer();

      const {rerender, result} = renderHookWithProviders(
        (props: typeof baseProps) => useExploreAnomalies(props),
        {organization, initialProps: baseProps}
      );
      act(() => jest.advanceTimersByTime(SETTLE_WAIT_MS));
      await waitFor(() => expect(result.current.anomalies).toHaveLength(1));

      rerender({...baseProps, enabled: false});
      expect(result.current.anomalies).toBeUndefined();
      expect(result.current.anomalyPeriods).toEqual([]);
      expect(result.current.status).toBe('idle');

      rerender(baseProps);

      expect(result.current.anomalies).toHaveLength(1);
      expect(seer).toHaveBeenCalledTimes(1);
    });
  });
});
