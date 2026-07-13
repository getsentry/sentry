import moment from 'moment-timezone';
import {HeatMapSeriesFixture} from 'sentry-fixture/heatMapSeries';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {partitionDateTimeIntoHeatMapWindows} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';
import {useMetricHeatMapData} from 'sentry/views/explore/metrics/hooks/useMetricHeatMapData';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

const organization = OrganizationFixture();
const traceMetric: TraceMetric = {name: 'foo', type: 'distribution', unit: 'millisecond'};

const ABSOLUTE_START = '2024-01-01T00:00:00.000Z';
const ABSOLUTE_END = '2024-02-01T00:00:00.000Z';

const WIDE_SELECTION = PageFiltersFixture({
  projects: [1],
  datetime: {start: ABSOLUTE_START, end: ABSOLUTE_END, period: null, utc: true},
});

const NARROW_SELECTION = PageFiltersFixture({
  projects: [1],
  datetime: {start: null, end: null, period: '1h', utc: null},
});

const WIDE_WINDOWS = partitionDateTimeIntoHeatMapWindows(
  WIDE_SELECTION.datetime,
  '1h',
  'progressive'
).windows as Array<{end: string; start: string}>;

describe('useMetricHeatMapData', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('Fetches bounds then pinned chunks and merges them (two-phase)', async () => {
    const boundsMock = mockBounds({data: [{'min(value)': 10, 'max(value)': 500}]});

    const chunkMocks = WIDE_WINDOWS.map((window, index) =>
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-heatmap/`,
        method: 'GET',
        match: [MockApiClient.matchQuery(window)],
        body: chunkBody(windowMs(window), index + 1),
      })
    );

    const {result} = renderHeatMapData(WIDE_SELECTION);

    // Wait until every chunk's populated cell has landed.
    await waitFor(() =>
      expect(result.current.series?.values.filter(v => v.zAxis !== null)).toHaveLength(
        WIDE_WINDOWS.length
      )
    );

    // Bounds and every chunk run at HIGHEST_ACCURACY so they share one
    // (undownsampled) tier — see the backend-contract note in the hook.
    expect(boundsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({sampling: SAMPLING_MODE.HIGH_ACCURACY}),
      })
    );

    // Every chunk request carries the pinned domain from the bounds row.
    for (const chunkMock of chunkMocks) {
      expect(chunkMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-heatmap/`,
        expect.objectContaining({
          query: expect.objectContaining({
            yMin: 10,
            yMax: 500,
            interval: '1h',
            yBuckets: 10,
            sampling: SAMPLING_MODE.HIGH_ACCURACY,
          }),
        })
      );
    }

    const fullStart = Math.min(...WIDE_WINDOWS.map(w => windowMs(w).start));
    const fullEnd = Math.max(...WIDE_WINDOWS.map(w => windowMs(w).end));

    // The x domain spans every planned chunk (not just loaded ones), the pinned
    // bounds flow into the merged y-domain, and the metric unit is patched on.
    // Grid shape/ordering are covered by the mergeHeatMapChunks unit tests.
    expect(result.current.series?.meta.xAxis.start).toBe(fullStart);
    expect(result.current.series?.meta.xAxis.end).toBe(fullEnd);
    expect(result.current.series?.meta.yAxis.start).toBe(10);
    expect(result.current.series?.meta.yAxis.end).toBe(500);
    expect(result.current.series?.meta.yAxis.valueUnit).toBe('millisecond');
    expect(result.current.isPending).toBe(false);
    expect(result.current.isPartial).toBe(false);
  });

  it('uses a single unpinned request for narrow ranges (fast path)', async () => {
    const boundsMock = mockBounds({data: [{'min(value)': 10, 'max(value)': 500}]});
    const heatmapMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-heatmap/`,
      method: 'GET',
      body: chunkBody({start: 0, end: 3600000}, 1),
    });

    const {result} = renderHeatMapData(NARROW_SELECTION);

    await waitFor(() => expect(result.current.series).toBeDefined());

    // No Phase A, and no pinned bounds on the single request.
    expect(boundsMock).not.toHaveBeenCalled();
    expect(heatmapMock).toHaveBeenCalledTimes(1);
    const requestQuery = heatmapMock.mock.calls[0]![1]!.query;
    expect(requestQuery.yMin).toBeUndefined();
    expect(requestQuery.yMax).toBeUndefined();
    // Fast path keeps default sampling (no forced tier), matching pre-chunking.
    expect(requestQuery.sampling).toBeUndefined();
    // The single request uses the selection range, not a chunk window.
    expect(requestQuery.statsPeriod).toBe('1h');
  });

  it('falls back to one unpinned request when a wide range has no data', async () => {
    // Phase A finds no rows → no min/max row to key off.
    const boundsMock = mockBounds({data: []});
    const heatmapMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-heatmap/`,
      method: 'GET',
      body: HeatMapSeriesFixture(),
    });

    const {result} = renderHeatMapData(WIDE_SELECTION);

    // Bounds run first (it's a wide, chunk-eligible range), then the fallback.
    await waitFor(() => expect(result.current.series).toBeDefined());

    expect(boundsMock).toHaveBeenCalled();
    // A single unpinned request over the whole selection — not the chunk windows.
    expect(heatmapMock).toHaveBeenCalledTimes(1);
    const requestQuery = heatmapMock.mock.calls[0]![1]!.query;
    expect(requestQuery.yMin).toBeUndefined();
    expect(requestQuery.yMax).toBeUndefined();
    expect(requestQuery.sampling).toBeUndefined();
    expect(requestQuery.start).toBeDefined();
    expect(requestQuery.end).toBeDefined();
    expect(requestQuery.statsPeriod).toBeUndefined();
    // The real empty response is renderable (drives "No data"), not a spinner.
    expect(result.current.series?.values).toHaveLength(0);
    expect(result.current.isPending).toBe(false);
  });

  it('renders remaining chunks and flags partial when one chunk fails', async () => {
    mockBounds({data: [{'min(value)': 10, 'max(value)': 500}]});

    WIDE_WINDOWS.forEach((window, index) => {
      const isLast = index === WIDE_WINDOWS.length - 1;
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-heatmap/`,
        method: 'GET',
        match: [MockApiClient.matchQuery(window)],
        body: isLast ? {detail: 'boom'} : chunkBody(windowMs(window), index + 1),
        statusCode: isLast ? 500 : 200,
      });
    });

    const {result} = renderHeatMapData(WIDE_SELECTION);

    await waitFor(() => expect(result.current.isPartial).toBe(true));

    // The failed chunk's columns stay empty; the rest render their populated cells.
    expect(result.current.series?.values.filter(v => v.zAxis !== null)).toHaveLength(
      WIDE_WINDOWS.length - 1
    );
    expect(result.current.error).toBeNull();
  });

  it('surfaces a fatal error when Phase A (bounds) fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.explore.tracemetrics-bounds'})],
      body: {detail: 'nope'},
      statusCode: 500,
    });

    const {result} = renderHeatMapData(WIDE_SELECTION);

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.series).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });

  it('does not fetch when disabled', () => {
    const boundsMock = mockBounds({data: [{'min(value)': 10, 'max(value)': 500}]});
    const heatmapMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-heatmap/`,
      method: 'GET',
      body: chunkBody({start: 0, end: 3600000}, 1),
    });

    const {result} = renderHeatMapData(WIDE_SELECTION, false);

    expect(boundsMock).not.toHaveBeenCalled();
    expect(heatmapMock).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });
});

