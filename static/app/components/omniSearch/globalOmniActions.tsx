import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {useOmniActions} from 'sentry/components/omniSearch/useOmniActions';
import {
  IconDashboard,
  IconDiscord,
  IconDocs,
  IconGithub,
  IconGraph,
  IconIssues,
  IconMoon,
  IconPrevent,
  IconSearch,
  IconSettings,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';

const GlobalActionSection = {
  HELP: t('Help'),
  ADD: t('Add'),
  NAVIGATE: t('Go to…'),
  OTHER: t('Other'),
};

function useNavigationActions() {
  const organization = useOrganization();
  const slug = organization.slug;
  const prefix = `/organizations/${slug}`;
  const features = new Set(organization.features ?? []);
  const exploreDefault = getDefaultExploreRoute(organization);

  const issuesChildren = [
    {
      key: 'nav-issues-feed',
      areaKey: 'navigate',
      label: t('Feed'),
      to: `${prefix}/issues/`,
    },
    {
      key: 'nav-issues-feedback',
      areaKey: 'navigate',
      label: t('User Feedback'),
      to: `${prefix}/issues/feedback/`,
    },
    {
      key: 'nav-issues-all-views',
      areaKey: 'navigate',
      label: t('All Views'),
      to: `${prefix}/issues/views/`,
    },
  ];

  const exploreChildren = [
    {
      key: 'nav-explore-traces',
      areaKey: 'navigate',
      label: t('Traces'),
      to: `${prefix}/explore/traces/`,
    },
    ...(features.has('ourlogs-enabled')
      ? [
          {
            key: 'nav-explore-logs',
            areaKey: 'navigate',
            label: t('Logs'),
            to: `${prefix}/explore/logs/`,
          },
        ]
      : []),
    {
      key: 'nav-explore-discover',
      areaKey: 'navigate',
      label: t('Discover'),
      to: `${prefix}/explore/discover/homepage/`,
    },
    ...(features.has('profiling')
      ? [
          {
            key: 'nav-explore-profiles',
            areaKey: 'navigate',
            label: t('Profiles'),
            to: `${prefix}/explore/profiling/`,
          },
        ]
      : []),
    ...(features.has('session-replay-ui')
      ? [
          {
            key: 'nav-explore-replays',
            areaKey: 'navigate',
            label: t('Replays'),
            to: `${prefix}/explore/replays/`,
          },
        ]
      : []),
    {
      key: 'nav-explore-releases',
      areaKey: 'navigate',
      label: t('Releases'),
      to: `${prefix}/explore/releases/`,
    },
    {
      key: 'nav-explore-all-queries',
      areaKey: 'navigate',
      label: t('All Queries'),
      to: `${prefix}/explore/saved-queries/`,
    },
  ];

  const dashboardsChildren = [
    {
      key: 'nav-dashboards-all',
      areaKey: 'navigate',
      label: t('All Dashboards'),
      to: `${prefix}/dashboards/`,
    },
  ];

  const insightsChildren = [
    {
      key: 'nav-insights-frontend',
      areaKey: 'navigate',
      label: t('Frontend'),
      to: `${prefix}/insights/frontend/`,
    },
    {
      key: 'nav-insights-backend',
      areaKey: 'navigate',
      label: t('Backend'),
      to: `${prefix}/insights/backend/`,
    },
    {
      key: 'nav-insights-mobile',
      areaKey: 'navigate',
      label: t('Mobile'),
      to: `${prefix}/insights/mobile/`,
    },
    {
      key: 'nav-insights-crons',
      areaKey: 'navigate',
      label: t('Crons'),
      to: `${prefix}/insights/crons/`,
    },
    ...(features.has('uptime')
      ? [
          {
            key: 'nav-insights-uptime',
            areaKey: 'navigate',
            label: t('Uptime'),
            to: `${prefix}/insights/uptime/`,
          },
        ]
      : []),
    {
      key: 'nav-insights-projects',
      areaKey: 'navigate',
      label: t('All Projects'),
      to: `${prefix}/insights/projects/`,
    },
  ];

  const preventChildren = [
    ...(features.has('codecov-ui')
      ? [
          {
            key: 'nav-prevent-coverage',
            areaKey: 'navigate',
            label: t('Coverage'),
            to: `${prefix}/prevent/coverage/commits/`,
          },
          {
            key: 'nav-prevent-tests',
            areaKey: 'navigate',
            label: t('Tests'),
            to: `${prefix}/prevent/tests/`,
          },
        ]
      : []),
    {
      key: 'nav-prevent-ai',
      areaKey: 'navigate',
      label: t('Prevent AI'),
      to: `${prefix}/prevent/prevent-ai/new/`,
    },
    ...(features.has('codecov-ui')
      ? [
          {
            key: 'nav-prevent-tokens',
            areaKey: 'navigate',
            label: t('Tokens'),
            to: `${prefix}/prevent/tokens/`,
          },
        ]
      : []),
  ];

  return [
    {
      key: 'nav-issues',
      areaKey: 'navigate',
      section: GlobalActionSection.NAVIGATE,
      label: t('Issues'),
      actionIcon: <IconIssues />,
      to: `${prefix}/issues/`,
      children: issuesChildren,
    },
    {
      key: 'nav-explore',
      areaKey: 'navigate',
      section: GlobalActionSection.NAVIGATE,
      label: t('Explore'),
      actionIcon: <IconSearch />,
      to: `${prefix}/explore/${exploreDefault}/`,
      children: exploreChildren,
    },
    {
      key: 'nav-dashboards',
      areaKey: 'navigate',
      section: GlobalActionSection.NAVIGATE,
      label: t('Dashboards'),
      actionIcon: <IconDashboard />,
      to: `${prefix}/dashboards/`,
      children: dashboardsChildren,
    },
    ...(features.has('performance-view')
      ? [
          {
            key: 'nav-insights',
            areaKey: 'navigate',
            section: GlobalActionSection.NAVIGATE,
            label: t('Insights'),
            actionIcon: <IconGraph type="area" />,
            to: `${prefix}/insights/`,
            children: insightsChildren,
          },
        ]
      : []),
    ...(features.has('prevent-ai')
      ? [
          {
            key: 'nav-prevent',
            areaKey: 'navigate',
            section: GlobalActionSection.NAVIGATE,
            label: t('Prevent'),
            actionIcon: <IconPrevent />,
            to: `${prefix}/prevent/prevent-ai/new/`,
            children: preventChildren,
          },
        ]
      : []),
    {
      key: 'nav-settings',
      areaKey: 'navigate',
      section: GlobalActionSection.NAVIGATE,
      label: t('Settings'),
      actionIcon: <IconSettings />,
      to: `/settings/${slug}/`,
    },
  ];
}

/**
 * Registers globally-available OmniSearch areas and actions.
 */
export function useGlobalOmniActions() {
  const {mutateAsync: mutateUserOptions} = useMutateUserOptions();
  const navigateActions = useNavigationActions();

  const config = useLegacyStore(ConfigStore);

  useOmniActions([
    ...navigateActions,
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
