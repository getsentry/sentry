import {GroupFixture} from 'sentry-fixture/group';

import IssueListCacheStore from './IssueListCacheStore';

describe('IssueListCacheStore', () => {
  beforeEach(() => {
    IssueListCacheStore.reset();
  });

  it('should add an issue list to the cache', () => {
    const issueList = [
      GroupFixture({id: '1', title: 'Issue 1'}),
      GroupFixture({id: '2', title: 'Issue 2'}),
    ];
    const query = {query: 'is:unresolved'};
    IssueListCacheStore.save(query, {
      groups: issueList,
      queryCount: 2,
      queryMaxCount: 100,
      pageLinks: '',
    });

    expect(IssueListCacheStore.getFromCache(query)).toEqual(issueList);
  });

  it('returns a stable reference with getState', () => {
    const state = IssueListCacheStore.getState();
    expect(Object.is(state, IssueListCacheStore.getState())).toBe(true);
  });
});
