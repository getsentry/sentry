import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';
import {
  IconAdd,
  IconChevron,
  IconCompass,
  IconDashboard,
  IconDiscord,
  IconDocs,
  IconGithub,
  IconGraph,
  IconIssues,
  IconOpen,
  IconPrevent,
  IconSettings,
  IconStar,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useNavContext} from 'sentry/views/nav/context';
import {useStarredIssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/useStarredIssueViews';

const GlobalActionSection = {
  HELP: t('Help'),
  ADD: t('Add'),
  NAVIGATE: t('Go to…'),
  OTHER: t('Actions'),
};

function useNavigationActions() {
  const organization = useOrganization();
  const slug = organization.slug;
  const prefix = `/organizations/${slug}`;
  const features = new Set(organization.features ?? []);
  const exploreDefault = getDefaultExploreRoute(organization);
  const {starredViews} = useStarredIssueViews();

  const issuesChildren = [
    {
      key: 'nav-issues-feed',
      areaKey: 'global',
      label: t('Feed'),
      to: `${prefix}/issues/`,
    },
    ...Object.values(ISSUE_TAXONOMY_CONFIG).map(config => ({
      key: `nav-issues-${config.key}`,
      areaKey: 'global',
      label: config.label,
      to: `${prefix}/issues/${config.key}/`,
    })),
    {
      key: 'nav-issues-feedback',
      areaKey: 'global',
      label: t('User Feedback'),
      to: `${prefix}/issues/feedback/`,
    },
    {
      key: 'nav-issues-all-views',
      areaKey: 'global',
      label: t('All Views'),
      to: `${prefix}/issues/views/`,
    },
    ...starredViews.map(view => ({
      key: `nav-issues-starred-${view.id}`,
      areaKey: 'global',
      label: view.label,
      actionIcon: <IconStar />,
      to: `${prefix}/issues/views/${view.id}/`,
    })),
  ];

  const exploreChildren = [
    {
      key: 'nav-explore-traces',
      areaKey: 'global',
      label: t('Traces'),
      to: `${prefix}/explore/traces/`,
    },
    ...(features.has('ourlogs-enabled')
      ? [
          {
            key: 'nav-explore-logs',
            areaKey: 'global',
            label: t('Logs'),
            to: `${prefix}/explore/logs/`,
          },
        ]
      : []),
    {
      key: 'nav-explore-discover',
      areaKey: 'global',
      label: t('Discover'),
      to: `${prefix}/explore/discover/homepage/`,
    },
    ...(features.has('profiling')
      ? [
          {
            key: 'nav-explore-profiles',
            areaKey: 'global',
            label: t('Profiles'),
            to: `${prefix}/explore/profiling/`,
          },
        ]
      : []),
    ...(features.has('session-replay-ui')
      ? [
          {
            key: 'nav-explore-replays',
            areaKey: 'global',
            label: t('Replays'),
            to: `${prefix}/explore/replays/`,
          },
        ]
      : []),
    {
      key: 'nav-explore-releases',
      areaKey: 'global',
      label: t('Releases'),
      to: `${prefix}/explore/releases/`,
    },
    {
      key: 'nav-explore-all-queries',
      areaKey: 'global',
      label: t('All Queries'),
      to: `${prefix}/explore/saved-queries/`,
    },
  ];

  const dashboardsChildren = [
    {
      key: 'nav-dashboards-all',
      areaKey: 'global',
      label: t('All Dashboards'),
      to: `${prefix}/dashboards/`,
    },
  ];

  const insightsChildren = [
    {
      key: 'nav-insights-frontend',
      areaKey: 'global',
      label: t('Frontend'),
      to: `${prefix}/insights/frontend/`,
    },
    {
      key: 'nav-insights-backend',
      areaKey: 'global',
      label: t('Backend'),
      to: `${prefix}/insights/backend/`,
    },
    {
      key: 'nav-insights-mobile',
      areaKey: 'global',
      label: t('Mobile'),
      to: `${prefix}/insights/mobile/`,
    },
    {
      key: 'nav-insights-crons',
      areaKey: 'global',
      label: t('Crons'),
      to: `${prefix}/insights/crons/`,
    },
    ...(features.has('uptime')
      ? [
          {
            key: 'nav-insights-uptime',
            areaKey: 'global',
            label: t('Uptime'),
            to: `${prefix}/insights/uptime/`,
          },
        ]
      : []),
    {
      key: 'nav-insights-projects',
      areaKey: 'global',
      label: t('All Projects'),
      to: `${prefix}/insights/projects/`,
    },
  ];

  const preventChildren = [
    ...(features.has('codecov-ui')
      ? [
          {
            key: 'nav-prevent-coverage',
            areaKey: 'global',
            label: t('Coverage'),
            to: `${prefix}/prevent/coverage/commits/`,
          },
          {
            key: 'nav-prevent-tests',
            areaKey: 'global',
            label: t('Tests'),
            to: `${prefix}/prevent/tests/`,
          },
        ]
      : []),
    {
      key: 'nav-prevent-ai',
      areaKey: 'global',
      label: t('Prevent AI'),
      to: `${prefix}/prevent/prevent-ai/new/`,
    },
    ...(features.has('codecov-ui')
      ? [
          {
            key: 'nav-prevent-tokens',
            areaKey: 'global',
            label: t('Tokens'),
            to: `${prefix}/prevent/tokens/`,
          },
        ]
      : []),
  ];

  return [
    {
      key: 'nav-issues',
      areaKey: 'global',
      section: GlobalActionSection.NAVIGATE,
      label: t('Issues'),
      actionIcon: <IconIssues />,
      to: `${prefix}/issues/`,
      children: issuesChildren,
    },
    {
      key: 'nav-explore',
      areaKey: 'global',
      section: GlobalActionSection.NAVIGATE,
      label: t('Explore'),
      actionIcon: <IconCompass />,
      to: `${prefix}/explore/${exploreDefault}/`,
      children: exploreChildren,
    },
    {
      key: 'nav-dashboards',
      areaKey: 'global',
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
            areaKey: 'global',
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
            areaKey: 'global',
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
      areaKey: 'global',
      section: GlobalActionSection.NAVIGATE,
      label: t('Settings'),
      actionIcon: <IconSettings />,
      to: `/settings/${slug}/`,
    },
  ];
}

function useNavigationToggleCollapsed() {
  const {isCollapsed, setIsCollapsed} = useNavContext();

  return {
    key: 'toggle-navigation-collapsed',
    areaKey: 'global',
    section: GlobalActionSection.OTHER,
    label: isCollapsed
      ? t('Expand Navigation Sidebar')
      : t('Collapse Navigation Sidebar'),
    actionIcon: <IconChevron isDouble direction={isCollapsed ? 'right' : 'left'} />,
    onAction: () => {
      setIsCollapsed(!isCollapsed);
    },
  };
}

/**
 * Registers globally-available actions. Requires that the organization has been loaded.
 */
export function useGlobalCommandPaletteActions() {
  const organization = useOrganization();
  const {mutateAsync: mutateUserOptions} = useMutateUserOptions();
  const navigateActions = useNavigationActions();
  const navigationToggleAction = useNavigationToggleCollapsed();

  const navPrefix = `/organizations/${organization.slug}`;

  useCommandPaletteActions([
    ...navigateActions,
    // Add (create new entitty)
    {
      key: 'add-dashboard',
      section: GlobalActionSection.ADD,
      label: t('Create Dashboard'),
      actionIcon: <IconAdd />,
      to: `${navPrefix}/dashboards/new/`,
    },
    {
      key: 'add-alert',
      section: GlobalActionSection.ADD,
      label: t('Create Alert'),
      actionIcon: <IconAdd />,
      to: `${navPrefix}/issues/alerts/wizard/`,
    },
    {
      key: 'add-project',
      section: GlobalActionSection.ADD,
      label: t('Create Project'),
      actionIcon: <IconAdd />,
      to: `${navPrefix}/projects/new/`,
    },
    {
      key: 'add-invite-members',
      section: GlobalActionSection.ADD,
      label: t('Invite Members'),
      actionIcon: <IconUser />,
      onAction: () => openInviteMembersModal(),
    },
    // Help: Documentation
    {
      key: 'help-docs',
      section: GlobalActionSection.HELP,
      label: t('Open Documentation'),
      actionIcon: <IconDocs />,
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    },
    // Help: Discord
    {
      key: 'help-discord',
      section: GlobalActionSection.HELP,
      label: t('Join Discord'),
      actionIcon: <IconDiscord />,
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    },
    // Help: GitHub
    {
      key: 'help-github',
      section: GlobalActionSection.HELP,
      label: t('Open GitHub Repository'),
      actionIcon: <IconGithub />,
      onAction: () =>
        window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
    },
    {
      key: 'help-changelog',
      section: GlobalActionSection.HELP,
      label: t('View Changelog'),
      actionIcon: <IconOpen />,
      onAction: () => window.open('https://sentry.io/changelog/', '_blank', 'noreferrer'),
    },
    // Actions
    navigationToggleAction,
    {
      key: 'account-theme-preference',
      section: GlobalActionSection.OTHER,
      label: t('Change Color Theme'),
      actionIcon: <IconSettings />,
      children: [
        {
          key: 'account-theme-preference-system',
          label: t('System'),
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'system'});
            addSuccessMessage(t('Theme preference saved: System'));
          },
        },
        {
          key: 'account-theme-preference-light',
          label: t('Light'),
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'light'});
            addSuccessMessage(t('Theme preference saved: Light'));
          },
        },
        {
          key: 'account-theme-preference-dark',
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
