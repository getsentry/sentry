import {Fragment} from 'react';

import {t} from 'sentry/locale';

import {OverrideOrDefault} from './overrideOrDefault';

const LabelHook = OverrideOrDefault({
  overrideName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export function TeamRoleColumnLabel() {
  return <LabelHook id="team-roles-upsell">{t('Team Roles')}</LabelHook>;
}
