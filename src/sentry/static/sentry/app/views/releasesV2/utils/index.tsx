import round from 'lodash/round';

export const displayCrashFreePercent = (
  percent: number,
  decimalThreshold = 95,
  decimalPlaces = 3
): string => {
  const rounded = round(percent, percent > decimalThreshold ? decimalPlaces : 0);

  return `${rounded}%`;
};

export const convertAdoptionToProgress = (
  percent: number,
  numberOfProgressUnits = 5
): number => {
  const fullProgressPercent = 80; // we consider 80% full adoption

  if (percent > fullProgressPercent) {
    return numberOfProgressUnits;
  }

  return Math.floor((numberOfProgressUnits * percent) / fullProgressPercent);
};
