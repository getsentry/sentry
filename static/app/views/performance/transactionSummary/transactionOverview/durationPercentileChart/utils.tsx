import {t} from 'sentry/locale';

const AGGREGATE_ALIAS_VALUE_EXTRACT_PATTERN = /(\d+)$/;
const FUNCTION_FIELD_VALUE_EXTRACT_PATTERN = /(\d+)\)$/;

/**
 * Convert a discover response into a barchart compatible series
 */
export function transformData(
  data: Record<string, number>[],
  useAggregateAlias: boolean = true
) {
  const extractedData = Object.keys(data[0])
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
      return [nameValue, data[0][key]];
    })
    .filter(i => i[0] > 0);

  extractedData.sort((a, b) => {
    if (a[0] > b[0]) {
      return 1;
    }
    if (a[0] < b[0]) {
      return -1;
    }
    return 0;
  });

  return [
    {
      seriesName: t('Duration'),
      data: extractedData.map(i => ({value: i[1], name: `${i[0].toLocaleString()}%`})),
    },
  ];
}
