import {Fragment, useEffect, useMemo, useRef} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import Feature from 'sentry/components/acl/feature';
import {limitedMetricsSupportPrefixes} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  MAX_STARRED_SAVED_QUERIES_IN_NAV,
  useGetSavedQueries,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/conversations/settings';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {ExploreSavedQueryNavigationItems} from 'sentry/views/navigation/secondary/sections/explore/exploreSavedQueryNavigationItems';

export function ExploreSecondaryNavigation() {
  const organization = useOrganization();
  const {projects} = useProjects();

  const baseUrl = `/organizations/${organization.slug}/explore`;

  const {data: starredQueries} = useGetSavedQueries({
    starred: true,
    perPage: MAX_STARRED_SAVED_QUERIES_IN_NAV,
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
      <SecondaryNavigation.Header>{t('Explore')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="explore-main">
          <SecondaryNavigation.List>
            <Feature features={['performance-view']}>
              <Feature features={['visibility-explore-view']}>
                <SecondaryNavigation.ListItem>
                  <SecondaryNavigation.Link
                    to={`${baseUrl}/traces/`}
                    analyticsItemName="explore_traces"
                  >
                    {t('Traces')}
                  </SecondaryNavigation.Link>
                </SecondaryNavigation.ListItem>
              </Feature>
            </Feature>
            <Feature features="ourlogs-enabled">
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/logs/`}
                  analyticsItemName="explore_logs"
                >
                  {t('Logs')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            {hasMetricsSupportedPlatform && (
              <Feature features="tracemetrics-enabled">
                <SecondaryNavigation.ListItem>
                  <SecondaryNavigation.Link
                    to={`${baseUrl}/metrics/`}
                    analyticsItemName="explore_metrics"
                    trailingItems={<FeatureBadge type="beta" />}
                  >
                    {t('Metrics')}
                  </SecondaryNavigation.Link>
                </SecondaryNavigation.ListItem>
              </Feature>
            )}
            <Feature features="organizations:explore-errors">
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/errors/`}
                  activeTo={`${baseUrl}/errors/`}
                  analyticsItemName="explore_errors"
                  trailingItems={<FeatureBadge type="alpha" />}
                >
                  {t('Errors')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature
              features="discover-basic"
              hookName="feature-disabled:discover2-sidebar-item"
            >
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/discover/homepage/`}
                  activeTo={`${baseUrl}/discover/`}
                  analyticsItemName="explore_discover"
                >
                  {t('Discover')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature
              features="profiling"
              hookName="feature-disabled:profiling-sidebar-item"
            >
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/profiling/`}
                  analyticsItemName="explore_profiles"
                >
                  {t('Profiles')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature
              features="session-replay-ui"
              hookName="feature-disabled:replay-sidebar-item"
            >
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/replays/`}
                  analyticsItemName="explore_replays"
                >
                  {t('Replays')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/releases/`}
                analyticsItemName="explore_releases"
              >
                {t('Releases')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <Feature features="gen-ai-conversations">
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/${CONVERSATIONS_LANDING_SUB_PATH}/`}
                  analyticsItemName="explore_conversations"
                  trailingItems={<FeatureBadge type="alpha" />}
                >
                  {t('Conversations')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <Feature features={['visibility-explore-view', 'performance-view']}>
          <Fragment>
            <SecondaryNavigation.Separator />
            <SecondaryNavigation.Section id="explore-all-queries">
              <SecondaryNavigation.List>
                <SecondaryNavigation.ListItem>
                  <SecondaryNavigation.Link to={`${baseUrl}/saved-queries/`}>
                    {t('All Queries')}
                  </SecondaryNavigation.Link>
                </SecondaryNavigation.ListItem>
              </SecondaryNavigation.List>
            </SecondaryNavigation.Section>
            {starredQueries && starredQueries.length > 0 && (
              <Fragment>
                <SecondaryNavigation.Separator />
                <SecondaryNavigation.Section
                  id="explore-starred-queries"
                  title={t('Starred Queries')}
                >
                  <ExploreSavedQueryNavigationItems queries={starredQueries} />
                </SecondaryNavigation.Section>
              </Fragment>
            )}
          </Fragment>
        </Feature>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
