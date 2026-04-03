import {ProjectAvatar} from '@sentry/scraps/avatar';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';
import {
  IconAdd,
  IconCompass,
  IconDashboard,
  IconDiscord,
  IconDocs,
  IconGithub,
  IconGraph,
  IconIssues,
  IconOpen,
  IconSettings,
  IconStar,
  IconUser,
  IconPanel,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useMutateUserOptions} from 'sentry/utils/useMutateUserOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useGetStarredDashboards} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MCP_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mcp/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useStarredIssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/useStarredIssueViews';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';
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
  const {projects} = useProjects();

  const issuesChildren: CommandPaletteAction[] = [
    {
      display: {
        label: t('Feed'),
      },
      to: `${prefix}/issues/`,
    },
    ...Object.values(ISSUE_TAXONOMY_CONFIG).map(config => ({
      display: {
        label: config.label,
      },
      to: `${prefix}/issues/${config.key}/`,
    })),
    {
      display: {
        label: t('User Feedback'),
      },
      to: `${prefix}/issues/feedback/`,
    },
    {
      display: {
        label: t('All Views'),
      },
      to: `${prefix}/issues/views/`,
    },
    ...starredViews.map(view => ({
      display: {
        label: view.label,
        icon: <IconStar />,
      },
      to: `${prefix}/issues/views/${view.id}/`,
    })),
  ];

  const exploreChildren: CommandPaletteAction[] = [
    {
      display: {
        label: t('Traces'),
      },
      to: `${prefix}/explore/traces/`,
    },
    organization.features.includes('ourlogs-enabled')
      ? {
          display: {
            label: t('Logs'),
          },
          to: `${prefix}/explore/logs/`,
        }
      : undefined,
    {
      display: {
        label: t('Discover'),
      },
      to: `${prefix}/explore/discover/homepage/`,
    },
    organization.features.includes('profiling')
      ? {
          display: {
            label: t('Profiles'),
          },
          to: `${prefix}/explore/profiling/`,
        }
      : undefined,
    organization.features.includes('session-replay-ui')
      ? {
          display: {
            label: t('Replays'),
          },
          to: `${prefix}/explore/replays/`,
        }
      : undefined,
    {
      display: {
        label: t('Releases'),
      },
      to: `${prefix}/explore/releases/`,
    },
    {
      display: {
        label: t('All Queries'),
      },
      to: `${prefix}/explore/saved-queries/`,
    },
  ].filter(action => action !== undefined);

  const dashboardsChildren: CommandPaletteAction[] = [
    {
      display: {
        label: t('All Dashboards'),
      },
      to: `${prefix}/dashboards/`,
    },
    {
      display: {
        label: t('Starred Dashboards'),
        icon: <IconStar />,
      },
      actions: starredDashboards.map(dashboard => ({
        display: {
          label: dashboard.title,
          icon: <IconStar />,
        },
        to: `${prefix}/dashboard/${dashboard.id}/`,
      })),
    },
  ];

  const insightsChildren: CommandPaletteAction[] = [
    {
      display: {
        label: t('Frontend'),
      },
      to: `${prefix}/insights/${FRONTEND_LANDING_SUB_PATH}/`,
    },
    {
      display: {
        label: t('Backend'),
      },
      to: `${prefix}/insights/${BACKEND_LANDING_SUB_PATH}/`,
    },
    {
      display: {
        label: t('Mobile'),
      },
      to: `${prefix}/insights/${MOBILE_LANDING_SUB_PATH}/`,
    },
    {
      display: {
        label: t('Agents'),
      },
      to: `${prefix}/insights/${AGENTS_LANDING_SUB_PATH}/`,
    },
    {
      display: {
        label: t('MCP'),
      },
      to: `${prefix}/insights/${MCP_LANDING_SUB_PATH}/`,
    },
    {
      display: {
        label: t('Crons'),
      },
      to: `${prefix}/insights/crons/`,
    },
    organization.features.includes('uptime')
      ? {
          display: {
            label: t('Uptime'),
          },
          to: `${prefix}/insights/uptime/`,
        }
      : undefined,
    {
      display: {
        label: t('All Projects'),
      },
      to: `${prefix}/insights/projects/`,
    },
  ].filter(action => action !== undefined);

  return [
    {
      display: {
        label: t('Go to...'),
      },
      actions: [
        {
          display: {
            label: t('Issues'),
            icon: <IconIssues />,
          },
          actions: issuesChildren,
        },
        {
          display: {
            label: t('Explore'),
            icon: <IconCompass />,
          },
          actions: exploreChildren,
        },
        {
          display: {
            label: t('Dashboards'),
            icon: <IconDashboard />,
          },
          actions: dashboardsChildren,
        },
        organization.features.includes('performance-view')
          ? {
              display: {
                label: t('Insights'),
                icon: <IconGraph type="area" />,
              },
              actions: insightsChildren,
            }
          : undefined,
        {
          display: {
            label: t('Settings'),
            icon: <IconSettings />,
          },
          actions: getUserOrgNavigationConfiguration().flatMap(item =>
            item.items.map(settingsChildItem => ({
              display: {
                label: settingsChildItem.title,
              },
              to: settingsChildItem.path,
            }))
          ),
        },
        {
          display: {
            label: t('Project Settings'),
            icon: <IconSettings />,
          },
          actions: projects.map(project => ({
            display: {
              label: project.name,
              icon: <ProjectAvatar project={project} size={16} />,
            },
            to: `/settings/${slug}/projects/${project.slug}/`,
          })),
        },
      ].filter(action => action !== undefined),
    },
  ];
}

