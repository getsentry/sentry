import type {LineSeriesOption} from 'echarts';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
  INCIDENT_MARKER_GRID,
  INCIDENT_MARKER_SERIES_ID,
  INCIDENT_MARKER_X_AXIS_CONFIG,
  INCIDENT_MARKER_Y_AXIS,
} from 'sentry/views/detectors/utils/incidentMarkers';

import {getMetricDetectorChartOption} from './metricDetectorChartOptions';

const theme = ThemeFixture();

const INTERVAL_MS = 60_000;

const FIRST_TIMESTAMP_MS = new Date('2024-01-01T00:00:00Z').getTime();

const OPEN_PERIOD_START_MS = FIRST_TIMESTAMP_MS + INTERVAL_MS;

const OPEN_PERIOD_START = new Date(OPEN_PERIOD_START_MS).toISOString();

const detector = MetricDetectorFixture({
  conditionGroup: {
    id: '1',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: '1',
        type: DataConditionType.GREATER,
        comparison: 10,
        conditionResult: DetectorPriorityLevel.MEDIUM,
      },
      {
        id: '2',
        type: DataConditionType.GREATER,
        comparison: 20,
        conditionResult: DetectorPriorityLevel.HIGH,
      },
      {
        id: '3',
        type: DataConditionType.LESS_OR_EQUAL,
        comparison: 10,
        conditionResult: DetectorPriorityLevel.OK,
      },
    ],
  },
});

const timeseriesData = [
  {
    seriesName: 'count()',
    data: [
      {name: FIRST_TIMESTAMP_MS, value: 5},
      {name: FIRST_TIMESTAMP_MS + INTERVAL_MS, value: 25},
      {name: FIRST_TIMESTAMP_MS + INTERVAL_MS * 2, value: 15},
    ],
  },
];

type MarkLineDatum = {yAxis: number};

type MarkAreaRange = [{yAxis: number}, {yAxis: number}];

function getThresholdLineValues(additionalSeries: LineSeriesOption[]) {
  return additionalSeries
    .flatMap(series => (series.markLine?.data ?? []) as MarkLineDatum[])
    .map(datum => datum.yAxis);
}

function getStaticBandRanges(additionalSeries: LineSeriesOption[]) {
  return additionalSeries
    .flatMap(series => (series.markArea?.data ?? []) as MarkAreaRange[])
    .map(([lower, upper]) => [lower.yAxis, upper.yAxis]);
}

function createOpenPeriod({end}: {end: string | null}) {
  return GroupOpenPeriodFixture({
    start: OPEN_PERIOD_START,
    end,
    isOpen: end === null,
    activities: [
      GroupOpenPeriodActivityFixture({
        type: 'opened',
        value: 'high',
        dateCreated: OPEN_PERIOD_START,
      }),
    ],
  });
}

describe('getMetricDetectorChartOption', () => {
  it('shifts data points to the end of their bucket', () => {
    const chartOption = getMetricDetectorChartOption({detector, timeseriesData}, theme);

    const timestamps = chartOption.series[0]!.data.map(point => point.name);

    expect(timestamps).toEqual([
      FIRST_TIMESTAMP_MS + INTERVAL_MS,
      FIRST_TIMESTAMP_MS + INTERVAL_MS * 2,
      FIRST_TIMESTAMP_MS + INTERVAL_MS * 3,
    ]);
  });

  it('draws threshold lines and bands for static detectors', () => {
    const chartOption = getMetricDetectorChartOption({detector, timeseriesData}, theme);

    const additionalSeries = chartOption.additionalSeries as LineSeriesOption[];

    expect(getThresholdLineValues(additionalSeries)).toEqual([10, 20]);

    expect(getStaticBandRanges(additionalSeries)).toEqual([
      [-Infinity, 10],
      [10, 20],
      [20, Infinity],
    ]);
  });

  it('draws open period markers below the chart on their own hidden axis', () => {
    const openPeriodEnd = new Date(OPEN_PERIOD_START_MS + INTERVAL_MS).toISOString();

    const chartOption = getMetricDetectorChartOption(
      {detector, timeseriesData, openPeriods: [createOpenPeriod({end: openPeriodEnd})]},
      theme
    );

    const openPeriodMarkerSeries = chartOption.additionalSeries.find(
      series => series.id === INCIDENT_MARKER_SERIES_ID
    );

    expect(openPeriodMarkerSeries).toEqual(
      expect.objectContaining({type: 'custom', yAxisIndex: 1})
    );

    expect(openPeriodMarkerSeries?.data).toEqual([
      expect.objectContaining({
        type: 'trigger-interval',
        start: OPEN_PERIOD_START_MS - INTERVAL_MS,
        end: OPEN_PERIOD_START_MS,
      }),
      expect.objectContaining({
        type: 'open-period-start',
        priority: 'high',
        start: OPEN_PERIOD_START_MS,
        end: OPEN_PERIOD_START_MS + INTERVAL_MS,
      }),
    ]);

    expect(chartOption.additionalYAxes).toEqual([INCIDENT_MARKER_Y_AXIS]);

    expect(chartOption.xAxis).toEqual(INCIDENT_MARKER_X_AXIS_CONFIG);

    expect(chartOption.grid).toEqual(INCIDENT_MARKER_GRID);
  });

  it('ends ongoing open periods at the last data point', () => {
    const chartOption = getMetricDetectorChartOption(
      {detector, timeseriesData, openPeriods: [createOpenPeriod({end: null})]},
      theme
    );

    const openPeriodMarkerSeries = chartOption.additionalSeries.find(
      series => series.id === INCIDENT_MARKER_SERIES_ID
    );

    expect(openPeriodMarkerSeries?.data).toContainEqual(
      expect.objectContaining({
        type: 'open-period-start',
        isOngoing: true,
        end: FIRST_TIMESTAMP_MS + INTERVAL_MS * 3,
      })
    );
  });

  it('leaves the axes alone when there are no open periods', () => {
    const chartOption = getMetricDetectorChartOption({detector, timeseriesData}, theme);

    const hasOpenPeriodMarkers = chartOption.additionalSeries.some(
      series => series.id === INCIDENT_MARKER_SERIES_ID
    );

    expect(hasOpenPeriodMarkers).toBe(false);

    expect(chartOption.additionalYAxes).toEqual([]);

    expect(chartOption.xAxis).toEqual(DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG);

    expect(chartOption.grid).toEqual({});
  });
});
