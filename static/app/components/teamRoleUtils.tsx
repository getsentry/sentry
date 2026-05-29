import {Fragment} from 'react';

import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {t} from 'sentry/locale';

const LabelHook = OverrideOrDefault({
  overrideName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export function TeamRoleColumnLabel() {
  return <LabelHook id="team-roles-upsell">{t('Team Roles')}</LabelHook>;
}
