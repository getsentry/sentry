import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
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

function useNavigationActions(): CommandPaletteAction[] {
  const organization = useOrganization();
  const slug = organization.slug;
  const prefix = `/organizations/${slug}`;
  const exploreDefault = getDefaultExploreRoute(organization);
  const {starredViews} = useStarredIssueViews();

  const issuesChildren: CommandPaletteAction[] = [
    {
      key: 'nav-issues-feed',
      display: {
        label: t('Feed'),
      },
      to: `${prefix}/issues/`,
    },
    ...Object.values(ISSUE_TAXONOMY_CONFIG).map(config => ({
      key: `nav-issues-${config.key}`,
      display: {
        label: config.label,
      },
      to: `${prefix}/issues/${config.key}/`,
    })),
    {
      key: 'nav-issues-feedback',
      display: {
        label: t('User Feedback'),
      },
      to: `${prefix}/issues/feedback/`,
    },
    {
      key: 'nav-issues-all-views',
      display: {
        label: t('All Views'),
      },
      to: `${prefix}/issues/views/`,
    },
    ...starredViews.map(view => ({
      key: `nav-issues-starred-${view.id}`,
      display: {
        label: view.label,
        icon: <IconStar />,
      },
      actionIcon: <IconStar />,
      to: `${prefix}/issues/views/${view.id}/`,
    })),
  ];

  const exploreChildren: CommandPaletteAction[] = [
    {
      key: 'nav-explore-traces',
      display: {
        label: t('Traces'),
      },
      to: `${prefix}/explore/traces/`,
    },
    {
      key: 'nav-explore-logs',
      display: {
        label: t('Logs'),
      },
      to: `${prefix}/explore/logs/`,
      hidden: !organization.features.includes('ourlogs-enabled'),
    },
    {
      key: 'nav-explore-discover',
      display: {
        label: t('Discover'),
      },
      to: `${prefix}/explore/discover/homepage/`,
    },
    {
      key: 'nav-explore-profiles',
      display: {
        label: t('Profiles'),
      },
      to: `${prefix}/explore/profiling/`,
      hidden: !organization.features.includes('profiling'),
    },
    {
      key: 'nav-explore-replays',
      display: {
        label: t('Replays'),
      },
      to: `${prefix}/explore/replays/`,
      hidden: !organization.features.includes('session-replay-ui'),
    },
    {
      key: 'nav-explore-releases',
      display: {
        label: t('Releases'),
      },
      to: `${prefix}/explore/releases/`,
    },
    {
      key: 'nav-explore-all-queries',
      display: {
        label: t('All Queries'),
      },
      to: `${prefix}/explore/saved-queries/`,
    },
  ];

  const dashboardsChildren: CommandPaletteAction[] = [
    {
      key: 'nav-dashboards-all',
      display: {
        label: t('All Dashboards'),
      },
      to: `${prefix}/dashboards/`,
    },
  ];

  const insightsChildren: CommandPaletteAction[] = [
    {
      key: 'nav-insights-frontend',
      display: {
        label: t('Frontend'),
      },
      to: `${prefix}/insights/frontend/`,
    },
    {
      key: 'nav-insights-backend',
      display: {
        label: t('Backend'),
      },
      to: `${prefix}/insights/backend/`,
    },
    {
      key: 'nav-insights-mobile',
      display: {
        label: t('Mobile'),
      },
      to: `${prefix}/insights/mobile/`,
    },
    {
      key: 'nav-insights-crons',
      display: {
        label: t('Crons'),
      },
      to: `${prefix}/insights/crons/`,
    },
    {
      key: 'nav-insights-uptime',
      display: {
        label: t('Uptime'),
      },
      to: `${prefix}/insights/uptime/`,
      hidden: !organization.features.includes('uptime'),
    },
    {
      key: 'nav-insights-projects',
      display: {
        label: t('All Projects'),
      },
      to: `${prefix}/insights/projects/`,
    },
  ];

  const preventChildren: CommandPaletteAction[] = [
    {
      key: 'nav-prevent-coverage',
      display: {
        label: t('Coverage'),
      },
      to: `${prefix}/prevent/coverage/commits/`,
      hidden: !organization.features.includes('codecov-ui'),
    },
    {
      key: 'nav-prevent-tests',
      display: {
        label: t('Tests'),
      },
      to: `${prefix}/prevent/tests/`,
      hidden: !organization.features.includes('prevent-test-analytics'),
    },
    {
      key: 'nav-prevent-ai-code-review',
      display: {
        label: t('AI Code Review'),
      },
      to: `${prefix}/prevent/ai-code-review/new/`,
    },
    {
      key: 'nav-prevent-tokens',
      display: {
        label: t('Tokens'),
      },
      to: `${prefix}/prevent/tokens/`,
      hidden: !organization.features.includes('prevent-test-analytics'),
    },
  ];

  return [
    {
      key: 'nav-issues',
      groupingKey: 'navigate',
      display: {
        label: t('Issues'),
        icon: <IconIssues />,
      },
      to: `${prefix}/issues/`,
      actions: issuesChildren,
    },
    {
      key: 'nav-explore',
      groupingKey: 'navigate',
      display: {
        label: t('Explore'),
        icon: <IconCompass />,
      },
      to: `${prefix}/explore/${exploreDefault}/`,
      actions: exploreChildren,
    },
    {
      key: 'nav-dashboards',
      groupingKey: 'navigate',
      display: {
        label: t('Dashboards'),
        icon: <IconDashboard />,
      },
      to: `${prefix}/dashboards/`,
      actions: dashboardsChildren,
    },
    {
      key: 'nav-insights',
      groupingKey: 'navigate',
      display: {
        label: t('Insights'),
        icon: <IconGraph type="area" />,
      },
      to: `${prefix}/insights/`,
      actions: insightsChildren,
      hidden: !organization.features.includes('performance-view'),
    },
    {
      key: 'nav-prevent',
      groupingKey: 'navigate',
      display: {
        label: t('Prevent'),
        icon: <IconPrevent />,
      },
      to: `${prefix}/prevent/prevent-ai/new/`,
      actions: preventChildren,
      hidden: !organization.features.includes('prevent-ai'),
    },
    {
      key: 'nav-settings',
      groupingKey: 'navigate',
      display: {
        label: t('Settings'),
        icon: <IconSettings />,
      },
      to: `/settings/${slug}/`,
    },
  ];
}

