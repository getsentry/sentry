import {QueryClient} from '@tanstack/react-query';

import {invalidateIssueQueries} from './utils';

describe('invalidateIssueQueries', () => {
  const listKey = ['/organizations/org-slug/issues/', {}, {infinite: false}];
  const firstIssueKey = ['/organizations/org-slug/issues/1/', {}, {infinite: false}];
  const firstIssueEventsKey = [
    '/organizations/org-slug/issues/1/events/',
    {},
    {infinite: false},
  ];
  const secondIssueKey = ['/organizations/org-slug/issues/2/', {}, {infinite: false}];
  const otherOrganizationKey = [
    '/organizations/other-org/issues/',
    {},
    {infinite: false},
  ];
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    for (const key of [
      listKey,
      firstIssueKey,
      firstIssueEventsKey,
      secondIssueKey,
      otherOrganizationKey,
    ]) {
      queryClient.setQueryData(key, []);
    }
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('leaves all cached queries valid for an empty selection', () => {
    invalidateIssueQueries({itemIds: [], organizationSlug: 'org-slug', queryClient});

    for (const query of queryClient.getQueryCache().getAll()) {
      expect(query.state.isInvalidated).toBe(false);
    }
  });

  it('invalidates only selected issue queries for an explicit selection', () => {
    invalidateIssueQueries({itemIds: ['1'], organizationSlug: 'org-slug', queryClient});

    expect(queryClient.getQueryState(firstIssueKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(firstIssueEventsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(secondIssueKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherOrganizationKey)?.isInvalidated).toBe(false);
  });

  it('invalidates all issue queries in the organization for an all-query selection', () => {
    invalidateIssueQueries({
      itemIds: undefined,
      organizationSlug: 'org-slug',
      queryClient,
    });

    for (const key of [listKey, firstIssueKey, firstIssueEventsKey, secondIssueKey]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
    expect(queryClient.getQueryState(otherOrganizationKey)?.isInvalidated).toBe(false);
  });
});
