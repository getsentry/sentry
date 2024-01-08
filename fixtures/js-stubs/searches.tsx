import {SearchFixture} from 'sentry-fixture/search';

import {SavedSearch} from 'sentry/types';

export function SearchesFixture(params: SavedSearch[] = []): SavedSearch[] {
  return [
    SearchFixture({
      name: 'Needs Triage',
      query: 'is:unresolved is:unassigned',
      sort: 'date',
      id: '2',
      isGlobal: true,
    }),
    SearchFixture({
      name: 'Unresolved Issues',
      query: 'is:unresolved',
      sort: 'date',
      id: '1',
      isGlobal: true,
    }),
    ...params,
  ];
}
