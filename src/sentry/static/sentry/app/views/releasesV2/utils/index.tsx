import round from 'lodash/round';

import {ProgressColorFunction} from 'app/components/progressRing';

const HEALTH_RED_THRESHOLD = 98;
const HEALTH_ORANGE_THRESHOLD = 99.5;

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
  if (percent < 1 && percent > 0) {
    return `<1%`;
  }

  const rounded = getCrashFreePercent(percent, decimalThreshold, decimalPlaces);

  return `${rounded}%`;
};

export const convertAdoptionToProgress = (
  percent: number,
  numberOfProgressUnits = 5
): number => Math.ceil((percent * numberOfProgressUnits) / 100);

export const getCrashFreePercentColor = ({
  percent,
  theme,
}: ProgressColorFunction): string => {
  if (percent < HEALTH_RED_THRESHOLD) {
    return theme.red;
  }

  if (percent < HEALTH_ORANGE_THRESHOLD) {
    return theme.yellowOrange;
  }

  return theme.green;
};
