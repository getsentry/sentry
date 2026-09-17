import type {PageFilterDatetime} from 'sentry/types/core';
import type {
  BaseGroup,
  GroupStatusResolution,
  MarkReviewed,
  PriorityLevel,
  TagValue,
} from 'sentry/types/group';
import type {AvatarUser} from 'sentry/types/user';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

export type TagValueLoader = (key: string, search: string) => Promise<TagValue[]>;

export type IssueUpdateData =
  | {isBookmarked: boolean}
  | {isSubscribed: boolean}
  | {priority: PriorityLevel}
  | MarkReviewed
  | GroupStatusResolution;

export type IssueActionHandler = (
  /** Explicit issue IDs, or undefined for all issues matching the current query. */
  itemIds: string[] | undefined,
  data: IssueUpdateData,
  previousGroups?: BaseGroup[]
) => (() => void) | void;

export enum GroupSearchViewVisibility {
  OWNER = 'owner',
  ORGANIZATION = 'organization',
}

export enum GroupSearchViewCreatedBy {
  ME = 'me',
  OTHERS = 'others',
}

export type StarredGroupSearchView = {
  createdBy: AvatarUser | null;
  dateCreated: string;
  dateUpdated: string;
  environments: string[];
  id: string;
  lastVisited: string | null;
  name: string;
  projects: number[];
  query: string;
  querySort: IssueSortOptions;
  stars: number;
  timeFilters: PageFilterDatetime;
};

export type GroupSearchView = StarredGroupSearchView & {
  starred: boolean;
  visibility: GroupSearchViewVisibility;
};

// Frontend sort options which map to multiple backend sorts
export enum GroupSearchViewSort {
  VIEWED = 'visited',
  POPULARITY = 'popularity',
  NAME_ASC = 'name',
  NAME_DESC = '-name',
  CREATED_ASC = 'created',
  CREATED_DESC = '-created',
}
