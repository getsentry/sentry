import {QueryClient} from '@tanstack/react-query';

import {apiOptions} from './apiOptions';
import {isApiQueryKey} from './apiQueryKey';

function issuesOptions(organizationIdOrSlug: string, query?: Record<string, string>) {
  return apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug},
    query,
    staleTime: 0,
  });
}

function issueOptions(organizationIdOrSlug: string, issueId: string) {
  return apiOptions.as<unknown>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/',
    {path: {organizationIdOrSlug, issueId}, staleTime: 0}
  );
}

function issuesInfiniteOptions(organizationIdOrSlug: string) {
  return apiOptions.asInfinite<unknown>()(
    '/organizations/$organizationIdOrSlug/issues/',
    {path: {organizationIdOrSlug}, staleTime: 0}
  );
}

function seedCache() {
  const queryClient = new QueryClient();
  const keys = {
    acmeIssues: issuesOptions('acme').queryKey,
    acmeIssuesFiltered: issuesOptions('acme', {query: 'is:unresolved'}).queryKey,
    acmeIssuesInfinite: issuesInfiniteOptions('acme').queryKey,
    acmeIssue: issueOptions('acme', '1').queryKey,
    otherIssues: issuesOptions('other').queryKey,
    nonApi: ['bootstrap-projects'],
  };
  Object.values(keys).forEach(queryKey => queryClient.setQueryData(queryKey, {}));

  const matching = (queryKey: readonly unknown[]) =>
    Object.entries(keys)
      .filter(([, key]) =>
        queryClient
          .getQueryCache()
          .findAll({queryKey})
          .some(query => query.queryKey === key)
      )
      .map(([name]) => name)
      .sort();

  return {keys, matching};
}

describe('apiQueryKey', () => {
  describe('isApiQueryKey', () => {
    it('accepts keys from apiOptions, also with trailing elements', () => {
      const {queryKey} = issuesOptions('acme');
      expect(isApiQueryKey(queryKey)).toBe(true);
      expect(isApiQueryKey([...queryKey, {sessionKey: 'session'}])).toBe(true);
      expect(isApiQueryKey(issuesInfiniteOptions('acme').queryKey)).toBe(true);
    });

    it('rejects keys that are not api keys', () => {
      expect(isApiQueryKey([])).toBe(false);
      expect(isApiQueryKey(['bootstrap-projects'])).toBe(false);
      expect(isApiQueryKey(['/organizations/acme/issues/', {}, {infinite: false}])).toBe(
        false
      );
    });
  });

  describe('apiOptions keys as filters', () => {
    it('match both variants of the url, with any other options', () => {
      const {matching} = seedCache();

      expect(matching(issuesOptions('acme').queryKey)).toEqual([
        'acmeIssues',
        'acmeIssuesFiltered',
        'acmeIssuesInfinite',
      ]);
    });

    it('match only infinite queries when built with asInfinite', () => {
      const {matching} = seedCache();

      expect(matching(issuesInfiniteOptions('acme').queryKey)).toEqual([
        'acmeIssuesInfinite',
      ]);
    });

    it('narrow the match by their options', () => {
      const {matching} = seedCache();

      expect(matching(issuesOptions('acme', {query: 'is:unresolved'}).queryKey)).toEqual([
        'acmeIssuesFiltered',
      ]);
    });
  });

  describe('partial matching', () => {
    it('matches all organizations below a url template prefix', () => {
      const {matching} = seedCache();

      expect(
        matching(['_api', {urlParts: ['organizations', '$organizationIdOrSlug']}])
      ).toEqual([
        'acmeIssue',
        'acmeIssues',
        'acmeIssuesFiltered',
        'acmeIssuesInfinite',
        'otherIssues',
      ]);
    });

    it('narrows a url template prefix by path params', () => {
      const {matching} = seedCache();

      expect(
        matching([
          '_api',
          {
            urlParts: ['organizations', '$organizationIdOrSlug', 'issues'],
            options: {path: {organizationIdOrSlug: 'acme'}},
          },
        ])
      ).toEqual(['acmeIssue', 'acmeIssues', 'acmeIssuesFiltered', 'acmeIssuesInfinite']);
    });

    it('narrows by infinite and by query options', () => {
      const {matching} = seedCache();

      expect(matching(['_api', {infinite: true}])).toEqual(['acmeIssuesInfinite']);
      expect(matching(['_api', {options: {query: {query: 'is:unresolved'}}}])).toEqual([
        'acmeIssuesFiltered',
      ]);
    });
  });
});
