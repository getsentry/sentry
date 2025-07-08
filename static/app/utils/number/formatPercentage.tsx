import round from 'lodash/round';

/**
 * Format a value between 0 and 1 as a percentage
 */

export function formatPercentage(
  value: number,
  places = 2,
  options: {
    minimumValue?: number;
    nullValue?: string;
  } = {}
) {
  if (value === 0) {
    return '0%';
  }

  if (value === undefined || value === null) {
    return options.nullValue ?? '0%';
  }

  const minimumValue = options.minimumValue ?? 0;

  if (Math.abs(value) <= minimumValue) {
    return `<${minimumValue * 100}%`;
  }

  return (
    round(value * 100, places).toLocaleString(undefined, {
      maximumFractionDigits: places,
    }) + '%'
  );
}
