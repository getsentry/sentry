import color from 'color';
import type {YAXisComponentOption} from 'echarts';
import moment from 'moment';
import momentTimezone from 'moment-timezone';

import type {AreaChartProps, AreaChartSeries} from 'sentry/components/charts/areaChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {SessionApiResponse} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {formatMRIField} from 'sentry/utils/metrics/mri';
import {getCrashFreeRateSeries} from 'sentry/utils/sessions';
import {lightTheme as theme} from 'sentry/utils/theme';
import {
  AlertRuleTriggerType,
  Dataset,
  MetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {Incident, IncidentActivityType, IncidentStatus} from 'sentry/views/alerts/types';
import {
  ALERT_CHART_MIN_MAX_BUFFER,
  alertAxisFormatter,
  alertTooltipValueFormatter,
  SESSION_AGGREGATE_TO_FIELD,
  shouldScaleAlertChart,
} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import {isCrashFreeAlert} from '../utils/isCrashFreeAlert';

function formatTooltipDate(date: moment.MomentInput, format: string): string {
  const {
    options: {timezone},
  } = ConfigStore.get('user');
  return momentTimezone.tz(date, timezone).format(format);
}

function createStatusAreaSeries(
  lineColor: string,
  startTime: number,
  endTime: number,
  yPosition: number
): AreaChartSeries {
  return {
    seriesName: '',
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
  incident: Incident,
  lineColor: string,
  incidentTimestamp: number,
  dataPoint?: AreaChartSeries['data'][0],
  seriesName?: string,
  aggregate?: string,
  handleIncidentClick?: (incident: Incident) => void
): AreaChartSeries {
  const formatter = ({value, marker}: any) => {
    const time = formatTooltipDate(moment(value), 'MMM D, YYYY LT');
    return [
      `<div class="tooltip-series"><div>`,
      `<span class="tooltip-label">${marker} <strong>${t('Alert')} #${
        incident.identifier
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
          // @ts-expect-error onClick not in echart types
          onClick: () => handleIncidentClick?.(incident),
        },
      ],
      label: {
        silent: true,
        show: !!incident.identifier,
        position: 'insideEndBottom',
        formatter: incident.identifier,
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

export type MetricChartData = {
  rule: MetricRule;
  timeseriesData: Series[];
  handleIncidentClick?: (incident: Incident) => void;
  incidents?: Incident[];
  selectedIncident?: Incident | null;
  showWaitingForData?: boolean;
};

type MetricChartOption = {
  chartOption: AreaChartProps;
  criticalDuration: number;
  totalDuration: number;
  waitingForDataDuration: number;
  warningDuration: number;
};

export function getMetricAlertChartOption({
  timeseriesData,
  rule,
  incidents,
  selectedIncident,
  handleIncidentClick,
  showWaitingForData,
}: MetricChartData): MetricChartOption {
  const criticalTrigger = rule.triggers.find(
    ({label}) => label === AlertRuleTriggerType.CRITICAL
  );
  const warningTrigger = rule.triggers.find(
    ({label}) => label === AlertRuleTriggerType.WARNING
  );

  const series: AreaChartSeries[] = timeseriesData.map(s => ({
    ...s,
    seriesName: s.seriesName && formatMRIField(s.seriesName),
  }));
  const areaSeries: AreaChartSeries[] = [];
  // Ensure series data appears below incident/mark lines
  series[0].z = 1;
  series[0].color = CHART_PALETTE[0][0];

  const dataArr = timeseriesData[0].data;
  const maxSeriesValue = dataArr.reduce(
    (currMax, coord) => Math.max(currMax, coord.value),
    0
  );
  // find the lowest value between chart data points, warning threshold,
  // critical threshold and then apply some breathing space
  const minChartValue = shouldScaleAlertChart(rule.aggregate)
    ? Math.floor(
        Math.min(
          dataArr.reduce((currMax, coord) => Math.min(currMax, coord.value), Infinity),
          typeof warningTrigger?.alertThreshold === 'number'
            ? warningTrigger.alertThreshold
            : Infinity,
          typeof criticalTrigger?.alertThreshold === 'number'
            ? criticalTrigger.alertThreshold
            : Infinity
        ) / ALERT_CHART_MIN_MAX_BUFFER
      )
    : 0;
  const firstPoint = new Date(dataArr[0]?.name).getTime();
  const lastPoint = new Date(dataArr[dataArr.length - 1]?.name).getTime();
  const totalDuration = lastPoint - firstPoint;
  let waitingForDataDuration = 0;
  let criticalDuration = 0;
  let warningDuration = 0;

  series.push(
    createStatusAreaSeries(theme.green300, firstPoint, lastPoint, minChartValue)
  );

  if (showWaitingForData) {
    const {startIndex, endIndex} = getWaitingForDataRange(dataArr);
    const startTime = new Date(dataArr[startIndex]?.name).getTime();
    const endTime = new Date(dataArr[endIndex]?.name).getTime();

    waitingForDataDuration = Math.abs(endTime - startTime);

    series.push(createStatusAreaSeries(theme.gray200, startTime, endTime, minChartValue));
  }

  if (incidents) {
    // select incidents that fall within the graph range
    incidents
      .filter(
        incident =>
          !incident.dateClosed || new Date(incident.dateClosed).getTime() > firstPoint
      )
      .forEach(incident => {
        const activities = incident.activities ?? [];
        const statusChanges = activities
          .filter(
            ({type, value}) =>
              type === IncidentActivityType.STATUS_CHANGE &&
              [IncidentStatus.WARNING, IncidentStatus.CRITICAL].includes(Number(value))
          )
          .sort(
            (a, b) =>
              new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
          );

        const incidentEnd = incident.dateClosed ?? new Date().getTime();

        const timeWindowMs = rule.timeWindow * 60 * 1000;
        const incidentColor =
          warningTrigger &&
          !statusChanges.find(({value}) => Number(value) === IncidentStatus.CRITICAL)
            ? theme.yellow300
            : theme.red300;

        const incidentStartDate = new Date(incident.dateStarted).getTime();
        const incidentCloseDate = incident.dateClosed
          ? new Date(incident.dateClosed).getTime()
          : lastPoint;
        const incidentStartValue = dataArr.find(
          point => new Date(point.name).getTime() >= incidentStartDate
        );
        series.push(
          createIncidentSeries(
            incident,
            incidentColor,
            incidentStartDate,
            incidentStartValue,
            series[0].seriesName,
            rule.aggregate,
            handleIncidentClick
          )
        );
        const areaStart = Math.max(new Date(incident.dateStarted).getTime(), firstPoint);
        const areaEnd = Math.min(
          statusChanges.length && statusChanges[0].dateCreated
            ? new Date(statusChanges[0].dateCreated).getTime() - timeWindowMs
            : new Date(incidentEnd).getTime(),
          lastPoint
        );
        const areaColor = warningTrigger ? theme.yellow300 : theme.red300;
        if (areaEnd > areaStart) {
          series.push(
            createStatusAreaSeries(areaColor, areaStart, areaEnd, minChartValue)
          );

          if (areaColor === theme.yellow300) {
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
              : new Date(statusChanges[idx + 1].dateCreated).getTime() - timeWindowMs,
            lastPoint
          );
          const statusAreaColor =
            activity.value === `${IncidentStatus.CRITICAL}`
              ? theme.red300
              : theme.yellow300;
          if (statusAreaEnd > statusAreaStart) {
            series.push(
              createStatusAreaSeries(
                statusAreaColor,
                statusAreaStart,
                statusAreaEnd,
                minChartValue
              )
            );
            if (statusAreaColor === theme.yellow300) {
              warningDuration += Math.abs(statusAreaEnd - statusAreaStart);
            } else {
              criticalDuration += Math.abs(statusAreaEnd - statusAreaStart);
            }
          }
        });

        if (selectedIncident && incident.id === selectedIncident.id) {
          const selectedIncidentColor =
            incidentColor === theme.yellow300 ? theme.yellow100 : theme.red100;

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

  let maxThresholdValue = 0;
  if (!rule.comparisonDelta && warningTrigger?.alertThreshold) {
    const {alertThreshold} = warningTrigger;
    const warningThresholdLine = createThresholdSeries(theme.yellow300, alertThreshold);
    series.push(warningThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
  }

  if (!rule.comparisonDelta && criticalTrigger?.alertThreshold) {
    const {alertThreshold} = criticalTrigger;
    const criticalThresholdLine = createThresholdSeries(theme.red300, alertThreshold);
    series.push(criticalThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
  }

  if (!rule.comparisonDelta && rule.resolveThreshold) {
    const resolveThresholdLine = createThresholdSeries(
      theme.green300,
      rule.resolveThreshold
    );
    series.push(resolveThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, rule.resolveThreshold);
  }

  const yAxis: YAXisComponentOption = {
    axisLabel: {
      formatter: (value: number) =>
        alertAxisFormatter(value, timeseriesData[0].seriesName, rule.aggregate),
    },
    max: isCrashFreeAlert(rule.dataset)
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

function getWaitingForDataRange(dataArr) {
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
  rule: MetricRule
): MetricChartData['timeseriesData'] {
  const {aggregate} = rule;

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
        SESSION_AGGREGATE_TO_FIELD[aggregate]
      ),
    },
  ];
}
