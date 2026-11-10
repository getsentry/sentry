import type {Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  GridComponentOption,
  LineSeriesOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {GroupOpenPeriod} from 'sentry/types/group';
import type {SessionApiResponse} from 'sentry/types/organization';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricCondition,
  MetricDetector,
} from 'sentry/types/workflowEngine/detectors';
import {getCrashFreeRateSeries} from 'sentry/utils/sessions';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import type {Anomaly} from 'sentry/views/alerts/types';
import {
  ALERT_CHART_MIN_MAX_BUFFER,
  alertAxisFormatter,
  SESSION_AGGREGATE_TO_FIELD,
  shouldScaleAlertChart,
} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import {getAnomalyMarkerSeries} from 'sentry/views/detectors/utils/anomalyChart';
import {
  createAnomalyThresholdSeries,
  filterAnomalyThresholdSeries,
  getAnomalyThresholdType,
  type AnomalyThresholdDataPoint,
} from 'sentry/views/detectors/utils/anomalyThresholdSeries';
import {convertOpenPeriodsToIncidentPeriods} from 'sentry/views/detectors/utils/convertOpenPeriodsToIncidentPeriods';
import {
  createIncidentMarkerSeries,
  DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
  INCIDENT_MARKER_GRID,
  INCIDENT_MARKER_X_AXIS_CONFIG,
  INCIDENT_MARKER_Y_AXIS,
} from 'sentry/views/detectors/utils/incidentMarkers';
import {isCrashFreeAlert} from 'sentry/views/detectors/utils/isCrashFreeAlert';
import {getMetricDetectorThresholdSeries} from 'sentry/views/detectors/utils/metricDetectorThresholdSeries';
import {shiftSeriesToBucketEnd} from 'sentry/views/detectors/utils/shiftSeriesToBucketEnd';

// The main chart axis is 0, so the open period markers get their own hidden axis
const OPEN_PERIOD_MARKER_Y_AXIS_INDEX = 1;

const ALERT_PRIORITY_LEVELS = [DetectorPriorityLevel.MEDIUM, DetectorPriorityLevel.HIGH];

export type MetricDetectorChartData = {
  detector: MetricDetector;
  timeseriesData: Series[];
  anomalies?: Anomaly[];
  /**
   * Seer's expected range for anomaly detection monitors, keyed by bucket start
   */
  anomalyThresholds?: AnomalyThresholdDataPoint[];
  /**
   * The same metric one comparison period earlier, for percent change monitors
   */
  comparisonTimeseriesData?: Series[];
  openPeriods?: GroupOpenPeriod[];
};

export interface MetricDetectorChartOption {
  /**
   * Threshold lines and bands, anomaly bounds and open period markers, drawn as they are
   */
  additionalSeries: Array<LineSeriesOption | CustomSeriesOption>;
  /**
   * Hidden axes that additional series are positioned against
   */
  additionalYAxes: YAXisComponentOption[];
  grid: GridComponentOption;
  /**
   * The metric and its anomaly markers, drawn as area series
   */
  series: AreaChartSeries[];
  xAxis: XAXisComponentOption;
  yAxis: YAXisComponentOption;
}

interface OpenPeriodMarkerOptions {
  grid: GridComponentOption;
  series: CustomSeriesOption[];
  xAxis: XAXisComponentOption;
  yAxes: YAXisComponentOption[];
}

function createMetricSeries(timeseriesData: Series[], theme: Theme): AreaChartSeries[] {
  const [metricColor] = theme.chart.getColorPalette(0);

  // Ensure series data appears below threshold and open period lines
  return timeseriesData.map((series, index) =>
    index === 0 ? {...series, color: metricColor, z: 1} : series
  );
}

function createOpenPeriodMarkerOptions({
  openPeriods,
  intervalMs,
  chartEndTimestampMs,
  theme,
}: {
  chartEndTimestampMs: number | undefined;
  intervalMs: number;
  openPeriods: GroupOpenPeriod[];
  theme: Theme;
}): OpenPeriodMarkerOptions {
  const incidentPeriods = convertOpenPeriodsToIncidentPeriods({
    openPeriods,
    intervalMs,
    chartEndTimestampMs,
  });

  // In an image the trigger interval is a sliver with no tooltip to explain it
  const openPeriodSegments = incidentPeriods.filter(
    period => period.type !== 'trigger-interval'
  );

  const openPeriodMarkerSeries = createIncidentMarkerSeries({
    incidentPeriods: openPeriodSegments,
    theme,
    seriesName: t('Open Periods'),
    yAxisIndex: OPEN_PERIOD_MARKER_Y_AXIS_INDEX,
  });

  if (!openPeriodMarkerSeries) {
    return {
      series: [],
      yAxes: [],
      xAxis: DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
      grid: {},
    };
  }

  return {
    series: [openPeriodMarkerSeries],
    yAxes: [INCIDENT_MARKER_Y_AXIS],
    xAxis: INCIDENT_MARKER_X_AXIS_CONFIG,
    grid: INCIDENT_MARKER_GRID,
  };
}

/**
 * Seer bounds line up with the start of each bucket, so they move to the bucket end
 * along with the metric
 */
function createAnomalyBoundSeries({
  anomalyThresholds,
  detector,
  intervalSeconds,
  series,
  theme,
}: {
  anomalyThresholds: AnomalyThresholdDataPoint[];
  detector: MetricDetector;
  intervalSeconds: number;
  series: Series[];
  theme: Theme;
}) {
  const anomalyThresholdsAtBucketEnd = anomalyThresholds.map(point => ({
    ...point,
    timestamp: point.timestamp + intervalSeconds,
  }));

  const anomalyThresholdSeries = createAnomalyThresholdSeries({
    anomalyThresholds: anomalyThresholdsAtBucketEnd,
    series,
    theme,
  });

  return filterAnomalyThresholdSeries({
    anomalyThresholdSeries,
    thresholdType: getAnomalyThresholdType(detector),
  });
}