function useNavigationToggleCollapsed(): CommandPaletteAction {
  const {view, setView} = useSecondaryNavigation();
  const isCollapsed = view !== 'expanded';

  return {
    display: {
      label: isCollapsed
        ? t('Expand Navigation Sidebar')
        : t('Collapse Navigation Sidebar'),
      icon: <IconPanel direction={isCollapsed ? 'right' : 'left'} />,
    },
    onAction: () => {
      setView(view === 'expanded' ? 'collapsed' : 'expanded');
    },
  };
}

/**
 * Registers globally-available actions. Requires that the organization has been loaded.
 */
export function useGlobalCommandPaletteActions() {
  const organization = useOrganization();
  const navigateActions = useNavigationActions();
  const {mutateAsync: mutateUserOptions} = useMutateUserOptions();
  const navigationToggleAction = useNavigationToggleCollapsed();

  const navPrefix = `/organizations/${organization.slug}`;

  useCommandPaletteActions([
    ...navigateActions,
    // BEGIN ADD ACTIONS
    {
      display: {
        label: t('Add'),
      },
      actions: [
        {
          display: {
            label: t('Create Dashboard'),
            icon: <IconAdd />,
          },
          to: `${navPrefix}/dashboards/new/`,
        },
        {
          display: {
            label: t('Create Alert'),
            icon: <IconAdd />,
          },
          to: `${navPrefix}/issues/alerts/wizard/`,
        },
        {
          display: {
            label: t('Create Project'),
            icon: <IconAdd />,
          },
          to: `${navPrefix}/projects/new/`,
        },
        {
          display: {
            label: t('Invite Members'),
            icon: <IconUser />,
          },
          onAction: () => openInviteMembersModal(),
        },
      ],
    },
    // END ADD
    // BEGIN HELP ACTIONS
    {
      display: {
        label: t('Help'),
      },
      actions: [
        {
          display: {
            label: t('Open Documentation'),
            icon: <IconDocs />,
          },
          onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
        },
        {
          display: {
            label: t('Join Discord'),
            icon: <IconDiscord />,
          },
          onAction: () =>
            window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
        },
        {
          display: {
            label: t('Open GitHub Repository'),
            icon: <IconGithub />,
          },
          onAction: () =>
            window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
        },
        {
          display: {
            label: t('View Changelog'),
            icon: <IconOpen />,
          },
          onAction: () =>
            window.open('https://sentry.io/changelog/', '_blank', 'noreferrer'),
        },
      ],
    },
    // END HELP ACTIONS
    {
      display: {
        label: t('Interface'),
      },
      actions: [
        navigationToggleAction,
        {
          display: {
            label: t('Change Color Theme'),
            icon: <IconSettings />,
          },
          actions: [
            {
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
      ],
    },
  ]);
}
