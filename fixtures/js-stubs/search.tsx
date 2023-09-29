import {SavedSearch, SavedSearchVisibility} from 'sentry/types';

export function Search(params: Partial<SavedSearch> = {}): SavedSearch {
  return {
    dateCreated: '2017-11-14T02:22:58.026Z',
    isGlobal: false,
    isPinned: false,
    type: 0,
    sort: '',
    name: 'Needs Triage',
    query: 'is:unresolved is:unassigned',
    id: '2',
    visibility: SavedSearchVisibility.ORGANIZATION,
    ...params,
  };
}
