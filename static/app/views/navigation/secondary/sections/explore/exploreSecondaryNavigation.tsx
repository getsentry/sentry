import {Fragment, useEffect, useMemo, useRef} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import Feature from 'sentry/components/acl/feature';
import {limitedMetricsSupportPrefixes} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useGetSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/conversations/settings';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';
import {ExploreSavedQueryNavigationItems} from 'sentry/views/navigation/secondary/sections/explore/exploreSavedQueryNavigationItems';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

const MAX_STARRED_QUERIES_DISPLAYED = 20;

export function ExploreSecondaryNavigation() {
  const organization = useOrganization();
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
      <SecondaryNavigation.Header>
        {PRIMARY_NAVIGATION_GROUP_CONFIG[PrimaryNavigationGroup.EXPLORE].label}
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="explore-main">
          <Feature features={['performance-view']}>
            <Feature features={['visibility-explore-view']}>
              <SecondaryNavigation.Item
                to={`${baseUrl}/traces/`}
                analyticsItemName="explore_traces"
              >
                {t('Traces')}
              </SecondaryNavigation.Item>
            </Feature>
          </Feature>
          <Feature features="ourlogs-enabled">
            <SecondaryNavigation.Item
              to={`${baseUrl}/logs/`}
              analyticsItemName="explore_logs"
            >
              {t('Logs')}
            </SecondaryNavigation.Item>
          </Feature>
          {hasMetricsSupportedPlatform && (
            <Feature features="tracemetrics-enabled">
              <SecondaryNavigation.Item
                to={`${baseUrl}/metrics/`}
                analyticsItemName="explore_metrics"
                trailingItems={<FeatureBadge type="beta" />}
              >
                {t('Metrics')}
              </SecondaryNavigation.Item>
            </Feature>
          )}
          <Feature
            features="discover-basic"
            hookName="feature-disabled:discover2-sidebar-item"
          >
            <SecondaryNavigation.Item
              to={`${baseUrl}/discover/homepage/`}
              activeTo={`${baseUrl}/discover/`}
              analyticsItemName="explore_discover"
            >
              {t('Discover')}
            </SecondaryNavigation.Item>
          </Feature>
          <Feature
            features="profiling"
            hookName="feature-disabled:profiling-sidebar-item"
          >
            <SecondaryNavigation.Item
              to={`${baseUrl}/profiling/`}
              analyticsItemName="explore_profiles"
            >
              {t('Profiles')}
            </SecondaryNavigation.Item>
          </Feature>
          <Feature
            features="session-replay-ui"
            hookName="feature-disabled:replay-sidebar-item"
          >
            <SecondaryNavigation.Item
              to={`${baseUrl}/replays/`}
              analyticsItemName="explore_replays"
            >
              {t('Replays')}
            </SecondaryNavigation.Item>
          </Feature>
          <SecondaryNavigation.Item
            to={`${baseUrl}/releases/`}
            analyticsItemName="explore_releases"
          >
            {t('Releases')}
          </SecondaryNavigation.Item>
          <Feature features="gen-ai-conversations">
            <SecondaryNavigation.Item
              to={`${baseUrl}/${CONVERSATIONS_LANDING_SUB_PATH}/`}
              analyticsItemName="explore_conversations"
              trailingItems={<FeatureBadge type="alpha" />}
            >
              {t('Conversations')}
            </SecondaryNavigation.Item>
          </Feature>
        </SecondaryNavigation.Section>
        <Feature features={['visibility-explore-view', 'performance-view']}>
          <SecondaryNavigation.Section id="explore-all-queries">
            <SecondaryNavigation.Item to={`${baseUrl}/saved-queries/`}>
              {t('All Queries')}
            </SecondaryNavigation.Item>
          </SecondaryNavigation.Section>
          {starredQueries && starredQueries.length > 0 && (
            <SecondaryNavigation.Section
              id="explore-starred-queries"
              title={t('Starred Queries')}
            >
              <ExploreSavedQueryNavigationItems queries={starredQueries} />
            </SecondaryNavigation.Section>
          )}
        </Feature>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
