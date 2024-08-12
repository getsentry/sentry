import type {
  GroupStatusResolution,
  MarkReviewed,
  PriorityLevel,
  TagValue,
} from 'sentry/types';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

export type TagValueLoader = (key: string, search: string) => Promise<TagValue[]>;

export type IssueUpdateData =
  | {isBookmarked: boolean}
  | {isSubscribed: boolean}
  | {priority: PriorityLevel}
  | MarkReviewed
  | GroupStatusResolution;

export type GroupSearchView = {
  name: string;
  query: string;
  querySort: IssueSortOptions;
  id?: string;
};

// Id is always returned by the response
export type GroupSearchViewResponse = {
  id: string;
  name: string;
  query: string;
  querySort: IssueSortOptions;
};
