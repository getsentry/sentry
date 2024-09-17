import {useMemo} from 'react';

import type {NavItemRaw, SidebarItem, SubmenuItem} from 'sentry/components/nav/utils';
import {
  ActiveStatus,
  getActiveStatus,
  NAV_DIVIDER,
  resolveSidebarItem,
  splitAtDivider,
} from 'sentry/components/nav/utils';
import {
  IconBroadcast,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconLightning,
  IconProject,
  IconQuestion,
  IconSearch,
  IconSettings,
  IconSiren,
  IconStats,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {getSearchForIssueGroup, IssueGroup} from 'sentry/views/issueList/utils';

export interface NavItemsResult {
  primary: {
    body: SidebarItem[];
    footer: SidebarItem[];
  };
  secondary: {
    body: SubmenuItem[];
    footer: SubmenuItem[];
  };
}

export function useNavItems(): NavItemsResult {
  const organization = useOrganization();
  const location = useLocation();
  const moduleURLBuilder = useModuleURLBuilder();
  const prefix = `organizations/${organization.slug}`;

  const items = useMemo<NavItemRaw[]>(
    () => [
      {
        label: t('Issues'),
        icon: <IconIssues />,
        submenu: [
          {label: t('All'), to: `/${prefix}/issues/`},
          {
            label: t('Error & Outage'),
            to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.ERROR_OUTAGE)}`,
          },
          {
            label: t('Trend'),
            to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.TREND)}`,
          },
          {
            label: t('Craftsmanship'),
            to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.CRAFTSMANSHIP)}`,
          },
          {
            label: t('Security'),
            to: `/${prefix}/issues/${getSearchForIssueGroup(IssueGroup.SECURITY)}`,
          },
          {label: t('Feedback'), to: `/${prefix}/feedback/`},
        ],
      },
      {label: t('Projects'), to: `/${prefix}/projects/`, icon: <IconProject />},
      {
        label: t('Explore'),
        icon: <IconSearch />,
        submenu: [
          {
            label: t('Traces'),
            to: `/traces/`,
            check: {features: 'performance-trace-explorer'},
          },
          {
            label: t('Metrics'),
            to: `/${prefix}/metrics/`,
            check: {features: 'custom-metrics'},
          },
          {
            label: t('Profiles'),
            to: `/${prefix}/profiling/`,
            check: {features: 'profiling', hook: 'profiling-sidebar-item'},
          },
          {
            label: t('Replays'),
            to: `/${prefix}/replays/`,
            check: {features: 'session-replay-ui', hook: 'replay-sidebar-item'},
          },
          {
            label: t('Discover'),
            to: getDiscoverLandingUrl(organization),
            check: {features: 'discover-basic', hook: 'discover2-sidebar-item'},
          },
          {label: t('Releases'), to: `/${prefix}/releases/`},
          {label: t('Crons'), to: `/${prefix}/crons/`},
        ],
      },
      {
        label: t('Insights'),
        icon: <IconGraph />,
        check: {features: 'insights-entry-points'},
        submenu: [
          {label: MODULE_TITLES.http, to: `/${moduleURLBuilder('http')}/`},
          {label: MODULE_TITLES.db, to: `/${moduleURLBuilder('db')}/`},
          {label: MODULE_TITLES.resource, to: `/${moduleURLBuilder('resource')}/`},
          {label: MODULE_TITLES.app_start, to: `/${moduleURLBuilder('app_start')}/`},
          {
            label: MODULE_TITLES['mobile-screens'],
            to: `/${moduleURLBuilder('mobile-screens')}/`,
          },
          {label: MODULE_TITLES.vital, to: `/${moduleURLBuilder('vital')}/`},
          {label: MODULE_TITLES.cache, to: `/${moduleURLBuilder('cache')}/`},
          {label: MODULE_TITLES.queue, to: `/${moduleURLBuilder('queue')}/`},
          {
            label: MODULE_TITLES.ai,
            to: `/${moduleURLBuilder('ai')}/`,
            check: {features: 'insights-entry-points'},
          },
        ],
      },
      {
        label: t('Perf.'),
        to: '/performance/',
        icon: <IconLightning />,
        check: {features: 'performance-view', hook: 'performance-sidebar-item'},
      },
      {
        label: t('Boards'),
        to: '/dashboards/',
        icon: <IconDashboard />,
        check: {
          features: ['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit'],
          hook: 'dashboards-sidebar-item',
        },
      },
      {label: t('Alerts'), to: `/${prefix}/alerts/rules/`, icon: <IconSiren />},
      NAV_DIVIDER,
      {label: t('Help'), to: '', icon: <IconQuestion />},
      {label: t('New'), to: '', icon: <IconBroadcast />},
      {label: t('Stats'), to: '', icon: <IconStats />},
      {
        label: t('Settings'),
        to: `/settings/${organization.slug}/`,
        icon: <IconSettings />,
      },
    ],
    [organization, moduleURLBuilder, prefix]
  );

  const formatted = useMemo(() => formatNavItems({location}, items), [location, items]);
  return formatted;
}

function formatNavItems(
  context: {location: ReturnType<typeof useLocation>},
  items: NavItemRaw[]
): NavItemsResult {
  const sidebar = items
    .filter(item => !!item)
    .map(item => (typeof item === 'object' ? resolveSidebarItem(item) : item));
  const primary = splitAtDivider(sidebar);
  const {submenu = []} = primary.body.find(
    item => getActiveStatus(item, context.location) !== ActiveStatus.INACTIVE
  ) ?? {
    submenu: [],
  };
  const secondary = splitAtDivider(submenu);

  return {
    primary,
    secondary,
  };
}
