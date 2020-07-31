import React from 'react';

import {t, tct} from 'app/locale';

export function formatStoreCrashReports(
  value: number | '',
  organizationValue?: number
): React.ReactNode {
  if (value === -2 && organizationValue) {
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
  const values = [0];

  // "Inherit" option if we are in a project settings
  if (settingScope === SettingScope.Project) {
    values.push(-2);
  }

  // generate a range from 1 to 20 inclusive
  values.push(...Array.from(new Array(20), (_, i) => i + 1));

  // "Unlimited" option at the end
  values.push(-1);

  return values;
}
