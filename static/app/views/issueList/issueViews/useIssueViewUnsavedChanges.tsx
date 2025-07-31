import isEqual from 'lodash/isEqual';

import {useLocation} from 'sentry/utils/useLocation';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';

export function useIssueViewUnsavedChanges() {
  const {data: view} = useSelectedGroupSearchView();
  const location = useLocation();

  if (!view) {
    return {
      hasUnsavedChanges: false,
    };
  }

  const queryParams = getIssueViewQueryParams({view});

  const currentViewData = createIssueViewFromUrl({query: queryParams});
  const viewFromUrl = createIssueViewFromUrl({query: location.query});

  const hasUnsavedChanges = !isEqual(currentViewData, viewFromUrl);

  return {
    hasUnsavedChanges,
    changedParams: {
      query: !isEqual(currentViewData.query, viewFromUrl.query),
      querySort: !isEqual(currentViewData.querySort, viewFromUrl.querySort),
      projects: !isEqual(currentViewData.projects, viewFromUrl.projects),
      environments: !isEqual(currentViewData.environments, viewFromUrl.environments),
      timeFilters: !isEqual(currentViewData.timeFilters, viewFromUrl.timeFilters),
    },
  };
}
