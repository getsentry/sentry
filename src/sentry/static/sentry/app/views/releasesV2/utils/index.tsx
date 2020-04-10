import round from 'lodash/round';

import ProgressRing from 'app/components/progressRing';

const CRASH_FREE_DANGER_THRESHOLD = 98;
const CRASH_FREE_WARNING_THRESHOLD = 99.5;

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
  if (isNaN(percent)) {
    return '\u2015';
  }

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

type ProgressRingColorFn = React.ComponentProps<typeof ProgressRing>['progressColor'];
export const getCrashFreePercentColor: ProgressRingColorFn = ({percent, theme}) => {
  if (percent < CRASH_FREE_DANGER_THRESHOLD) {
    return theme.red;
  }

  if (percent < CRASH_FREE_WARNING_THRESHOLD) {
    return theme.yellow;
  }

  return theme.green;
};
