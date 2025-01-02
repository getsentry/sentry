import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

const AGGREGATE_ALIAS_VALUE_EXTRACT_PATTERN = /(\d+)$/;
const FUNCTION_FIELD_VALUE_EXTRACT_PATTERN = /(\d+)\)$/;

/**
 * Convert a discover response into a barchart compatible series
 */
export function transformData(
  data: Record<string, number>[],
  useAggregateAlias: boolean = true
) {
  const extractedData = Object.keys(data[0]!)
    .map((key: string) => {
      const nameMatch = (
        useAggregateAlias
          ? AGGREGATE_ALIAS_VALUE_EXTRACT_PATTERN
          : FUNCTION_FIELD_VALUE_EXTRACT_PATTERN
      ).exec(key);
      if (!nameMatch) {
        return [-1, -1];
      }
      let nameValue = Number(nameMatch[1]);
      if (nameValue > 100) {
        nameValue /= 10;
      }
      return [nameValue, data[0]![key]!];
    })
    .filter(i => i[0]! > 0);

  extractedData.sort((a, b) => {
    if (a[0]! > b[0]!) {
      return 1;
    }
    if (a[0]! < b[0]!) {
      return -1;
    }
    return 0;
  });

  return [
    {
      seriesName: t('Duration'),
      data: extractedData.map(i => ({value: i[1]!, name: `${i[0]!.toLocaleString()}%`})),
    },
  ];
}

export function getPercentiles(organization: Organization) {
  const isUsingMetrics = canUseMetricsData(organization);
  const METRICS_PERCENTILES = ['0.25', '0.50', '0.75', '0.90', '0.95', '0.99', '1'];
  const INDEXED_PERCENTILES = [
    '0.10',
    '0.25',
    '0.50',
    '0.75',
    '0.90',
    '0.95',
    '0.99',
    '0.995',
    '0.999',
    '1',
  ];
  return isUsingMetrics ? METRICS_PERCENTILES : INDEXED_PERCENTILES;
}
