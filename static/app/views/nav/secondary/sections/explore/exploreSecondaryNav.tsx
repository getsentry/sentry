import {Fragment, useEffect, useMemo, useRef} from 'react';

import Feature from 'sentry/components/acl/feature';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {limitedMetricsSupportPrefixes} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useGetSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {ExploreSavedQueryNavItems} from 'sentry/views/nav/secondary/sections/explore/exploreSavedQueryNavItems';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';

const MAX_STARRED_QUERIES_DISPLAYED = 20;

export function ExploreSecondaryNav() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();

  const baseUrl = `/organizations/${organization.slug}/explore`;

  const {data: starredQueries} = useGetSavedQueries({
    starred: true,
    perPage: MAX_STARRED_QUERIES_DISPLAYED,
  });

  const userPlatforms = useMemo(
    () =>
      Array.from(
        new Set(projects.map(project => (project.platform as PlatformKey) || 'unknown'))
      ).sort(),
    [projects]
  );

  const metricsSupportedPlatformNameRef = useRef<string | undefined>(undefined);

  if (!metricsSupportedPlatformNameRef.current) {
    const metricsSupportedPlatform = projects.find(project => {
      const platform = project.platform || 'unknown';
      return Array.from(limitedMetricsSupportPrefixes).find(prefix =>
        platform.startsWith(prefix)
      );
    });
    metricsSupportedPlatformNameRef.current = metricsSupportedPlatform?.slug;
  }

  const hasMetricsSupportedPlatform = !!metricsSupportedPlatformNameRef.current;

  useEffect(() => {
    if (userPlatforms.length === 0) {
      return;
    }
    trackAnalytics('metrics.nav.rendered', {
      organization,
      has_feature_flag: canUseMetricsUI(organization),
      has_metrics_supported_platform: hasMetricsSupportedPlatform,
      metrics_supported_platform_name: metricsSupportedPlatformNameRef.current,
      metrics_tab_visible: hasMetricsSupportedPlatform && canUseMetricsUI(organization),
    });
  }, [organization, hasMetricsSupportedPlatform, userPlatforms.length]);

  return (
    <Fragment>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.EXPLORE].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section id="explore-main">
          <Feature features={['performance-view']}>
            <Feature
              features={['performance-trace-explorer', 'visibility-explore-view']}
              requireAll={false}
            >
              <SecondaryNav.Item
                to={`${baseUrl}/traces/`}
                analyticsItemName="explore_traces"
                isActive={isLinkActive(`${baseUrl}/traces/`, location.pathname)}
              >
                {t('Traces')}
              </SecondaryNav.Item>
            </Feature>
          </Feature>
          <Feature features="ourlogs-enabled">
            <SecondaryNav.Item to={`${baseUrl}/logs/`} analyticsItemName="explore_logs">
              {t('Logs')}
            </SecondaryNav.Item>
          </Feature>
          {hasMetricsSupportedPlatform && (
            <Feature features="tracemetrics-enabled">
              <SecondaryNav.Item
                to={`${baseUrl}/metrics/`}
                analyticsItemName="explore_metrics"
                trailingItems={<FeatureBadge type="beta" />}
              >
                {t('Metrics')}
              </SecondaryNav.Item>
            </Feature>
          )}
          <Feature
            features="discover-basic"
            hookName="feature-disabled:discover2-sidebar-item"
          >
            <SecondaryNav.Item
              to={`${baseUrl}/discover/homepage/`}
              activeTo={`${baseUrl}/discover/`}
              analyticsItemName="explore_discover"
            >
              {t('Discover')}
            </SecondaryNav.Item>
          </Feature>
          <Feature
            features="profiling"
            hookName="feature-disabled:profiling-sidebar-item"
          >
            <SecondaryNav.Item
              to={`${baseUrl}/profiling/`}
              analyticsItemName="explore_profiles"
            >
              {t('Profiles')}
            </SecondaryNav.Item>
          </Feature>
          <Feature
            features="session-replay-ui"
            hookName="feature-disabled:replay-sidebar-item"
          >
            <SecondaryNav.Item
              to={`${baseUrl}/replays/`}
              analyticsItemName="explore_replays"
            >
              {t('Replays')}
            </SecondaryNav.Item>
          </Feature>
          <SecondaryNav.Item
            to={`${baseUrl}/releases/`}
            analyticsItemName="explore_releases"
          >
            {t('Releases')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <Feature features={['visibility-explore-view', 'performance-view']}>
          <SecondaryNav.Section id="explore-all-queries">
            <SecondaryNav.Item to={`${baseUrl}/saved-queries/`}>
              {t('All Queries')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          {starredQueries && starredQueries.length > 0 && (
            <SecondaryNav.Section
              id="explore-starred-queries"
              title={t('Starred Queries')}
            >
              <ExploreSavedQueryNavItems queries={starredQueries} />
            </SecondaryNav.Section>
          )}
        </Feature>
      </SecondaryNav.Body>
    </Fragment>
  );
}
