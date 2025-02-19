import MarkLine from 'sentry/components/charts/components/markLine';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {MINUTE} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';
import type {
  AlertRuleThresholdType,
  Trigger,
} from 'sentry/views/alerts/rules/metric/types';
import {AlertRuleTriggerType} from 'sentry/views/alerts/rules/metric/types';
import {getChangeStatus} from 'sentry/views/alerts/utils/getChangeStatus';

export const getComparisonMarkLines = (
  timeseriesData: Series[] = [],
  comparisonTimeseriesData: Series[] = [],
  timeWindow: number,
  triggers: Trigger[],
  thresholdType: AlertRuleThresholdType
): LineChartSeries[] => {
  const changeStatuses: Array<{name: number | string; status: string}> = [];

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
        (baseData[changeData.length - 1]!.name as number) - timeWindow * MINUTE;
      changeData.forEach(({name, value: comparisonValue}, idx) => {
        const baseValue = baseData[idx]!.value;
        const comparisonPercentage =
          comparisonValue === 0
            ? baseValue === 0
              ? 0
              : Infinity
            : ((baseValue - comparisonValue) / comparisonValue) * 100;
        const status = getChangeStatus(comparisonPercentage, thresholdType, triggers);
        if (
          idx === 0 ||
          idx === changeData.length - 1 ||
          status !== changeStatuses[changeStatuses.length - 1]!.status
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
                  Math.min(changeStatuses[idx + 1]!.name as number, lastPointLimit),
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
