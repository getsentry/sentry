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
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
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

const percentDetector = MetricDetectorFixture({
  config: {detectionType: 'percent', comparisonDelta: 3600},
  conditionGroup: {
    id: '1',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: '1',
        type: DataConditionType.GREATER,
        comparison: 150,
        conditionResult: DetectorPriorityLevel.HIGH,
      },
      {
        id: '2',
        type: DataConditionType.LESS_OR_EQUAL,
        comparison: 120,
        conditionResult: DetectorPriorityLevel.OK,
      },
    ],
  },
});

const anomalyDetector = MetricDetectorFixture({
  config: {detectionType: 'dynamic'},
  conditionGroup: {
    id: '1',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: '1',
        type: DataConditionType.ANOMALY_DETECTION,
        comparison: {
          seasonality: 'auto',
          sensitivity: AlertRuleSensitivity.LOW,
          thresholdType: AlertRuleThresholdType.ABOVE,
        },
        conditionResult: DetectorPriorityLevel.HIGH,
      },
    ],
  },
});

const comparisonTimeseriesData = [
  {
    seriesName: 'count()',
    data: [
      {name: FIRST_TIMESTAMP_MS, value: 10},
      {name: FIRST_TIMESTAMP_MS + INTERVAL_MS, value: 20},
      {name: FIRST_TIMESTAMP_MS + INTERVAL_MS * 2, value: 30},
    ],
  },
];

const anomalyThresholds = [0, 1, 2].map(index => ({
  external_alert_id: 1,
  timestamp: (FIRST_TIMESTAMP_MS + INTERVAL_MS * index) / 1000,
  value: 10,
  yhat_lower: 2 + index,
  yhat_upper: 12 + index,
}));

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

  it('draws open period markers below the chart on their own hidden axis, without the trigger interval', () => {
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

  it('draws percent change thresholds against the comparison series at bucket end', () => {
    const chartOption = getMetricDetectorChartOption(
      {detector: percentDetector, timeseriesData, comparisonTimeseriesData},
      theme
    );

    const thresholdLines = chartOption.additionalSeries.filter(series =>
      String(series.name).endsWith('Threshold')
    );

    expect(thresholdLines).toEqual([
      expect.objectContaining({
        name: '50% Higher Threshold',
        data: [
          [FIRST_TIMESTAMP_MS + INTERVAL_MS, 15],
          [FIRST_TIMESTAMP_MS + INTERVAL_MS * 2, 30],
          [FIRST_TIMESTAMP_MS + INTERVAL_MS * 3, 45],
        ],
      }),
      expect.objectContaining({
        name: '20% Higher Resolution Threshold',
        data: [
          [FIRST_TIMESTAMP_MS + INTERVAL_MS, 12],
          [FIRST_TIMESTAMP_MS + INTERVAL_MS * 2, 24],
          [FIRST_TIMESTAMP_MS + INTERVAL_MS * 3, 36],
        ],
      }),
    ]);
  });

  it('draws no percent change thresholds without a comparison series', () => {
    const chartOption = getMetricDetectorChartOption(
      {detector: percentDetector, timeseriesData},
      theme
    );

    expect(chartOption.additionalSeries).toEqual([]);
  });

  it('draws the anomaly bound the detector alerts on, at bucket end', () => {
    const chartOption = getMetricDetectorChartOption(
      {detector: anomalyDetector, timeseriesData, anomalyThresholds},
      theme
    );

    expect(chartOption.additionalSeries).toEqual([
      expect.objectContaining({
        name: 'Upper Threshold',
        data: [
          [FIRST_TIMESTAMP_MS + INTERVAL_MS, 12],
          [FIRST_TIMESTAMP_MS + INTERVAL_MS * 2, 13],
          [FIRST_TIMESTAMP_MS + INTERVAL_MS * 3, 14],
        ],
      }),
    ]);
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
