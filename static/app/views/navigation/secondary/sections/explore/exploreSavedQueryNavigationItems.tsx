import {Tooltip} from '@sentry/scraps/tooltip';

import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {type SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useReorderStarredSavedQueries} from 'sentry/views/explore/hooks/useReorderStarredSavedQueries';
import {getSavedQueryTraceItemUrl} from 'sentry/views/explore/utils';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

type Props = {
  queries: SavedQuery[];
};

export function ExploreSavedQueryNavigationItems({queries}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const id = getIdFromLocation(location);

  const {projects} = useProjects();

  const reorderStarredSavedQueries = useReorderStarredSavedQueries();

  return (
    <SecondaryNavigation.ReorderableList
      items={queries}
      onDragEnd={newQueries => {
        reorderStarredSavedQueries(newQueries);
      }}
    >
      {query => (
        <SecondaryNavigation.ReorderableLink
          to={getSavedQueryTraceItemUrl({savedQuery: query, organization})}
          analyticsItemName="explore_starred_item"
          isActive={id === query.id.toString()}
          icon={
            <SecondaryNavigation.ProjectIcon
              projectPlatforms={projects
                .filter(p => query.projects.map(String).includes(p.id))
                .map(p => p.platform)
                .filter(defined)}
              allProjects={query.projects.length === 1 && query.projects[0] === -1}
            />
          }
        >
          <Tooltip title={query.name} position="top" showOnlyOnOverflow skipWrapper>
            {query.name}
          </Tooltip>
        </SecondaryNavigation.ReorderableLink>
      )}
    </SecondaryNavigation.ReorderableList>
  );
}
