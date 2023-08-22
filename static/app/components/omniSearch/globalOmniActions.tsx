import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {
  IconAdd,
  IconArrow,
  IconBroadcast,
  IconChevron,
  IconDashboard,
  IconDiamond,
  IconDiscord,
  IconDocs,
  IconGithub,
  IconProject,
  IconSiren,
  IconTimer,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import PreferenceStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {useOmniActions} from './useOmniActions';
import {useOmniAreas} from './useOmniAreas';

/**
 * Hook which registers omni-actions which are globally available
 */
export function useGlobalOmniActions() {
  useOmniAreas([
    {key: 'navigate', label: t('Navigate')},
    {key: 'add', label: t('Add...')},
    {key: 'help', label: t('Help')},
    {key: 'other', label: t('Other')},
  ]);

  const {theme} = useLegacyStore(ConfigStore);
  const {collapsed: sidebarCollapsed} = useLegacyStore(PreferenceStore);

  useOmniActions([
    {
      key: 'add-project',
      areaKey: 'add',
      label: t('Create new Project'),
      actionIcon: IconProject,
      to: normalizeUrl('/projects/new/'),
    },
    {
      key: 'add-dashboard',
      areaKey: 'add',
      label: t('Create a Dashboard'),
      actionIcon: IconDashboard,
      to: normalizeUrl('/dashboards/new/'),
    },
    {
      key: 'add-alert',
      areaKey: 'add',
      label: t('Create new Alert'),
      actionIcon: IconSiren,
      to: normalizeUrl('/alerts/wizard/'),
    },
    {
      key: 'add-monitor',
      areaKey: 'add',
      label: t('Add new Monitor'),
      actionIcon: IconTimer,
      to: normalizeUrl('/crons/create/'),
    },
    {
      key: 'add-integration',
      areaKey: 'add',
      label: t('Connect Integration'),
      actionIcon: IconAdd,
      to: normalizeUrl('/settings/integrations/'),
    },
    {
      key: 'add-team-member',
      areaKey: 'add',
      label: t('Invite Team Member'),
      actionIcon: IconUser,
      onAction: () => openInviteMembersModal(),
    },
    {
      key: 'nav-account-settings',
      areaKey: 'navigate',
      label: t('Account Settings'),
      actionIcon: props => <IconArrow {...props} direction="right" />,
      to: normalizeUrl('/settings/account/'),
    },
    {
      key: 'open-docs',
      areaKey: 'help',
      label: t('Open Docs'),
      actionIcon: IconDocs,
      to: 'https://docs.sentry.io',
    },
    {
      key: 'create-gh-ticket',
      areaKey: 'help',
      label: t('File a GitHub ticket'),
      actionIcon: IconGithub,
      to: 'https://github.com/getsentry/sentry/issues/new/choose',
    },
    {
      key: 'join-discord',
      areaKey: 'help',
      label: t("Join Sentry's Discord Community"),
      actionIcon: IconDiscord,
      to: 'https://discord.com/invite/sentry',
    },
    {
      key: 'changelog',
      areaKey: 'help',
      label: t('View Changelog'),
      actionIcon: IconBroadcast,
      to: 'https://changelog.getsentry.net',
    },
    {
      key: 'toggle-theme',
      areaKey: 'other',
      label: theme === 'light' ? t('Switch to Dark Mode') : t('Switch to Light Mode'),
      actionIcon: IconDiamond,
      onAction: () => ConfigStore.set('theme', theme === 'dark' ? 'light' : 'dark'),
    },
    {
      key: 'toggle-sidebar',
      areaKey: 'other',
      label: sidebarCollapsed ? t('Expand Sidebar') : t('Collapse Sidebar'),
      actionIcon: props => (
        <IconChevron {...props} direction={sidebarCollapsed ? 'right' : 'left'} />
      ),
      onAction: sidebarCollapsed
        ? PreferenceStore.showSidebar
        : PreferenceStore.hideSidebar,
    },
  ]);
}
