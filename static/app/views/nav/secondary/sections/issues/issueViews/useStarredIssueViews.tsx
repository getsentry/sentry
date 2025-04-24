import {useCallback} from 'react';

import {defined} from 'sentry/utils';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {StarredGroupSearchView} from 'sentry/views/issueList/types';
import type {NavIssueView} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItems';

export function useStarredIssueViews() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {data: groupSearchViews} = useApiQuery<StarredGroupSearchView[]>(
    makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
    {notifyOnChangeProps: ['data'], staleTime: 0}
  );

  const starredViews =
    groupSearchViews
      // XXX (malwilley): Issue views without the nav require at least one issue view,
      // so they respond with "fake" issue views that do not have an ID.
      // We should remove this from the backend and here once we remove the tab-based views.
      ?.filter(view => defined(view.id))
      .map(convertGSVtoIssueView) ?? [];

  const setStarredIssueViews = useCallback(
    (newViews: NavIssueView[]) => {
      setApiQueryData<StarredGroupSearchView[]>(
        queryClient,
        makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
        newViews.map(convertIssueViewToGSV)
      );
    },
    [queryClient, organization.slug]
  );

  return {starredViews, setStarredIssueViews};
}

export const convertGSVtoIssueView = (gsv: StarredGroupSearchView): NavIssueView => {
  return {
    id: gsv.id,
    label: gsv.name,
    query: gsv.query,
    querySort: gsv.querySort,
    environments: gsv.environments,
    timeFilters: gsv.timeFilters,
    projects: gsv.projects,
    lastVisited: gsv.lastVisited,
    stars: gsv.stars,
    createdBy: gsv.createdBy,
  };
};

const convertIssueViewToGSV = (view: NavIssueView): StarredGroupSearchView => {
  return {
    id: view.id,
    name: view.label,
    query: view.query,
    querySort: view.querySort,
    projects: view.projects,
    environments: view.environments,
    timeFilters: view.timeFilters,
    lastVisited: view.lastVisited,
    createdBy: view.createdBy,
    stars: view.stars,
  };
};
