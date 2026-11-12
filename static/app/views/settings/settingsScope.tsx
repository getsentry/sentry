import type {ReactElement} from 'react';
import {IconBuilding} from '@sentry/icons/building';
import {IconProject} from '@sentry/icons/project';
import {IconUser} from '@sentry/icons/user';

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
      return t('Organization Settings');
    default:
      return unreachable(scope);
  }
}

/**
 * The icon that stands for a settings scope wherever the scope is listed, e.g.
 * the settings navigation rail and the cmd+k settings groups.
 */
export function getSettingsScopeIcon(scope: SettingsScope): ReactElement {
  switch (scope) {
    case 'account':
      return <IconUser />;
    case 'project':
      return <IconProject />;
    case 'org':
      return <IconBuilding />;
    default:
      return unreachable(scope);
  }
}
