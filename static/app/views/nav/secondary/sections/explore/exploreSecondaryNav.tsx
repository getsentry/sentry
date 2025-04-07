import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {getExploreUrlFromSavedQueryUrl} from 'sentry/views/explore/utils';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function ExploreSecondaryNav() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/explore`;

  const {data: starredQueries} = useGetSavedQueries({
    starred: true,
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
          <Feature features="performance-saved-queries">
            <SecondaryNav.Item to={`${baseUrl}/saved-queries/`}>
              {t('All Queries')}
            </SecondaryNav.Item>
          </Feature>
        </SecondaryNav.Section>
        <Feature features="performance-saved-queries">
          <SecondaryNav.Section title={t('Starred Queries')}>
            {starredQueries?.map(query => (
              <SecondaryNav.Item
                key={query.id}
                to={getExploreUrlFromSavedQueryUrl({savedQuery: query, organization})}
                analyticsItemName="explore_starred_item"
              >
                {query.name}
              </SecondaryNav.Item>
            )) ?? null}
          </SecondaryNav.Section>
        </Feature>
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}
