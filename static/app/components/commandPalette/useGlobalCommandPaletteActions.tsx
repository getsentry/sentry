import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {
  makeCommandPaletteCallback,
  makeCommandPaletteGroup,
  makeCommandPaletteLink,
} from 'sentry/components/commandPalette/makeCommandPaletteAction';
import type {
  CommandPaletteAction,
  CommandPaletteActionChild,
} from 'sentry/components/commandPalette/types';
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
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MCP_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mcp/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useNavContext} from 'sentry/views/nav/context';
import {useStarredIssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/useStarredIssueViews';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';

// This hook generates actions for all pages in the primary and secondary navigation.
// TODO: Consider refactoring the navigation so that this can read from the same source
// of truth and avoid divergence.
function useNavigationActions(): CommandPaletteAction[] {
  const organization = useOrganization();
  const slug = organization.slug;
  const prefix = `/organizations/${slug}`;
  const {starredViews} = useStarredIssueViews();
  const {data: starredDashboards = []} = useGetStarredDashboards();

  const issuesChildren: CommandPaletteActionChild[] = [
    makeCommandPaletteLink({
      display: {
        label: t('Feed'),
      },
      to: `${prefix}/issues/`,
    }),
    ...Object.values(ISSUE_TAXONOMY_CONFIG).map(config =>
      makeCommandPaletteLink({
        display: {
          label: config.label,
        },
        to: `${prefix}/issues/${config.key}/`,
      })
    ),
    makeCommandPaletteLink({
      display: {
        label: t('User Feedback'),
      },
      to: `${prefix}/issues/feedback/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('All Views'),
      },
      to: `${prefix}/issues/views/`,
    }),
    ...starredViews.map(view =>
      makeCommandPaletteLink({
        display: {
          label: view.label,
          icon: <IconStar />,
        },
        to: `${prefix}/issues/views/${view.id}/`,
      })
    ),
  ];

  const exploreChildren: CommandPaletteActionChild[] = [
    makeCommandPaletteLink({
      display: {
        label: t('Traces'),
      },
      to: `${prefix}/explore/traces/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Logs'),
      },
      to: `${prefix}/explore/logs/`,
      hidden: !organization.features.includes('ourlogs-enabled'),
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Discover'),
      },
      to: `${prefix}/explore/discover/homepage/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Profiles'),
      },
      to: `${prefix}/explore/profiling/`,
      hidden: !organization.features.includes('profiling'),
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Replays'),
      },
      to: `${prefix}/explore/replays/`,
      hidden: !organization.features.includes('session-replay-ui'),
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Releases'),
      },
      to: `${prefix}/explore/releases/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('All Queries'),
      },
      to: `${prefix}/explore/saved-queries/`,
    }),
  ];

  const dashboardsChildren: CommandPaletteActionChild[] = [
    makeCommandPaletteLink({
      display: {
        label: t('All Dashboards'),
      },
      to: `${prefix}/dashboards/`,
    }),
    ...starredDashboards.map(dashboard =>
      makeCommandPaletteLink({
        display: {
          label: dashboard.title,
          icon: <IconStar />,
        },
        to: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
      })
    ),
  ];

  const insightsChildren: CommandPaletteActionChild[] = [
    makeCommandPaletteLink({
      display: {
        label: t('Frontend'),
      },
      to: `${prefix}/insights/${FRONTEND_LANDING_SUB_PATH}/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Backend'),
      },
      to: `${prefix}/insights/${BACKEND_LANDING_SUB_PATH}/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Mobile'),
      },
      to: `${prefix}/insights/${MOBILE_LANDING_SUB_PATH}/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Agents'),
      },
      to: `${prefix}/insights/${AGENTS_LANDING_SUB_PATH}/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('MCP'),
      },
      to: `${prefix}/insights/${MCP_LANDING_SUB_PATH}/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Crons'),
      },
      to: `${prefix}/insights/crons/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Uptime'),
      },
      to: `${prefix}/insights/uptime/`,
      hidden: !organization.features.includes('uptime'),
    }),
    makeCommandPaletteLink({
      display: {
        label: t('All Projects'),
      },
      to: `${prefix}/insights/projects/`,
    }),
  ];

  const preventChildren: CommandPaletteActionChild[] = [
    makeCommandPaletteLink({
      display: {
        label: t('Tests'),
      },
      to: `${prefix}/prevent/tests/`,
      hidden: !organization.features.includes('prevent-test-analytics'),
    }),
    makeCommandPaletteLink({
      display: {
        label: t('AI Code Review'),
      },
      to: `${prefix}/prevent/ai-code-review/new/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Tokens'),
      },
      to: `${prefix}/prevent/tokens/`,
      hidden: !organization.features.includes('prevent-test-analytics'),
    }),
  ];

  const settingsChildren: CommandPaletteActionChild[] =
    getUserOrgNavigationConfiguration().flatMap(item =>
      item.items.map(settingsChildItem =>
        makeCommandPaletteLink({
          display: {
            label: settingsChildItem.title,
          },
          to: settingsChildItem.path,
        })
      )
    );

  return [
    makeCommandPaletteGroup({
      groupingKey: 'navigate',
      display: {
        label: t('Issues'),
        icon: <IconIssues />,
      },
      actions: issuesChildren,
    }),
    makeCommandPaletteGroup({
      groupingKey: 'navigate',
      display: {
        label: t('Explore'),
        icon: <IconCompass />,
      },
      actions: exploreChildren,
    }),
    makeCommandPaletteGroup({
      groupingKey: 'navigate',
      display: {
        label: t('Dashboards'),
        icon: <IconDashboard />,
      },
      actions: dashboardsChildren,
    }),
    makeCommandPaletteGroup({
      groupingKey: 'navigate',
      display: {
        label: t('Insights'),
        icon: <IconGraph type="area" />,
      },
      actions: insightsChildren,
      hidden: !organization.features.includes('performance-view'),
    }),
    makeCommandPaletteGroup({
      groupingKey: 'navigate',
      display: {
        label: t('Prevent'),
        icon: <IconPrevent />,
      },
      actions: preventChildren,
      hidden: !organization.features.includes('prevent-ai'),
    }),
    makeCommandPaletteGroup({
      groupingKey: 'navigate',
      display: {
        label: t('Settings'),
        icon: <IconSettings />,
      },
      actions: settingsChildren,
    }),
  ];
}

function useNavigationToggleCollapsed(): CommandPaletteAction {
  const {isCollapsed, setIsCollapsed} = useNavContext();

  return {
    type: 'callback',
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
    makeCommandPaletteLink({
      display: {
        label: t('Create Dashboard'),
        icon: <IconAdd />,
      },
      groupingKey: 'add',
      to: `${navPrefix}/dashboards/new/`,
    }),
    makeCommandPaletteLink({
      display: {
        label: t('Create Alert'),
        icon: <IconAdd />,
      },
      groupingKey: 'add',
      to: `${navPrefix}/issues/alerts/wizard/`,
    }),
    makeCommandPaletteLink({
      groupingKey: 'add',
      display: {
        label: t('Create Project'),
        icon: <IconAdd />,
      },
      to: `${navPrefix}/projects/new/`,
    }),
    makeCommandPaletteCallback({
      display: {
        label: t('Invite Members'),
        icon: <IconUser />,
      },
      groupingKey: 'add',
      onAction: () => openInviteMembersModal(),
    }),
    makeCommandPaletteCallback({
      display: {
        label: t('Open Documentation'),
        icon: <IconDocs />,
      },
      groupingKey: 'help',
      onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
    }),
    makeCommandPaletteCallback({
      display: {
        label: t('Join Discord'),
        icon: <IconDiscord />,
      },
      groupingKey: 'help',
      onAction: () => window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
    }),
    makeCommandPaletteCallback({
      display: {
        label: t('Open GitHub Repository'),
        icon: <IconGithub />,
      },
      groupingKey: 'help',
      onAction: () =>
        window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
    }),
    makeCommandPaletteCallback({
      display: {
        label: t('View Changelog'),
        icon: <IconOpen />,
      },
      groupingKey: 'help',
      onAction: () => window.open('https://sentry.io/changelog/', '_blank', 'noreferrer'),
    }),
    navigationToggleAction,
    makeCommandPaletteGroup({
      display: {
        label: t('Change Color Theme'),
        icon: <IconSettings />,
      },
      actions: [
        makeCommandPaletteCallback({
          display: {
            label: t('System'),
          },
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'system'});
            addSuccessMessage(t('Theme preference saved: System'));
          },
        }),
        makeCommandPaletteCallback({
          display: {
            label: t('Light'),
          },
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'light'});
            addSuccessMessage(t('Theme preference saved: Light'));
          },
        }),
        makeCommandPaletteCallback({
          display: {
            label: t('Dark'),
          },
          onAction: async () => {
            addLoadingMessage(t('Saving…'));
            await mutateUserOptions({theme: 'dark'});
            addSuccessMessage(t('Theme preference saved: Dark'));
          },
        }),
      ],
    }),
  ]);
}
