import {UserFixture} from 'sentry-fixture/user';

import type {GroupSearchView} from 'sentry/views/issueList/types';
import {GroupSearchViewVisibility} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

export function GroupSearchViewFixture(
  params: Partial<GroupSearchView> = {}
): GroupSearchView {
  return {
    id: '123',
    name: 'Test View',
    query: 'is:unresolved',
    querySort: IssueSortOptions.DATE,
    projects: [1],
    environments: ['prod'],
    timeFilters: {
      start: null,
      end: null,
      period: '7d',
      utc: null,
    },
    lastVisited: null,
    visibility: GroupSearchViewVisibility.ORGANIZATION,
    starred: false,
    createdBy: UserFixture(),
    stars: 0,
    dateCreated: '2025-04-25',
    dateUpdated: '2025-04-25',
    ...params,
  };
}