function useNavigationToggleCollapsed(): CommandPaletteAction {
  const {isCollapsed, setIsCollapsed} = useNavContext();

  return {
    key: 'toggle-navigation-collapsed',
    display: {
      label: isCollapsed
        ? t('Expand Navigation Sidebar')
        : t('Collapse Navigation Sidebar'),
      icon: <IconChevron isDouble direction={isCollapsed ? 'right' : 'left'} />,
    },
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
    {
      key: 'add-dashboard',
      display: {
        label: t('Create Dashboard'),
        icon: <IconAdd />,
      },
      groupingKey: 'add',
      to: `${navPrefix}/dashboards/new/`,
    },
    {
      key: 'add-alert',
      display: {
        label: t('Create Alert'),
        icon: <IconAdd />,
      },
      groupingKey: 'add',
      to: `${navPrefix}/issues/alerts/wizard/`,
    },
    {
      key: 'add-project',
      groupingKey: 'add',
      display: {
        label: t('Create Project'),
        icon: <IconAdd />,
      },
      to: `${navPrefix}/projects/new/`,
    },
    {
      key: 'add-invite-members',
      display: {
        label: t('Invite Members'),
        icon: <IconUser />,
      },
      groupingKey: 'add',
      onAction: () => openInviteMembersModal(),
    },
    {
      key: 'help-docs',
      display: {
        label: t('Open Documentation'),
        icon: <IconDocs />,
      },
      groupingKey: 'help',
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    },
    {
      key: 'help-discord',
      display: {
        label: t('Join Discord'),
        icon: <IconDiscord />,
      },
      groupingKey: 'help',
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    },
    {
      key: 'help-github',
      display: {
        label: t('Open GitHub Repository'),
        icon: <IconGithub />,
      },
      groupingKey: 'help',
      onAction: () =>
        window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
    },
    {
      key: 'help-changelog',
      display: {
        label: t('View Changelog'),
        icon: <IconOpen />,
      },
      groupingKey: 'help',
      onAction: () => window.open('https://sentry.io/changelog/', '_blank', 'noreferrer'),
    },
    navigationToggleAction,
    {
      key: 'account-theme-preference',
      display: {
        label: t('Change Color Theme'),
        icon: <IconSettings />,
      },
      actions: [
        {
          key: 'account-theme-preference-system',
          display: {
            label: t('System'),
          },
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'system'});
            addSuccessMessage(t('Theme preference saved: System'));
          },
        },
        {
          key: 'account-theme-preference-light',
          display: {
            label: t('Light'),
          },
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'light'});
            addSuccessMessage(t('Theme preference saved: Light'));
          },
        },
        {
          key: 'account-theme-preference-dark',
          display: {
            label: t('Dark'),
          },
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
