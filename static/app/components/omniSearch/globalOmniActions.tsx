import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {useOmniActions} from 'sentry/components/omniSearch/useOmniActions';
import {useOmniAreas} from 'sentry/components/omniSearch/useOmniAreas';
import {
  IconDiscord,
  IconDocs,
  IconGithub,
  IconMoon,
  IconSettings,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';

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
  const {mutateAsync: mutateUserOptions} = useMutateUserOptions();

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
      actionIcon: <IconDocs />,
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    },
    // Help: Discord
    {
      key: 'help-discord',
      areaKey: 'global',
      section: GlobalActionSection.HELP,
      label: t('Join Discord'),
      actionIcon: <IconDiscord />,
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    },
    // Help: GitHub
    {
      key: 'help-github',
      areaKey: 'global',
      section: GlobalActionSection.HELP,
      label: t('Open GitHub Repository'),
      actionIcon: <IconGithub />,
      onAction: () =>
        window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
    },
    // Add: Invite members
    {
      key: 'add-invite-members',
      areaKey: 'global',
      section: GlobalActionSection.ADD,
      label: t('Invite Members'),
      actionIcon: <IconUser />,
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
      actionIcon: <IconMoon />,
      onAction: () =>
        ConfigStore.set('theme', config.theme === 'light' ? 'dark' : 'light'),
    },
    {
      key: 'account-theme-preference',
      areaKey: 'global',
      section: GlobalActionSection.OTHER,
      label: t('Theme Preference'),
      actionIcon: <IconSettings />,
      children: [
        {
          key: 'account-theme-preference-system',
          areaKey: 'global',
          label: t('System'),
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'system'});
            addSuccessMessage(t('Theme preference saved: System'));
          },
        },
        {
          key: 'account-theme-preference-light',
          areaKey: 'global',
          label: t('Light'),
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'light'});
            addSuccessMessage(t('Theme preference saved: Light'));
          },
        },
        {
          key: 'account-theme-preference-dark',
          areaKey: 'global',
          label: t('Dark'),
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'dark'});
            addSuccessMessage(t('Theme preference saved: Dark'));
          },
        },
      ],
    },
  ]);
}
