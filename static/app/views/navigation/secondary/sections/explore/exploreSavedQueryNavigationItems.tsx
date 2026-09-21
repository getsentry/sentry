import {useMemo} from 'react';

import {InfoText} from '@sentry/scraps/info';

import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  getSavedQueryKey,
  type AllSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useReorderStarredSavedQueries} from 'sentry/views/explore/hooks/useReorderStarredSavedQueries';
import {getSavedQueryTraceItemUrl} from 'sentry/views/explore/utils';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

type Props = {
  queries: AllSavedQuery[];
};

// ReorderableList keys by `item.id`, and ids are only unique within a table.
type ReorderableItem = {
  id: string;
  query: AllSavedQuery;
};

export function ExploreSavedQueryNavigationItems({queries}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const id = decodeScalar(location.query.id);

  const {projects} = useProjects();

  const reorderStarredSavedQueries = useReorderStarredSavedQueries();

  const items: ReorderableItem[] = useMemo(
    () => queries.map(query => ({id: getSavedQueryKey(query), query})),
    [queries]
  );

  return (
    <SecondaryNavigation.ReorderableList
      items={items}
      onDragEnd={newItems => {
        reorderStarredSavedQueries(newItems.map(({query}) => query));
      }}
    >
      {({query}) => (
        <SecondaryNavigation.ReorderableLink
          to={getSavedQueryTraceItemUrl({savedQuery: query, organization})}
          analyticsItemName="explore_starred_item"
          isActive={id === query.id.toString()}
          icon={
            <SecondaryNavigation.ProjectIcon
              projectPlatforms={projects
                .filter(p => (query.projects ?? []).map(String).includes(p.id))
                .map(p => p.platform)
                .filter(defined)}
              allProjects={query.projects?.length === 1 && query.projects[0] === -1}
            />
          }
        >
          <InfoText
            title={query.name}
            position="top"
            mode="overflowOnly"
            variant="inherit"
          >
            {query.name}
          </InfoText>
        </SecondaryNavigation.ReorderableLink>
      )}
    </SecondaryNavigation.ReorderableList>
  );
}
