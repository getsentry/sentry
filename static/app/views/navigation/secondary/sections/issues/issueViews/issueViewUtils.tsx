import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {AvatarUser} from 'sentry/types/user';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {IssueViewParams} from 'sentry/views/issueList/issueViews/utils';

export interface IssueView extends IssueViewParams {
  createdBy: AvatarUser | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  label: string;
  lastVisited: string | null;
  stars: number;
}

export const constructViewLink = (baseUrl: string, view: IssueView) => {
  return normalizeUrl({
    pathname: `${baseUrl}/views/${view.id}/`,
    query: {
      query: view.query,
      sort: view.querySort,
      project: view.projects,
      environment: view.environments,
      ...normalizeDateTimeParams(view.timeFilters),
      cursor: undefined,
      page: undefined,
    },
  });
};
