import MarkLine from 'sentry/components/charts/components/markLine';
import {LineChartSeries} from 'sentry/components/charts/lineChart';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {MINUTE} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';
import {
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Trigger,
} from 'sentry/views/alerts/incidentRules/types';

export const checkChangeStatus = (
  value: number,
  thresholdType: AlertRuleThresholdType,
  triggers: Trigger[]
): string => {
  const criticalTrigger = triggers?.find(
    trig => trig.label === AlertRuleTriggerType.CRITICAL
  );
  const warningTrigger = triggers?.find(
    trig => trig.label === AlertRuleTriggerType.WARNING
  );
  const criticalTriggerAlertThreshold =
    typeof criticalTrigger?.alertThreshold === 'number'
      ? criticalTrigger.alertThreshold
      : undefined;
  const warningTriggerAlertThreshold =
    typeof warningTrigger?.alertThreshold === 'number'
      ? warningTrigger.alertThreshold
      : undefined;

  // Need to catch the critical threshold cases before warning threshold cases
  if (
    thresholdType === AlertRuleThresholdType.ABOVE &&
    criticalTriggerAlertThreshold &&
    value >= criticalTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.CRITICAL;
  }
  if (
    thresholdType === AlertRuleThresholdType.ABOVE &&
    warningTriggerAlertThreshold &&
    value >= warningTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.WARNING;
  }
  // When threshold is below(lower than in comparison alerts) the % diff value is negative
  // It crosses the threshold if its abs value is greater than threshold
  // -80% change crosses below 60% threshold -1 * (-80) > 60
  if (
    thresholdType === AlertRuleThresholdType.BELOW &&
    criticalTriggerAlertThreshold &&
    -1 * value >= criticalTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.CRITICAL;
  }
  if (
    thresholdType === AlertRuleThresholdType.BELOW &&
    warningTriggerAlertThreshold &&
    -1 * value >= warningTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.WARNING;
  }

  return '';
};

export const getComparisonMarkLines = (
  timeseriesData: Series[] = [],
  comparisonTimeseriesData: Series[] = [],
  timeWindow: number,
  triggers: Trigger[],
  thresholdType: AlertRuleThresholdType
): LineChartSeries[] => {
  const changeStatuses: {name: number | string; status: string}[] = [];

  if (
    timeseriesData?.[0]?.data !== undefined &&
    timeseriesData[0].data.length > 1 &&
    comparisonTimeseriesData?.[0]?.data !== undefined &&
    comparisonTimeseriesData[0].data.length > 1
  ) {
    const changeData = comparisonTimeseriesData[0].data;
    const baseData = timeseriesData[0].data;

    if (triggers.some(({alertThreshold}) => typeof alertThreshold === 'number')) {
      const lastPointLimit =
        (baseData[changeData.length - 1].name as number) - timeWindow * MINUTE;
      changeData.forEach(({name, value: comparisonValue}, idx) => {
        const baseValue = baseData[idx].value;
        const comparisonPercentage =
          comparisonValue === 0
            ? baseValue === 0
              ? 0
              : Infinity
            : ((baseValue - comparisonValue) / comparisonValue) * 100;
        const status = checkChangeStatus(comparisonPercentage, thresholdType, triggers);
        if (
          idx === 0 ||
          idx === changeData.length - 1 ||
          status !== changeStatuses[changeStatuses.length - 1].status
        ) {
          changeStatuses.push({name, status});
        }
      });

      return changeStatuses.slice(0, -1).map(({name, status}, idx) => ({
        seriesName: t('status'),
        type: 'line',
        markLine: MarkLine({
          silent: true,
          lineStyle: {
            color:
              status === AlertRuleTriggerType.CRITICAL
                ? theme.red300
                : status === AlertRuleTriggerType.WARNING
                ? theme.yellow300
                : theme.green300,
            type: 'solid',
            width: 4,
          },
          data: [
            [
              {coord: [name, 0]},
              {
                coord: [
                  Math.min(changeStatuses[idx + 1].name as number, lastPointLimit),
                  0,
                ],
              },
            ],
          ],
        }),
        data: [],
      }));
    }
  }

  return [];
};
