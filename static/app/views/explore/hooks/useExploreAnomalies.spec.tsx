import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {AnomalyType} from 'sentry/views/alerts/types';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {
  getAnomalyAggregate,
  getHistoricalDatetime,
  SETTLE_WAIT_MS,
  timeSeriesToAnomalyDataPoints,
  useExploreAnomalies,
} from './useExploreAnomalies';

const organization = OrganizationFixture();

describe('getHistoricalDatetime', () => {
  it.each([
    ['1h', '678h'],
    ['24h', '29d'],
    ['3d', '31d'],
    ['7d', '28d'],
  ])('maps a %s range to %s of history', (period, expected) => {
    expect(getHistoricalDatetime({period, start: null, end: null, utc: false})).toEqual({
      period: expected,
      start: null,
      end: null,
      utc: false,
    });
  });

  it('reaches back from the end of an absolute range', () => {
    expect(
      getHistoricalDatetime({
        period: null,
        start: '2026-11-01T00:00:00',
        end: '2026-11-03T00:00:00',
        utc: true,
      })
    ).toEqual({
      period: null,
      start: '2026-10-03T00:00:00',
      end: '2026-11-03T00:00:00',
      utc: true,
    });
  });
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
  it('converts to seconds, sorts, fills nulls with 0 and drops incomplete buckets', () => {
    expect(
      timeSeriesToAnomalyDataPoints([
        TimeSeriesFixture({
          values: [
            {timestamp: 2_000_000, value: null},
            {timestamp: 1_000_000, value: 4},
            {timestamp: 3_000_000, value: 9, incomplete: true},
          ],
        }),
      ])
    ).toEqual([
      [1000, {count: 4}],
      [2000, {count: 0}],
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

  it('re-runs the chart query over the historical range without a group by', async () => {
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
          currentTimeSeries: [],
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.historicalTimeSeries).toHaveLength(1));
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '29d',
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
          currentTimeSeries: [],
        }),
      {organization}
    );

    expect(request).not.toHaveBeenCalled();
  });

  describe('Seer call', () => {
    const MINUTE = 60_000;
    const NOW = 1_800_000_000_000;
    // Five-minute buckets: some history, then the chart's current points
    const historyValues = Array.from({length: 10}, (_, i) => ({
      timestamp: NOW - 2 * 24 * 60 * MINUTE + i * 5 * MINUTE,
      value: i,
    }));
    const currentValues = [
      {timestamp: NOW - 10 * MINUTE, value: 1},
      {timestamp: NOW - 5 * MINUTE, value: 2},
    ];
    const currentTimeSeries = [
      TimeSeriesFixture({yAxis: 'count(span.duration)', values: currentValues}),
    ];

    function mockHistory() {
      return MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        body: {
          timeSeries: [
            TimeSeriesFixture({
              yAxis: 'count(span.duration)',
              // Includes the current points, which should be removed
              values: [...historyValues, ...currentValues],
            }),
          ],
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
      currentTimeSeries,
      enabled: true,
      extrapolate: true,
      isMainChartLoaded: true,
      query: 'span.op:db',
      visualize,
    };

    it('sends the current series, the history and the config', async () => {
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
          // Single points are widened by one interval so they're visible
          end: currentValues[0]!.timestamp + 5 * MINUTE,
          priority: 'high',
        }),
      ]);
      expect([...result.current.anomalousTimestamps]).toEqual([
        currentValues[0]!.timestamp,
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
