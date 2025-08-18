import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {useOmniActions} from 'sentry/components/omniSearch/useOmniActions';
import {useOmniAreas} from 'sentry/components/omniSearch/useOmniAreas';
import {IconDiamond, IconDiscord, IconDocs, IconGithub, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

const GlobalActionSection = {
  HELP: t('Help'),
  ADD: t('Add'),
  NAVIGATE: t('Go to…'),
  OTHER: t('Other'),
};

/**
 * Registers globally-available OmniSearch areas and actions.
 */
export function useGlobalOmniActions() {
  // Define high-level areas for organization
  useOmniAreas([
    {key: 'add', label: t('Add')},
    {key: 'navigate', label: t('Go to…')},
    {key: 'help', label: t('Help')},
    {key: 'other', label: t('Other')},
  ]);

  const config = useLegacyStore(ConfigStore);

  useOmniActions([
    // Help: Documentation
    {
      key: 'help-docs',
      areaKey: 'global',
      section: GlobalActionSection.HELP,
      label: t('Open Documentation'),
      actionIcon: IconDocs,
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    },
    // Help: Discord
    {
      key: 'help-discord',
      areaKey: 'global',
      section: GlobalActionSection.HELP,
      label: t('Join Discord'),
      actionIcon: IconDiscord,
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    },
    // Help: GitHub
    {
      key: 'help-github',
      areaKey: 'global',
      section: GlobalActionSection.HELP,
      label: t('Open GitHub Repository'),
      actionIcon: IconGithub,
      onAction: () =>
        window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
    },
    // Add: Invite members
    {
      key: 'add-invite-members',
      areaKey: 'global',
      section: GlobalActionSection.ADD,
      label: t('Invite Members'),
      actionIcon: IconUser,
      onAction: () => openInviteMembersModal(),
    },
    // Other: Toggle theme
    {
      key: 'other-toggle-theme',
      areaKey: 'global',
      section: GlobalActionSection.OTHER,
      label: t(
        'Toggle Theme (%s → %s)',
        config.theme === 'light' ? 'Light' : 'Dark',
        config.theme === 'light' ? 'Dark' : 'Light'
      ),
      actionIcon: IconDiamond,
      actionHotkey: 'command+shift+l',
      onAction: () =>
        ConfigStore.set('theme', config.theme === 'light' ? 'dark' : 'light'),
    },
  ]);
}
