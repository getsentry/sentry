import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';

export function formatStoreCrashReports(
  value: number | null | '',
  organizationValue?: number
): React.ReactNode {
  if (value === null && defined(organizationValue)) {
    return tct('Inherit organization settings ([organizationValue])', {
      organizationValue: formatStoreCrashReports(organizationValue),
    });
  }

  if (value === -1) {
    return t('Unlimited');
  }

  if (value === 0) {
    return t('Disabled');
  }

  return tct('[value] per issue', {value});
}

export enum SettingScope {
  Organization,
  Project,
}
export function getStoreCrashReportsValues(settingScope: SettingScope) {
  const values: Array<number | null> = [
    0, // disabled
    1, // limited per issue
    5,
    10,
    20,
    50,
    100,
    -1, // unlimited
  ];

  if (settingScope === SettingScope.Project) {
    values.unshift(null); // inherit option
  }

  return values;
}
