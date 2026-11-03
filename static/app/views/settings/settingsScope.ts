import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';

export type SettingsScope = 'account' | 'org' | 'project';

export function getSettingsScopeTitle(scope: SettingsScope): string {
  switch (scope) {
    case 'account':
      return t('Account Settings');
    case 'project':
      return t('Project Settings');
    case 'org':
      return t('Org Settings');
    default:
      return unreachable(scope);
  }
}
