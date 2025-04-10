import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {ExploreSavedQueryNavItems} from 'sentry/views/nav/secondary/sections/explore/exploreSavedQueryNavItems';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

const MAX_STARRED_QUERIES_DISPLAYED = 20;

export function ExploreSecondaryNav() {
  const organization = useOrganization();

  const baseUrl = `/organizations/${organization.slug}/explore`;

  const {data: starredQueries} = useGetSavedQueries({
    starred: true,
    perPage: MAX_STARRED_QUERIES_DISPLAYED,
  });

  return (
    <SecondaryNav>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.EXPLORE].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section>
          <Feature features={['performance-trace-explorer', 'performance-view']}>
            <SecondaryNav.Item
              to={`${baseUrl}/traces/`}
              analyticsItemName="explore_traces"
            >
              {t('Traces')}
            </SecondaryNav.Item>
          </Feature>
          <Feature features="ourlogs-enabled">
            <SecondaryNav.Item to={`${baseUrl}/logs/`} analyticsItemName="explore_logs">
              {t('Logs')}
            </SecondaryNav.Item>
          </Feature>
          <Feature features="profiling">
            <SecondaryNav.Item
              to={`${baseUrl}/profiling/`}
              analyticsItemName="explore_profiles"
            >
              {t('Profiles')}
            </SecondaryNav.Item>
          </Feature>
          <Feature features="session-replay-ui">
            <SecondaryNav.Item
              to={`${baseUrl}/replays/`}
              analyticsItemName="explore_replays"
            >
              {t('Replays')}
            </SecondaryNav.Item>
          </Feature>
          <Feature features="discover-basic">
            <SecondaryNav.Item
              to={`${baseUrl}/discover/homepage/`}
              activeTo={`${baseUrl}/discover/`}
              analyticsItemName="explore_discover"
            >
              {t('Discover')}
            </SecondaryNav.Item>
          </Feature>
          <SecondaryNav.Item
            to={`${baseUrl}/releases/`}
            analyticsItemName="explore_releases"
          >
            {t('Releases')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <Feature features="performance-saved-queries">
          <SecondaryNav.Section title={t('Starred Queries')}>
            {starredQueries && starredQueries.length > 0 && (
              <ExploreSavedQueryNavItems queries={starredQueries} />
            )}
          </SecondaryNav.Section>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/saved-queries/`}>
              {t('All Queries')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </Feature>
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}
