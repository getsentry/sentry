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
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';

/**
 * Global nav settings for all Sentry users.
 * Links are generated per-organization with the proper `/organization/:slug/` prefix.
 *
 * To permission-gate certain items, include props to be passed to the `<Feature>` component
 */
export function createNavConfig({organization}: {organization: Organization}): NavConfig {
  const prefix = `organizations/${organization.slug}`;
  const hasPerformanceDomainViews =
    organization.features.includes('insights-domain-view');

  const legacyInsights: NavSidebarItem = {
    label: t('Insights'),
    icon: <IconGraph />,
    id: 'insights',
    to: `organizations/${organization.slug}/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS.http}/`,
    feature: {features: 'insights-entry-points'},
  };

  const legacyPerformance: NavSidebarItem = {
    label: t('Perf.'),
    to: `/${prefix}/performance/`,
    id: 'performance',
    icon: <IconLightning />,
    feature: {
      features: 'performance-view',
      hookName: 'feature-disabled:performance-sidebar-item',
    },
  };

  const performanceDomain: NavSidebarItem = {
    label: t('Perf.'),
    icon: <IconLightning />,
    id: 'performance',
    to: `/${prefix}/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}/`,
    feature: {features: ['insights-domain-view', 'performance-view']},
  };

  const performance = hasPerformanceDomainViews
    ? [performanceDomain]
    : [legacyInsights, legacyPerformance];

  return {
    main: [
      {
        label: t('Issues'),
        icon: <IconIssues />,
        id: 'issues',
        to: `/${prefix}/issues/`,
      },
      {
        label: t('Projects'),
        id: 'projects',
        to: `/${prefix}/projects/`,
        icon: <IconProject />,
      },
      {
        label: t('Explore'),
        icon: <IconSearch />,
        id: 'explore',
        to: `/${prefix}/traces/`,
      },
      ...performance,
      {
        label: t('Boards'),
        to: '/dashboards/',
        icon: <IconDashboard />,
        id: 'boards',
        feature: {
          features: ['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit'],
          hookName: 'feature-disabled:dashboards-sidebar-item',
          requireAll: false,
        },
      },
      {
        label: t('Alerts'),
        id: 'alerts',
        to: `/${prefix}/alerts/rules/`,
        icon: <IconSiren />,
      },
    ],
    footer: [
      {
        label: t('Help'),
        id: 'help',
        icon: <IconQuestion />,
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
        id: 'settings',
        to: `/settings/${organization.slug}/`,
        icon: <IconSettings />,
      },
    ],
  };
}
