import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

/**
 * Format the Z-axis value shown for a heat map cell in its tooltip. The Z value
 * is the cell's aggregate result (always a count).
 */
export function formatTooltipZAxisValue(value: number): string {
  return formatAbbreviatedNumber(value, 4, false);
}