function getAlertThresholdValues(
  conditions: Array<Omit<MetricCondition, 'id'>>
): number[] {
  return conditions
    .filter(condition => ALERT_PRIORITY_LEVELS.includes(condition.conditionResult))
    .map(condition => condition.comparison)
    .filter(comparison => typeof comparison === 'number');
}

/**
 * Lowest value between the data and the alert thresholds, with some breathing space
 */
function getMinChartValue({
  aggregate,
  alertThresholdValues,
  seriesValues,
}: {
  aggregate: string;
  alertThresholdValues: number[];
  seriesValues: number[];
}): number {
  if (!shouldScaleAlertChart(aggregate)) {
    return 0;
  }

  const lowestValue = Math.min(...seriesValues, ...alertThresholdValues);

  return Math.floor(lowestValue / ALERT_CHART_MIN_MAX_BUFFER);
}

function getMaxChartValue({
  dataset,
  seriesValues,
  thresholdMaxValue,
}: {
  dataset: Dataset;
  seriesValues: number[];
  thresholdMaxValue: number | undefined;
}): number | undefined {
  if (isCrashFreeAlert(dataset)) {
    return 100;
  }

  const highestSeriesValue = Math.max(...seriesValues);

  if (thresholdMaxValue === undefined || thresholdMaxValue <= highestSeriesValue) {
    return undefined;
  }

  return thresholdMaxValue;
}

function getTimestampMs(point: Series['data'][number] | undefined): number | undefined {
  return point === undefined ? undefined : new Date(point.name).getTime();
}

/**
 * Builds the metric detector chart that Chartcuterie renders for notifications, from
 * the same thresholds, threshold bands, anomaly bounds and open period markers as the
 * details page chart.
 */
export function getMetricDetectorChartOption(
  {
    timeseriesData,
    detector,
    openPeriods = [],
    anomalies,
    anomalyThresholds = [],
    comparisonTimeseriesData = [],
  }: MetricDetectorChartData,
  theme: Theme
): MetricDetectorChartOption {
  const snubaQuery = detector.dataSources[0].queryObj.snubaQuery;

  const conditions = detector.conditionGroup?.conditions ?? [];

  const series = createMetricSeries(
    shiftSeriesToBucketEnd(timeseriesData, snubaQuery.timeWindow),
    theme
  );

  const metricData = series[0]!.data;

  const seriesValues = metricData.map(point => point.value);

  const firstTimestampMs = getTimestampMs(metricData[0]);

  const lastTimestampMs = getTimestampMs(metricData.at(-1));

  const comparisonSeries = shiftSeriesToBucketEnd(
    comparisonTimeseriesData,
    snubaQuery.timeWindow
  );

  const thresholdSeries = getMetricDetectorThresholdSeries({
    aggregate: snubaQuery.aggregate,
    conditions,
    detectionType: detector.config.detectionType,
    theme,
    comparisonSeries,
  });

  const anomalyBoundSeries = createAnomalyBoundSeries({
    anomalyThresholds,
    detector,
    intervalSeconds: snubaQuery.timeWindow,
    series,
    theme,
  });

  const openPeriodMarkerOptions = createOpenPeriodMarkerOptions({
    openPeriods,
    intervalMs: snubaQuery.timeWindow * 1000,
    chartEndTimestampMs: lastTimestampMs,
    theme,
  });

  const anomalyMarkerSeries = anomalies
    ? getAnomalyMarkerSeries(anomalies, {
        startDate: new Date(firstTimestampMs ?? Date.now()),
        endDate: new Date(lastTimestampMs ?? Date.now()),
        theme,
      })
    : [];

  const minChartValue = getMinChartValue({
    aggregate: snubaQuery.aggregate,
    alertThresholdValues: getAlertThresholdValues(conditions),
    seriesValues,
  });

  const maxChartValue = getMaxChartValue({
    dataset: snubaQuery.dataset,
    seriesValues,
    thresholdMaxValue: thresholdSeries.maxValue,
  });

  const yAxis: YAXisComponentOption = {
    axisLabel: {
      formatter: (value: number) =>
        alertAxisFormatter(value, series[0]!.seriesName, snubaQuery.aggregate),
    },
    max: maxChartValue,
    min: minChartValue || undefined,
  };

  return {
    series: [...series, ...anomalyMarkerSeries],
    additionalSeries: [
      ...thresholdSeries.additionalSeries,
      ...anomalyBoundSeries,
      ...openPeriodMarkerOptions.series,
    ],
    yAxis,
    additionalYAxes: openPeriodMarkerOptions.yAxes,
    xAxis: openPeriodMarkerOptions.xAxis,
    grid: openPeriodMarkerOptions.grid,
  };
}

export function transformSessionResponseToSeries(
  response: SessionApiResponse | null,
  detector: MetricDetector
): MetricDetectorChartData['timeseriesData'] {
  const {aggregate} = detector.dataSources[0].queryObj.snubaQuery;

  return [
    {
      seriesName:
        AlertWizardAlertNames[
          getAlertTypeFromAggregateDataset({
            aggregate,
            dataset: Dataset.SESSIONS,
          })
        ],
      data: getCrashFreeRateSeries(
        response?.groups,
        response?.intervals,
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        SESSION_AGGREGATE_TO_FIELD[aggregate]
      ),
    },
  ];
}
