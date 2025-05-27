import HookOrDefault from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => children,
});

export function TeamRoleColumnLabel() {
  return <LabelHook id="team-roles-upsell">{t('Team Roles')}</LabelHook>;
}
