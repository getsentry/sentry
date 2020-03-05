import round from 'lodash/round';

export const displayCrashFreePercent = (
  percent: number,
  decimalThreshold = 95,
  decimalPlaces = 3
): string => {
  const rounded = round(percent, percent > decimalThreshold ? decimalPlaces : 0);

  return `${rounded}%`;
};
