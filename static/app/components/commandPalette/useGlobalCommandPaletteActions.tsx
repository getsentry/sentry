import {ProjectAvatar} from '@sentry/scraps/avatar';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {
  makeCommandPaletteCallback,
  makeCommandPaletteGroup,
  makeCommandPaletteLink,
} from 'sentry/components/commandPalette/makeCommandPaletteAction';
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

  const exploreChildren: CommandPaletteAction[] = [
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

  const dashboardsChildren: CommandPaletteAction[] = [
    makeCommandPaletteLink({
      display: {
        label: t('All Dashboards'),
      },
      to: `${prefix}/dashboards/`,
    }),
    makeCommandPaletteGroup({
      display: {
        label: t('Starred Dashboards'),
        icon: <IconStar />,
      },
      actions: starredDashboards.map(dashboard =>
        makeCommandPaletteLink({
          display: {
            label: dashboard.title,
            icon: <IconStar />,
          },
          to: `${prefix}/dashboard/${dashboard.id}/`,
        })
      ),
    }),
  ];

  const insightsChildren: CommandPaletteAction[] = [
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

  return [
    makeCommandPaletteGroup({
      display: {
        label: t('Go to...'),
      },
      actions: [
        makeCommandPaletteGroup({
          display: {
            label: t('Issues'),
            icon: <IconIssues />,
          },
          actions: issuesChildren,
        }),
        makeCommandPaletteGroup({
          display: {
            label: t('Explore'),
            icon: <IconCompass />,
          },
          actions: exploreChildren,
        }),
        makeCommandPaletteGroup({
          display: {
            label: t('Dashboards'),
            icon: <IconDashboard />,
          },
          actions: dashboardsChildren,
        }),
        makeCommandPaletteGroup({
          display: {
            label: t('Insights'),
            icon: <IconGraph type="area" />,
          },
          actions: insightsChildren,
          hidden: !organization.features.includes('performance-view'),
        }),
        makeCommandPaletteGroup({
          display: {
            label: t('Settings'),
            icon: <IconSettings />,
          },
          actions: getUserOrgNavigationConfiguration().flatMap(item =>
            item.items.map(settingsChildItem =>
              makeCommandPaletteLink({
                display: {
                  label: settingsChildItem.title,
                },
                to: settingsChildItem.path,
              })
            )
          ),
        }),
        makeCommandPaletteGroup({
          display: {
            label: t('Project Settings'),
            icon: <IconSettings />,
          },
          actions: projects.map(project =>
            makeCommandPaletteLink({
              display: {
                label: project.name,
                icon: <ProjectAvatar project={project} size={16} />,
              },
              to: `/settings/${slug}/projects/${project.slug}/`,
            })
          ),
        }),
      ],
    }),
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
    makeCommandPaletteGroup({
      display: {
        label: t('Add'),
      },
      actions: [
        makeCommandPaletteLink({
          display: {
            label: t('Create Dashboard'),
            icon: <IconAdd />,
          },
          to: `${navPrefix}/dashboards/new/`,
        }),
        makeCommandPaletteLink({
          display: {
            label: t('Create Alert'),
            icon: <IconAdd />,
          },
          to: `${navPrefix}/issues/alerts/wizard/`,
        }),
        makeCommandPaletteLink({
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
          onAction: () => openInviteMembersModal(),
        }),
      ],
    }),
    // END ADD
    // BEGIN HELP ACTIONS
    makeCommandPaletteGroup({
      display: {
        label: t('Help'),
      },
      actions: [
        makeCommandPaletteCallback({
          display: {
            label: t('Open Documentation'),
            icon: <IconDocs />,
          },
          onAction: () => window.open('https://docs.sentry.io', '_blank', 'noreferrer'),
        }),
        makeCommandPaletteCallback({
          display: {
            label: t('Join Discord'),
            icon: <IconDiscord />,
          },
          onAction: () =>
            window.open('https://discord.gg/sentry', '_blank', 'noreferrer'),
        }),
        makeCommandPaletteCallback({
          display: {
            label: t('Open GitHub Repository'),
            icon: <IconGithub />,
          },
          onAction: () =>
            window.open('https://github.com/getsentry/sentry', '_blank', 'noreferrer'),
        }),
        makeCommandPaletteCallback({
          display: {
            label: t('View Changelog'),
            icon: <IconOpen />,
          },
          onAction: () =>
            window.open('https://sentry.io/changelog/', '_blank', 'noreferrer'),
        }),
      ],
    }),
    // END HELP ACTIONS
    makeCommandPaletteGroup({
      display: {
        label: t('Interface'),
      },
      actions: [
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
      ],
    }),
  ]);
}
