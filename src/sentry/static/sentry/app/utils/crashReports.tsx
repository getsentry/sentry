import {t, tct} from 'app/locale';

export function formatStoreCrashReports(value: number | ''): React.ReactNode {
  if (value === -1) {
    return t('Unlimited');
  } else if (value === 0) {
    return t('Disabled');
  } else {
    return tct('[value] per issue', {value});
  }
}

function getStoreCrashReportsValues() {
  // generate a range from 0 (disabled) to 20 inclusive
  const values = Array.from(new Array(21), (_, i) => i);
  values.push(-1); // special "Unlimited" at the end
  return values;
}

export const STORE_CRASH_REPORTS_VALUES = getStoreCrashReportsValues();
