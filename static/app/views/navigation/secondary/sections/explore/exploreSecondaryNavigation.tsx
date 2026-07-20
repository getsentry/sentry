import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {
  MAX_STARRED_SAVED_QUERIES_IN_NAV,
  useGetSavedQueries,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {ExploreSavedQueryNavigationItems} from 'sentry/views/navigation/secondary/sections/explore/exploreSavedQueryNavigationItems';

export function ExploreSecondaryNavigation() {
  const organization = useOrganization();

  const baseUrl = `/organizations/${organization.slug}/explore`;

  const {data: starredQueries} = useGetSavedQueries({
    starred: true,
    perPage: MAX_STARRED_SAVED_QUERIES_IN_NAV,
  });

  const discoverTransactionsDeprecation = getDiscoverDeprecation(organization);

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
            <Feature features="tracemetrics-enabled">
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/metrics/`}
                  analyticsItemName="explore_metrics"
                  trailingItems={<FeatureBadge type="new" />}
                >
                  {t('Metrics')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature features="organizations:explore-errors">
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/errors-v2/`}
                  activeTo={`${baseUrl}/errors-v2/`}
                  analyticsItemName="explore_errors"
                  trailingItems={<FeatureBadge type="alpha" />}
                >
                  {t('Errors')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature
              features="discover-basic"
              overrideName="feature-disabled:discover2-sidebar-item"
            >
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={
                    discoverTransactionsDeprecation
                      ? `${baseUrl}/errors/homepage/`
                      : `${baseUrl}/discover/homepage/`
                  }
                  activeTo={
                    discoverTransactionsDeprecation
                      ? `${baseUrl}/errors/`
                      : `${baseUrl}/discover/`
                  }
                  analyticsItemName="explore_discover"
                >
                  {discoverTransactionsDeprecation ? t('Errors') : t('Discover')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature
              features="profiling"
              overrideName="feature-disabled:profiling-sidebar-item"
            >
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/profiles/`}
                  analyticsItemName="explore_profiles"
                >
                  {t('Profiles')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature
              features="session-replay-ui"
              overrideName="feature-disabled:replay-sidebar-item"
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
                activeTo={[
                  `${baseUrl}/releases/`,
                  `/organizations/${organization.slug}/preprod/`,
                ]}
                analyticsItemName="explore_releases"
              >
                {t('Releases')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <Feature features="gen-ai-conversations">
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  // TODO: Remove once query performance is improved - defaults to 24h to avoid slow loads
                  to={{
                    pathname: `${baseUrl}/${CONVERSATIONS_LANDING_SUB_PATH}/`,
                    search: '?statsPeriod=24h&referrer=sidebar',
                  }}
                  analyticsItemName="explore_conversations"
                  trailingItems={<FeatureBadge type="beta" />}
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
