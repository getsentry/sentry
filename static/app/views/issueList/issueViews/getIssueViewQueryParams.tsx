import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {GroupSearchView} from 'sentry/views/issueList/types';

export function getIssueViewQueryParams({view}: {view: GroupSearchView}) {
  return {
    query: view.query,
    sort: view.querySort,
    project: view.projects.length > 0 ? view.projects.map(String) : undefined,
    environment: view.environments.length > 0 ? view.environments : undefined,
    ...normalizeDateTimeParams(view.timeFilters),
  };
}
