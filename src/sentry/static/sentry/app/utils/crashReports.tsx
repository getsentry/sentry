import React from 'react';

import {t, tct} from 'app/locale';

export function formatStoreCrashReports(
  value: number | null | '',
  organizationValue?: number
): React.ReactNode {
  if (value === null && organizationValue) {
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
  // "Disabled" option at the beginning
  const values: Array<number | null> = [
    0, // disabled
    1,
    5,
    10,
    20, // limited per issue
    -1, // unlimited
  ];

  if (settingScope === SettingScope.Project) {
    // "Inherit" option after disabled.
    values.unshift(null);
  }

  return values;
}
