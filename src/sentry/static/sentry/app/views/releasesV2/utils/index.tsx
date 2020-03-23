import round from 'lodash/round';

export const getCrashFreePercent = (
  percent: number,
  decimalThreshold = 95,
  decimalPlaces = 3
): number => {
  return round(percent, percent > decimalThreshold ? decimalPlaces : 0);
};

export const displayCrashFreePercent = (
  percent: number,
  decimalThreshold = 95,
  decimalPlaces = 3
): string => {
  const rounded = getCrashFreePercent(percent, decimalThreshold, decimalPlaces);

  return `${rounded}%`;
};

export const convertAdoptionToProgress = (
  percent: number,
  numberOfProgressUnits = 5
): number => Math.ceil((percent * numberOfProgressUnits) / 100);
