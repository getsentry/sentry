import type {PageFilters} from 'sentry/types/core';
import type {
  GroupStatusResolution,
  MarkReviewed,
  PriorityLevel,
  TagValue,
} from 'sentry/types/group';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

export type TagValueLoader = (key: string, search: string) => Promise<TagValue[]>;

export type IssueUpdateData =
  | {isBookmarked: boolean}
  | {isSubscribed: boolean}
  | {priority: PriorityLevel}
  | MarkReviewed
  | GroupStatusResolution;

export type GroupSearchView = {
  environments: string[];
  id: string;
  isAllProjects: boolean;
  name: string;
  projects: number[];
  query: string;
  querySort: IssueSortOptions;
  timeFilters: PageFilters['datetime'];
};

export interface UpdateGroupSearchViewPayload extends Omit<GroupSearchView, 'id'> {
  environments: string[];
  isAllProjects: boolean;
  projects: number[];
  timeFilters: PageFilters['datetime'];
  id?: string;
}
