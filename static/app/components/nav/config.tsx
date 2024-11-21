import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import type {NavConfig, NavSidebarItem} from 'sentry/components/nav/utils';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconLightning,
  IconProject,
  IconQuestion,
  IconSearch,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {MODULE_SIDEBAR_TITLE as MODULE_TITLE_HTTP} from 'sentry/views/insights/http/settings';
import {
  AI_LANDING_SUB_PATH,
  AI_LANDING_TITLE,
} from 'sentry/views/insights/pages/ai/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_LANDING_TITLE,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {INSIGHTS_BASE_URL, MODULE_TITLES} from 'sentry/views/insights/settings';
import {getSearchForIssueGroup, IssueGroup} from 'sentry/views/issueList/utils';

/**
 * Global nav settings for all Sentry users.
 * Links are generated per-organization with the proper `/organization/:slug/` prefix.
 *
 * To permission-gate certain items, include props to be passed to the `<Feature>` component
 */
export function createNavConfig({organization}: {organization: Organization}): NavConfig {
  const prefix = `organizations/${organization.slug}`;
  const insightsPrefix = `${prefix}/${INSIGHTS_BASE_URL}`;
  const hasPerfDomainViews = organization.features.includes('insights-domain-view');

  const insights: NavSidebarItem = {
    label: t('Insights'),
    icon: <IconGraph />,
    feature: {features: 'insights-entry-points'},
    analyticsKey: 'insights',
    submenu: [
      {
        label: MODULE_TITLE_HTTP,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.http}/`,
      },
      {label: MODULE_TITLES.db, to: `/${insightsPrefix}/${MODULE_BASE_URLS.db}/`},
      {
        label: MODULE_TITLES.resource,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.resource}/`,
      },
      {
        label: MODULE_TITLES.app_start,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.app_start}/`,
      },
      {
        label: MODULE_TITLES['mobile-screens'],
        to: `/${insightsPrefix}/${MODULE_BASE_URLS['mobile-screens']}/`,
        feature: {features: 'insights-mobile-screens-module'},
      },
      {
        label: MODULE_TITLES.vital,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.vital}/`,
      },
      {
        label: MODULE_TITLES.cache,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.cache}/`,
      },
      {
        label: MODULE_TITLES.queue,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.queue}/`,
      },
      {
        label: MODULE_TITLES.ai,
        to: `/${insightsPrefix}/${MODULE_BASE_URLS.ai}/`,
        feature: {features: 'insights-entry-points'},
      },
    ],
  };

  const perf: NavSidebarItem = {
    label: t('Perf.'),
    to: '/performance/',
    analyticsKey: 'performance',
    icon: <IconLightning />,
    feature: {
      features: 'performance-view',
      hookName: 'feature-disabled:performance-sidebar-item',
    },
  };

  const perfDomainViews: NavSidebarItem = {
    label: t('Perf.'),
    icon: <IconLightning />,
    analyticsKey: 'insights-domains',
    feature: {features: ['insights-domain-view', 'performance-view']},
    submenu: [
      {
        label: FRONTEND_LANDING_TITLE,
        to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}/`,
      },
      {
        label: BACKEND_LANDING_TITLE,
        to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`,
      },
      {
        label: AI_LANDING_TITLE,
        to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/`,
      },
      {
        label: MOBILE_LANDING_TITLE,
        to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${MOBILE_LANDING_SUB_PATH}/`,
      },
    ],
  };

  return {
    main: [
      {
        label: t('Issues'),
        icon: <IconIssues />,
        analyticsKey: 'issues',
        submenu: [
          {
            label: t('All'),
            to: `/${prefix}/issues/?query=is:unresolved`,
          },
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
      {
        label: t('Projects'),
        analyticsKey: 'projects',
        to: `/${prefix}/projects/`,
        icon: <IconProject />,
      },
      {
        label: t('Explore'),
        icon: <IconSearch />,
        analyticsKey: 'explore',
        submenu: [
          {
            label: t('Traces'),
            to: `/${prefix}/traces/`,
            feature: {features: 'performance-trace-explorer'},
          },
          {
            label: t('Metrics'),
            to: `/${prefix}/metrics/`,
            feature: {features: 'custom-metrics'},
          },
          {
            label: t('Profiles'),
            to: `/${prefix}/profiling/`,
            feature: {
              features: 'profiling',
              hookName: 'feature-disabled:profiling-sidebar-item',
              requireAll: false,
            },
          },
          {
            label: t('Replays'),
            to: `/${prefix}/replays/`,
            feature: {
              features: 'session-replay-ui',
              hookName: 'feature-disabled:replay-sidebar-item',
            },
          },
          {
            label: t('Discover'),
            to: getDiscoverLandingUrl(organization),
            feature: {
              features: 'discover-basic',
              hookName: 'feature-disabled:discover2-sidebar-item',
            },
          },
          {label: t('Releases'), to: `/${prefix}/releases/`},
          {label: t('Crons'), to: `/${prefix}/crons/`},
        ],
      },
      ...(hasPerfDomainViews ? [perfDomainViews, perf] : [insights, perf]),
      {
        label: t('Boards'),
        analyticsKey: 'customizable-dashboards',
        to: '/dashboards/',
        icon: <IconDashboard />,
        feature: {
          features: ['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit'],
          hookName: 'feature-disabled:dashboards-sidebar-item',
          requireAll: false,
        },
      },
      {
        label: t('Alerts'),
        analyticsKey: 'alerts',
        to: `/${prefix}/alerts/rules/`,
        icon: <IconSiren />,
      },
    ],
    footer: [
      {
        label: t('Help'),
        icon: <IconQuestion />,
        analyticsKey: 'help',
        dropdown: [
          {
            key: 'search',
            label: t('Search Support, Docs and More'),
            onAction() {
              openHelpSearchModal({organization});
            },
          },
          {
            key: 'help',
            label: t('Visit Help Center'),
            to: 'https://sentry.zendesk.com/hc/en-us',
          },
          {
            key: 'discord',
            label: t('Join our Discord'),
            to: 'https://discord.com/invite/sentry',
          },
          {
            key: 'support',
            label: t('Contact Support'),
            to: `mailto:${ConfigStore.get('supportEmail')}`,
          },
        ],
      },
      {
        label: t('Settings'),
        analyticsKey: 'settings',
        to: `/settings/${organization.slug}/`,
        icon: <IconSettings />,
      },
    ],
  };
}
