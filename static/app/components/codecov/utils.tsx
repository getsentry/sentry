import {CODECOV_DEFAULT_RELATIVE_PERIODS} from './datePicker/datePicker';

// Date Picker Utils Start

/**
 * Determines if a period is valid for a Codecov DatePicker component. A period is invalid if
 * it is null or if it doesn't belong to the list of Codecov default relative periods.
 */
export function isValidCodecovRelativePeriod(period: string | null): boolean {
  if (period === null) {
    return false;
  }

  if (!Object.hasOwn(CODECOV_DEFAULT_RELATIVE_PERIODS, period)) {
    return false;
  }

  return true;
}

// Date Picker Utils End
