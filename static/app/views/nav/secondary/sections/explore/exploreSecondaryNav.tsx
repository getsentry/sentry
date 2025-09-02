import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {t} from 'sentry/locale';
import localStorage from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {ExploreSavedQueryNavItems} from 'sentry/views/nav/secondary/sections/explore/exploreSavedQueryNavItems';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';

const MAX_STARRED_QUERIES_DISPLAYED = 20;

export function ExploreSecondaryNav() {
  const organization = useOrganization();
  const location = useLocation();

  const baseUrl = `/organizations/${organization.slug}/explore`;

  const {data: starredQueries} = useGetSavedQueries({
    starred: true,
    perPage: MAX_STARRED_QUERIES_DISPLAYED,
  });

  const ourlogsSeenKey = `sidebar-new-seen:ourlogs`;
  const showOurlogsNew = !localStorage.getItem(ourlogsSeenKey);

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
            <SecondaryNav.Item
              to={`${baseUrl}/logs/`}
              analyticsItemName="explore_logs"
              trailingItems={showOurlogsNew ? <FeatureBadge type="new" /> : null}
              onMouseDown={() => {
                localStorage.setItem(ourlogsSeenKey, 'true');
              }}
              onTouchStart={() => {
                localStorage.setItem(ourlogsSeenKey, 'true');
              }}
            >
              {t('Logs')}
            </SecondaryNav.Item>
          </Feature>
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
