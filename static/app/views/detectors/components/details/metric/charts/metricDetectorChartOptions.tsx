import type {Theme} from '@emotion/react';
import color from 'color';
import type {YAXisComponentOption} from 'echarts';
import moment from 'moment-timezone';

import type {AreaChartProps, AreaChartSeries} from 'sentry/components/charts/areaChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import type {GroupOpenPeriod} from 'sentry/types/group';
import type {SessionApiResponse} from 'sentry/types/organization';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {getCrashFreeRateSeries} from 'sentry/utils/sessions';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {getAnomalyMarkerSeries} from 'sentry/views/alerts/rules/metric/utils/anomalyChart';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import type {Anomaly} from 'sentry/views/alerts/types';
import {
  ALERT_CHART_MIN_MAX_BUFFER,
  alertAxisFormatter,
  alertTooltipValueFormatter,
  SESSION_AGGREGATE_TO_FIELD,
  shouldScaleAlertChart,
} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

function formatTooltipDate(date: moment.MomentInput, format: string): string {
  return moment(date).format(format);
}

function createStatusAreaSeries(
  lineColor: string,
  startTime: number,
  endTime: number,
  yPosition: number
): AreaChartSeries {
  return {
    seriesName: 'Status Area',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'solid', width: 4},
      data: [[{coord: [startTime, yPosition]}, {coord: [endTime, yPosition]}]],
    }),
    data: [],
  };
}

function createThresholdSeries(lineColor: string, threshold: number): AreaChartSeries {
  return {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'dashed', width: 1},
      data: [{yAxis: threshold}],
      label: {
        show: false,
      },
    }),
    data: [],
  };
}

function createIncidentSeries(
  openPeriod: GroupOpenPeriod,
  lineColor: string,
  incidentTimestamp: number,
  dataPoint?: AreaChartSeries['data'][0],
  seriesName?: string,
  aggregate?: string
): AreaChartSeries {
  const formatter = ({value, marker}: any) => {
    const time = formatTooltipDate(moment(value), 'MMM D, YYYY LT');
    return [
      `<div class="tooltip-series"><div>`,
      `<span class="tooltip-label">${marker} <strong>${t('Alert')} #${
        openPeriod.id
      }</strong></span>${
        dataPoint?.value
          ? `${seriesName} ${alertTooltipValueFormatter(
              dataPoint.value,
              seriesName ?? '',
              aggregate ?? ''
            )}`
          : ''
      }`,
      `</div></div>`,
      `<div class="tooltip-footer">${time}</div>`,
      '<div class="tooltip-arrow"></div>',
    ].join('');
  };

  return {
    seriesName: 'Incident Line',
    type: 'line',
    markLine: MarkLine({
      silent: false,
      lineStyle: {color: lineColor, type: 'solid'},
      data: [
        {
          xAxis: incidentTimestamp,
        },
      ],
      label: {
        silent: true,
        show: !!openPeriod.id,
        position: 'insideEndBottom',
        formatter: openPeriod.id,
        color: lineColor,
        fontSize: 10,
        fontFamily: 'Rubik',
      },
      tooltip: {
        formatter,
      },
    }),
    data: [],
    tooltip: {
      trigger: 'item',
      alwaysShowContent: true,
      formatter,
    },
  };
}

export type MetricDetectorChartData = {
  detector: MetricDetector;
  timeseriesData: Series[];
  anomalies?: Anomaly[];
  openPeriods?: GroupOpenPeriod[];
  selectedOpenPeriod?: GroupOpenPeriod | null;
  seriesName?: string;
  showWaitingForData?: boolean;
};

type MetricDetectorChartOption = {
  chartOption: AreaChartProps;
  criticalDuration: number;
  totalDuration: number;
  waitingForDataDuration: number;
  warningDuration: number;
};

/**
 * For now, this function is exclusively used by Chartcuterie to generate images for
 * notifications. It transforms detector data into the same chart format as the one
 * for metric alerts.
 *
 * In the future, we should share more code between this and the metric detector charts
 * rendered in the UI.
 */
