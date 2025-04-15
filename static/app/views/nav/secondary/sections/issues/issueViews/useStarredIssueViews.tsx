import {useCallback} from 'react';

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

  const starredViews = groupSearchViews?.map(convertGSVtoIssueView) ?? [];

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
  };
};

export const convertIssueViewToGSV = (view: NavIssueView): StarredGroupSearchView => {
  return {
    id: view.id,
    name: view.label,
    query: view.query,
    querySort: view.querySort,
    projects: view.projects,
    environments: view.environments,
    timeFilters: view.timeFilters,
    lastVisited: view.lastVisited,
  };
};
