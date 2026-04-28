import {useCallback} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import type {StarredGroupSearchView} from 'sentry/views/issueList/types';
import type {IssueView} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';

export function useStarredIssueViews() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const starredOptions = starredGroupSearchViewsApiOptions({
    orgSlug: organization.slug,
  });

  const {data: groupSearchViews} = useQuery({
    ...starredOptions,
    staleTime: 0,
  });

  const starredViews =
    groupSearchViews
      // XXX (malwilley): Issue views without the nav require at least one issue view,
      // so they respond with "fake" issue views that do not have an ID.
      // We should remove this from the backend and here once we remove the tab-based views.
      ?.filter(
        (view): view is StarredGroupSearchView => defined(view) && defined(view.id)
      )
      .map(convertGSVtoIssueView) ?? [];

  const setStarredIssueViews = useCallback(
    (newViews: IssueView[]) => {
      queryClient.setQueryData(starredOptions.queryKey, prevData =>
        prevData ? {...prevData, json: newViews.map(convertIssueViewToGSV)} : prevData
      );
    },
    [queryClient, starredOptions.queryKey]
  );

  return {starredViews, setStarredIssueViews};
}

const convertGSVtoIssueView = (gsv: StarredGroupSearchView): IssueView => {
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
    dateCreated: gsv.dateCreated,
    dateUpdated: gsv.dateUpdated,
  };
};

const convertIssueViewToGSV = (view: IssueView): StarredGroupSearchView => {
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
    dateCreated: view.dateCreated,
    dateUpdated: view.dateUpdated,
  };
};
