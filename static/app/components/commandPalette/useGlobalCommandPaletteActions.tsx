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
    {
      key: 'nav-explore-logs',
      label: t('Logs'),
      to: `${prefix}/explore/logs/`,
      hidden: !organization.features.includes('ourlogs-enabled'),
    },
    {
      key: 'nav-explore-discover',
      label: t('Discover'),
      to: `${prefix}/explore/discover/homepage/`,
    },
    {
      key: 'nav-explore-profiles',
      label: t('Profiles'),
      to: `${prefix}/explore/profiling/`,
      hidden: !organization.features.includes('profiling'),
    },
    {
      key: 'nav-explore-replays',
      label: t('Replays'),
      to: `${prefix}/explore/replays/`,
      hidden: !organization.features.includes('session-replay-ui'),
    },
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
    {
      key: 'nav-insights-uptime',
      label: t('Uptime'),
      to: `${prefix}/insights/uptime/`,
      hidden: !organization.features.includes('uptime'),
    },
    {
      key: 'nav-insights-projects',
      label: t('All Projects'),
      to: `${prefix}/insights/projects/`,
    },
  ];

  const preventChildren = [
    {
      key: 'nav-prevent-coverage',
      label: t('Coverage'),
      to: `${prefix}/prevent/coverage/commits/`,
      hidden: !organization.features.includes('codecov-ui'),
    },
    {
      key: 'nav-prevent-tests',
      label: t('Tests'),
      to: `${prefix}/prevent/tests/`,
      hidden: !organization.features.includes('prevent-test-analytics'),
    },
    {
      key: 'nav-prevent-ai-code-review',
      label: t('AI Code Review'),
      to: `${prefix}/prevent/ai-code-review/new/`,
    },
    {
      key: 'nav-prevent-tokens',
      label: t('Tokens'),
      to: `${prefix}/prevent/tokens/`,
      hidden: !organization.features.includes('prevent-test-analytics'),
    },
  ];

  return [
    {
      key: 'nav-issues',
      groupingKey: 'navigate',
      label: t('Issues'),
      icon: <IconIssues />,
      to: `${prefix}/issues/`,
      actions: issuesChildren,
    },
    {
      key: 'nav-explore',
      groupingKey: 'navigate',
      label: t('Explore'),
      icon: <IconCompass />,
      to: `${prefix}/explore/${exploreDefault}/`,
      actions: exploreChildren,
    },
    {
      key: 'nav-dashboards',
      groupingKey: 'navigate',
      label: t('Dashboards'),
      icon: <IconDashboard />,
      to: `${prefix}/dashboards/`,
      actions: dashboardsChildren,
    },
    {
      key: 'nav-insights',
      groupingKey: 'navigate',
      label: t('Insights'),
      icon: <IconGraph type="area" />,
      to: `${prefix}/insights/`,
      actions: insightsChildren,
      hidden: !organization.features.includes('performance-view'),
    },
    {
      key: 'nav-prevent',
      groupingKey: 'navigate',
      label: t('Prevent'),
      icon: <IconPrevent />,
      to: `${prefix}/prevent/prevent-ai/new/`,
      actions: preventChildren,
      hidden: !organization.features.includes('prevent-ai'),
    },
    {
      key: 'nav-settings',
      groupingKey: 'navigate',
      label: t('Settings'),
      icon: <IconSettings />,
      to: `/settings/${slug}/`,
    },
  ];
}

function useNavigationToggleCollapsed(): CommandPaletteAction {
  const {isCollapsed, setIsCollapsed} = useNavContext();

  return {
    key: 'toggle-navigation-collapsed',
    label: isCollapsed
      ? t('Expand Navigation Sidebar')
      : t('Collapse Navigation Sidebar'),
    icon: <IconChevron isDouble direction={isCollapsed ? 'right' : 'left'} />,
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
      groupingKey: 'add',
      label: t('Create Dashboard'),
      icon: <IconAdd />,
      to: `${navPrefix}/dashboards/new/`,
    },
    {
      key: 'add-alert',
      groupingKey: 'add',
      label: t('Create Alert'),
      icon: <IconAdd />,
      to: `${navPrefix}/issues/alerts/wizard/`,
    },
    {
      key: 'add-project',
      groupingKey: 'add',
      label: t('Create Project'),
      icon: <IconAdd />,
      to: `${navPrefix}/projects/new/`,
    },
    {
      key: 'add-invite-members',
      groupingKey: 'add',
      label: t('Invite Members'),
      icon: <IconUser />,
      onAction: () => openInviteMembersModal(),
    },
    {
      key: 'help-docs',
      groupingKey: 'help',
      label: t('Open Documentation'),
      icon: <IconDocs />,
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    },
    {
      key: 'help-discord',
      groupingKey: 'help',
      label: t('Join Discord'),
      icon: <IconDiscord />,
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    },
    {
      key: 'help-github',
      groupingKey: 'help',
      label: t('Open GitHub Repository'),
      icon: <IconGithub />,
      onAction: () =>
        window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
    },
    {
      key: 'help-changelog',
      groupingKey: 'help',
      label: t('View Changelog'),
      icon: <IconOpen />,
      onAction: () => window.open('https://sentry.io/changelog/', '_blank', 'noreferrer'),
    },
    navigationToggleAction,
    {
      key: 'account-theme-preference',
      label: t('Change Color Theme'),
      icon: <IconSettings />,
      actions: [
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