const windowMs = (window: {end: string; start: string}) => ({
  start: moment.utc(window.start).valueOf(),
  end: moment.utc(window.end).valueOf(),
});

function chunkBody(chunk: {end: number; start: number}, zValue: number): HeatMapSeries {
  return {
    meta: {
      xAxis: {
        name: 'time',
        start: chunk.start,
        end: chunk.end,
        bucketCount: 1,
        bucketSize: 3600,
      },
      yAxis: {
        name: 'value',
        start: 10,
        end: 500,
        bucketCount: 10,
        bucketSize: 49,
        valueType: 'number',
        valueUnit: null,
      },
      zAxis: {name: 'count()', start: zValue, end: zValue},
    },
    // One value per chunk, keyed by the chunk's (distinct) start → no seam dups.
    values: [{xAxis: chunk.start, yAxis: 10, zAxis: zValue}],
  };
}

function mockBounds(body: {data: Array<Record<string, number>>}) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [MockApiClient.matchQuery({referrer: 'api.explore.tracemetrics-bounds'})],
    body: {...body, meta: {}},
  });
}

function renderHeatMapData(selection: PageFilters, enabled = true) {
  return renderHookWithProviders(() =>
    useMetricHeatMapData({
      organization,
      selection,
      traceMetric,
      query: '',
      interval: '1h',
      yBuckets: 10,
      enabled,
    })
  );
}
