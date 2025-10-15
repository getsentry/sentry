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
  const exploreDefault = getDefaultExploreRoute(organization);
  const {starredViews} = useStarredIssueViews();

  const issuesChildren = [
    {
      key: 'nav-issues-feed',
      label: t('Feed'),
      to: `${prefix}/issues/`,
    },
    ...Object.values(ISSUE_TAXONOMY_CONFIG).map(config => ({
      key: `nav-issues-${config.key}`,
      label: config.label,
      to: `${prefix}/issues/${config.key}/`,
    })),
    {
      key: 'nav-issues-feedback',
      label: t('User Feedback'),
      to: `${prefix}/issues/feedback/`,
    },
    {
      key: 'nav-issues-all-views',
      label: t('All Views'),
      to: `${prefix}/issues/views/`,
    },
    ...starredViews.map(view => ({
      key: `nav-issues-starred-${view.id}`,
      label: view.label,
      actionIcon: <IconStar />,
      to: `${prefix}/issues/views/${view.id}/`,
    })),
  ];

  const exploreChildren = [
    {
      key: 'nav-explore-traces',
      label: t('Traces'),
      to: `${prefix}/explore/traces/`,
    },
    ...(organization.features.includes('ourlogs-enabled')
      ? [
          {
            key: 'nav-explore-logs',
            label: t('Logs'),
            to: `${prefix}/explore/logs/`,
          },
        ]
      : []),
    {
      key: 'nav-explore-discover',
      label: t('Discover'),
      to: `${prefix}/explore/discover/homepage/`,
    },
    ...(organization.features.includes('profiling')
      ? [
          {
            key: 'nav-explore-profiles',
            label: t('Profiles'),
            to: `${prefix}/explore/profiling/`,
          },
        ]
      : []),
    ...(organization.features.includes('session-replay-ui')
      ? [
          {
            key: 'nav-explore-replays',
            label: t('Replays'),
            to: `${prefix}/explore/replays/`,
          },
        ]
      : []),
    {
      key: 'nav-explore-releases',
      label: t('Releases'),
      to: `${prefix}/explore/releases/`,
    },
    {
      key: 'nav-explore-all-queries',
      label: t('All Queries'),
      to: `${prefix}/explore/saved-queries/`,
    },
  ];

  const dashboardsChildren = [
    {
      key: 'nav-dashboards-all',
      label: t('All Dashboards'),
      to: `${prefix}/dashboards/`,
    },
  ];

  const insightsChildren = [
    {
      key: 'nav-insights-frontend',
      label: t('Frontend'),
      to: `${prefix}/insights/frontend/`,
    },
    {
      key: 'nav-insights-backend',
      label: t('Backend'),
      to: `${prefix}/insights/backend/`,
    },
    {
      key: 'nav-insights-mobile',
      label: t('Mobile'),
      to: `${prefix}/insights/mobile/`,
    },
    {
      key: 'nav-insights-crons',
      label: t('Crons'),
      to: `${prefix}/insights/crons/`,
    },
    ...(organization.features.includes('uptime')
      ? [
          {
            key: 'nav-insights-uptime',
            label: t('Uptime'),
            to: `${prefix}/insights/uptime/`,
          },
        ]
      : []),
    {
      key: 'nav-insights-projects',
      label: t('All Projects'),
      to: `${prefix}/insights/projects/`,
    },
  ];

  const preventChildren = [
    ...(organization.features.includes('codecov-ui')
      ? [
          {
            key: 'nav-prevent-coverage',
            label: t('Coverage'),
            to: `${prefix}/prevent/coverage/commits/`,
          },
          {
            key: 'nav-prevent-tests',
            label: t('Tests'),
            to: `${prefix}/prevent/tests/`,
          },
        ]
      : []),
    ...(organization.features.includes('prevent-test-analytics')
      ? [
          {
            key: 'nav-prevent-tests',
            label: t('Tests'),
            to: `${prefix}/prevent/tests/`,
          },
        ]
      : []),
    {
      key: 'nav-prevent-ai-code-review',
      label: t('AI Code Review'),
      to: `${prefix}/prevent/ai-code-review/new/`,
    },
    ...(organization.features.includes('prevent-test-analytics')
      ? [
          {
            key: 'nav-prevent-tokens',
            label: t('Tokens'),
            to: `${prefix}/prevent/tokens/`,
          },
        ]
      : []),
  ];

  return [
    {
      key: 'nav-issues',
      section: GlobalActionSection.NAVIGATE,
      label: t('Issues'),
      actionIcon: <IconIssues />,
      to: `${prefix}/issues/`,
      children: issuesChildren,
    },
    {
      key: 'nav-explore',
      section: GlobalActionSection.NAVIGATE,
      label: t('Explore'),
      actionIcon: <IconCompass />,
      to: `${prefix}/explore/${exploreDefault}/`,
      children: exploreChildren,
    },
    {
      key: 'nav-dashboards',
      section: GlobalActionSection.NAVIGATE,
      label: t('Dashboards'),
      actionIcon: <IconDashboard />,
      to: `${prefix}/dashboards/`,
      children: dashboardsChildren,
    },
    ...(organization.features.includes('performance-view')
      ? [
          {
            key: 'nav-insights',
            section: GlobalActionSection.NAVIGATE,
            label: t('Insights'),
            actionIcon: <IconGraph type="area" />,
            to: `${prefix}/insights/`,
            children: insightsChildren,
          },
        ]
      : []),
    ...(organization.features.includes('prevent-ai')
      ? [
          {
            key: 'nav-prevent',
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
    {
      key: 'help-docs',
      section: GlobalActionSection.HELP,
      label: t('Open Documentation'),
      actionIcon: <IconDocs />,
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    },
    {
      key: 'help-discord',
      section: GlobalActionSection.HELP,
      label: t('Join Discord'),
      actionIcon: <IconDiscord />,
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    },
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