export function getMetricDetectorChartOption(
  {
    timeseriesData,
    detector,
    seriesName,
    openPeriods,
    selectedOpenPeriod,
    showWaitingForData,
    anomalies,
  }: MetricDetectorChartData,
  theme: Theme
): MetricDetectorChartOption {
  const criticalCondition = detector.conditionGroup?.conditions?.find(
    condition => condition.conditionResult === DetectorPriorityLevel.HIGH
  );
  const warningCondition = detector.conditionGroup?.conditions?.find(
    condition => condition.conditionResult === DetectorPriorityLevel.MEDIUM
  );
  const resolutionCondition = detector.conditionGroup?.conditions?.find(
    condition => condition.conditionResult === DetectorPriorityLevel.OK
  );

  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj.snubaQuery;

  const series: AreaChartSeries[] = timeseriesData.map(s => s);
  const areaSeries: AreaChartSeries[] = [];
  const colors = theme.chart.getColorPalette(0);
  // Ensure series data appears below incident/mark lines
  series[0]!.z = 1;
  series[0]!.color = colors[0];

  const dataArr = timeseriesData[0]!.data;

  let maxSeriesValue = Number.NEGATIVE_INFINITY;
  let minSeriesValue = Number.POSITIVE_INFINITY;

  for (const coord of dataArr) {
    if (coord.value > maxSeriesValue) {
      maxSeriesValue = coord.value;
    }
    if (coord.value < minSeriesValue) {
      minSeriesValue = coord.value;
    }
  }
  // find the lowest value between chart data points, warning threshold,
  // critical threshold and then apply some breathing space
  const minChartValue = shouldScaleAlertChart(snubaQuery.aggregate)
    ? Math.floor(
        Math.min(
          minSeriesValue,
          typeof warningCondition?.comparison === 'number'
            ? warningCondition.comparison
            : Infinity,
          typeof criticalCondition?.comparison === 'number'
            ? criticalCondition.comparison
            : Infinity
        ) / ALERT_CHART_MIN_MAX_BUFFER
      )
    : 0;
  const startDate = new Date(dataArr[0]?.name!);

  const endDate = dataArr.length > 1 ? new Date(dataArr.at(-1)!.name) : new Date();
  const firstPoint = startDate.getTime();
  const lastPoint = endDate.getTime();
  const totalDuration = lastPoint - firstPoint;
  let waitingForDataDuration = 0;
  let criticalDuration = 0;
  let warningDuration = 0;

  series.push(
    createStatusAreaSeries(theme.colors.green400, firstPoint, lastPoint, minChartValue)
  );

  if (showWaitingForData) {
    const {startIndex, endIndex} = getWaitingForDataRange(dataArr);
    const startTime = new Date(dataArr[startIndex]?.name!).getTime();
    const endTime = new Date(dataArr[endIndex]?.name!).getTime();

    waitingForDataDuration = Math.abs(endTime - startTime);

    series.push(
      createStatusAreaSeries(theme.colors.gray200, startTime, endTime, minChartValue)
    );
  }

  if (openPeriods) {
    openPeriods
      .filter(
        openPeriod => !openPeriod.end || new Date(openPeriod.end).getTime() > firstPoint
      )
      .forEach(openPeriod => {
        const statusChanges = openPeriod.activities
          .filter(
            ({type, value}) =>
              (type === 'status_change' || type === 'opened') &&
              (value === 'medium' || value === 'high')
          )
          .sort(
            (a, b) =>
              new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
          );

        const incidentEnd = openPeriod.end ?? Date.now();

        const timeWindowMs = snubaQuery.timeWindow * 1000;
        const incidentColor =
          warningCondition && !statusChanges.some(({value}) => value === 'high')
            ? theme.colors.yellow400
            : theme.colors.red400;

        const incidentStartDate = new Date(openPeriod.start).getTime();
        const incidentCloseDate = openPeriod.end
          ? new Date(openPeriod.end).getTime()
          : lastPoint;
        const incidentStartValue = dataArr.find(
          point => new Date(point.name).getTime() >= incidentStartDate
        );
        series.push(
          createIncidentSeries(
            openPeriod,
            incidentColor,
            incidentStartDate,
            incidentStartValue,
            seriesName ?? series[0]!.seriesName,
            snubaQuery.aggregate
          )
        );
        const areaStart = Math.max(new Date(openPeriod.start).getTime(), firstPoint);
        const areaEnd = Math.min(
          statusChanges.length && statusChanges[0]!.dateCreated
            ? new Date(statusChanges[0]!.dateCreated).getTime() - timeWindowMs
            : new Date(incidentEnd).getTime(),
          lastPoint
        );
        const areaColor = warningCondition ? theme.colors.yellow400 : theme.colors.red400;

        if (areaEnd > areaStart) {
          series.push(
            createStatusAreaSeries(areaColor, areaStart, areaEnd, minChartValue)
          );

          if (areaColor === theme.colors.yellow400) {
            warningDuration += Math.abs(areaEnd - areaStart);
          } else {
            criticalDuration += Math.abs(areaEnd - areaStart);
          }
        }

        statusChanges.forEach((activity, idx) => {
          const statusAreaStart = Math.max(
            new Date(activity.dateCreated).getTime() - timeWindowMs,
            firstPoint
          );
          const statusAreaEnd = Math.min(
            idx === statusChanges.length - 1
              ? new Date(incidentEnd).getTime()
              : new Date(statusChanges[idx + 1]!.dateCreated).getTime() - timeWindowMs,
            lastPoint
          );
          const statusAreaColor =
            activity.value === 'high' ? theme.colors.red400 : theme.colors.yellow400;
          if (statusAreaEnd > statusAreaStart) {
            series.push(
              createStatusAreaSeries(
                statusAreaColor,
                statusAreaStart,
                statusAreaEnd,
                minChartValue
              )
            );
            if (statusAreaColor === theme.colors.yellow400) {
              warningDuration += Math.abs(statusAreaEnd - statusAreaStart);
            } else {
              criticalDuration += Math.abs(statusAreaEnd - statusAreaStart);
            }
          }
        });

        if (selectedOpenPeriod && openPeriod.id === selectedOpenPeriod.id) {
          const selectedIncidentColor =
            incidentColor === theme.colors.yellow400
              ? theme.colors.yellow100
              : theme.colors.red100;

          // Is areaSeries used anywhere?
          areaSeries.push({
            seriesName: '',
            type: 'line',
            markArea: MarkArea({
              silent: true,
              itemStyle: {
                color: color(selectedIncidentColor).alpha(0.42).rgb().string(),
              },
              data: [[{xAxis: incidentStartDate}, {xAxis: incidentCloseDate}]],
            }),
            data: [],
          });
        }
      });
  }
  if (anomalies) {
    series.push(...getAnomalyMarkerSeries(anomalies, {startDate, endDate, theme}));
  }
  let maxThresholdValue = 0;
  if (
    detector.config.detectionType === 'static' &&
    typeof warningCondition?.comparison === 'number'
  ) {
    const warningThreshold = warningCondition.comparison;
    const warningThresholdLine = createThresholdSeries(
      theme.colors.yellow400,
      warningThreshold
    );
    series.push(warningThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, warningThreshold);
  }

  if (
    detector.config.detectionType === 'static' &&
    typeof criticalCondition?.comparison === 'number'
  ) {
    const criticalThreshold = criticalCondition.comparison;
    const criticalThresholdLine = createThresholdSeries(
      theme.colors.red400,
      criticalThreshold
    );
    series.push(criticalThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, criticalThreshold);
  }

  if (
    detector.config.detectionType === 'static' &&
    typeof resolutionCondition?.comparison === 'number'
  ) {
    const resolveThresholdLine = createThresholdSeries(
      theme.colors.green400,
      resolutionCondition.comparison
    );
    series.push(resolveThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, resolutionCondition.comparison);
  }

  const yAxis: YAXisComponentOption = {
    axisLabel: {
      formatter: (value: number) =>
        alertAxisFormatter(value, timeseriesData[0]!.seriesName, snubaQuery.aggregate),
    },
    max: isCrashFreeAlert(snubaQuery.dataset)
      ? 100
      : maxThresholdValue > maxSeriesValue
        ? maxThresholdValue
        : undefined,
    min: minChartValue || undefined,
  };

  return {
    criticalDuration,
    warningDuration,
    waitingForDataDuration,
    totalDuration,
    chartOption: {
      isGroupedByDate: true,
      yAxis,
      series,
      grid: {
        left: space(0.25),
        right: space(2),
        top: space(3),
        bottom: 0,
      },
    },
  };
}

function getWaitingForDataRange(dataArr: any) {
  if (dataArr[0].value > 0) {
    return {startIndex: 0, endIndex: 0};
  }

  for (let i = 0; i < dataArr.length; i++) {
    const dataPoint = dataArr[i];
    if (dataPoint.value > 0) {
      return {startIndex: 0, endIndex: i - 1};
    }
  }

  return {startIndex: 0, endIndex: dataArr.length - 1};
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
