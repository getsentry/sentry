import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import type {NavConfig} from 'sentry/components/nav/utils';
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
import {
  AI_LANDING_SUB_PATH,
  AI_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/ai/settings';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/backend/settings';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/frontend/settings';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_SIDEBAR_LABEL,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {getSearchForIssueGroup, IssueGroup} from 'sentry/views/issueList/utils';

/**
 * Global nav settings for all Sentry users.
 * Links are generated per-organization with the proper `/organization/:slug/` prefix.
 *
 * To permission-gate certain items, include props to be passed to the `<Feature>` component
 */
export function createNavConfig({organization}: {organization: Organization}): NavConfig {
  const prefix = `organizations/${organization.slug}`;

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
      {
        label: t('Insights'),
        icon: <IconGraph />,
        analyticsKey: 'insights-domains',
        feature: {features: ['performance-view']},
        submenu: [
          {
            label: FRONTEND_SIDEBAR_LABEL,
            to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}/`,
          },
          {
            label: BACKEND_SIDEBAR_LABEL,
            to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`,
          },
          {
            label: MOBILE_SIDEBAR_LABEL,
            to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${MOBILE_LANDING_SUB_PATH}/`,
          },
          {
            label: AI_SIDEBAR_LABEL,
            to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/`,
          },
        ],
      },
      {
        label: t('Perf.'),
        to: '/performance/',
        analyticsKey: 'performance',
        icon: <IconLightning />,
        feature: {
          features: 'performance-view',
          hookName: 'feature-disabled:performance-sidebar-item',
        },
      },
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
