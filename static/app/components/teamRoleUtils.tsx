import {Fragment} from 'react';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export function TeamRoleColumnLabel() {
  return <LabelHook id="team-roles-upsell">{t('Team Roles')}</LabelHook>;
}
