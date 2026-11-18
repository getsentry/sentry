import {QueryClient} from '@tanstack/react-query';

import {apiOptions} from './apiOptions';
import {parseQueryKey, safeParseQueryKey} from './apiQueryKey';

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
  describe('parseQueryKey', () => {
    it('returns the request params of an api key', () => {
      expect(
        parseQueryKey(issuesOptions('acme', {query: 'is:unresolved'}).queryKey)
      ).toEqual({
        url: '/organizations/acme/issues/',
        urlParts: ['organizations', '$organizationIdOrSlug', 'issues'],
        options: {path: {organizationIdOrSlug: 'acme'}, query: {query: 'is:unresolved'}},
      });
      expect(parseQueryKey(issuesInfiniteOptions('acme').queryKey).infinite).toBe(true);
    });
  });

  describe('safeParseQueryKey', () => {
    it('returns the request params of an api key, also with trailing elements', () => {
      const {queryKey} = issuesOptions('acme');

      expect(safeParseQueryKey(queryKey)).toBe(parseQueryKey(queryKey));
      expect(safeParseQueryKey([...queryKey, {sessionKey: 'session'}])?.url).toBe(
        '/organizations/acme/issues/'
      );
      expect(safeParseQueryKey(issuesInfiniteOptions('acme').queryKey)?.infinite).toBe(
        true
      );
    });

    it('returns undefined for keys that are not api keys', () => {
      expect(safeParseQueryKey([])).toBeUndefined();
      expect(safeParseQueryKey(['bootstrap-projects'])).toBeUndefined();
      expect(
        safeParseQueryKey(['/organizations/acme/issues/', {}, {infinite: false}])
      ).toBeUndefined();
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

  describe('apiOptions.queryKey', () => {
    it('matches exactly one url without a glob, with any other options', () => {
      const {matching} = seedCache();
      const queryKey = apiOptions.queryKey(
        '/organizations/$organizationIdOrSlug/issues/',
        {path: {organizationIdOrSlug: 'acme'}}
      );

      expect(queryKey).toEqual(['_api', {url: '/organizations/acme/issues/'}]);
      expect(matching(queryKey)).toEqual([
        'acmeIssues',
        'acmeIssuesFiltered',
        'acmeIssuesInfinite',
      ]);
    });

    it('matches the url and everything below it with a glob', () => {
      const {matching} = seedCache();

      expect(
        matching(
          apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/*', {
            path: {organizationIdOrSlug: 'acme'},
          })
        )
      ).toEqual(['acmeIssue', 'acmeIssues', 'acmeIssuesFiltered', 'acmeIssuesInfinite']);
    });

    it('leaves path params open that a glob does not pass', () => {
      const {matching} = seedCache();

      expect(
        matching(
          apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/$issueId/*', {
            path: {organizationIdOrSlug: 'acme'},
          })
        )
      ).toEqual(['acmeIssue']);
      expect(
        matching(
          apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/*', {
            path: {},
          })
        )
      ).toEqual([
        'acmeIssue',
        'acmeIssues',
        'acmeIssuesFiltered',
        'acmeIssuesInfinite',
        'otherIssues',
      ]);
    });

    it('narrows by infinite and by other options', () => {
      const {matching} = seedCache();
      const path = {organizationIdOrSlug: 'acme'};

      expect(
        matching(
          apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/', {
            path,
            infinite: true,
          })
        )
      ).toEqual(['acmeIssuesInfinite']);
      expect(
        matching(
          apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/', {
            path,
            query: {query: 'is:unresolved'},
          })
        )
      ).toEqual(['acmeIssuesFiltered']);
    });

    describe('with a prefix that has params after the given ones', () => {
      const autofixSetupKey: readonly unknown[] = apiOptions.as<unknown>()(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
        {path: {organizationIdOrSlug: 'acme', issueId: '123'}, staleTime: 0}
      ).queryKey;

      it('builds a key from url parts and the given params only', () => {
        expect(
          apiOptions.queryKey(
            '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
            {path: {organizationIdOrSlug: 'acme'}}
          )
        ).toEqual([
          '_api',
          {
            urlParts: [
              'organizations',
              '$organizationIdOrSlug',
              'issues',
              '$issueId',
              'autofix',
              'setup',
            ],
            options: {path: {organizationIdOrSlug: 'acme'}},
          },
        ]);
      });

      it('builds a key from the full url without a glob', () => {
        expect(
          apiOptions.queryKey(
            '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
            {path: {organizationIdOrSlug: 'acme', issueId: '123'}}
          )
        ).toEqual(['_api', {url: '/organizations/acme/issues/123/autofix/setup/'}]);
      });

      it('matches the same cache entry with both keys', () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(autofixSetupKey, {});
        const matches = (queryKey: readonly unknown[]) =>
          queryClient.getQueryCache().findAll({queryKey}).length;

        expect(autofixSetupKey).toEqual([
          '_api',
          {
            url: '/organizations/acme/issues/123/autofix/setup/',
            urlParts: [
              'organizations',
              '$organizationIdOrSlug',
              'issues',
              '$issueId',
              'autofix',
              'setup',
            ],
            options: {path: {organizationIdOrSlug: 'acme', issueId: '123'}},
          },
        ]);
        expect(
          matches(
            apiOptions.queryKey(
              '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
              {path: {organizationIdOrSlug: 'acme'}}
            )
          )
        ).toBe(1);
        expect(
          matches(
            apiOptions.queryKey(
              '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
              {path: {organizationIdOrSlug: 'acme', issueId: '123'}}
            )
          )
        ).toBe(1);
        expect(
          matches(
            apiOptions.queryKey(
              '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
              {path: {organizationIdOrSlug: 'other'}}
            )
          )
        ).toBe(0);
      });
    });
  });

  describe('apiOptions.queryKey types', () => {
    it('needs every path param for an exact url', () => {
      expect(() =>
        apiOptions.queryKey(
          '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
          // @ts-expect-error `issueId` is missing
          {path: {organizationIdOrSlug: 'acme'}}
        )
      ).toThrow('Missing path param: issueId');
      // @ts-expect-error an exact url needs a path object
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/');
    });

    it('leaves every path param optional for a prefix', () => {
      apiOptions.queryKey(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
        {path: {organizationIdOrSlug: 'acme'}}
      );
      apiOptions.queryKey(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
        {path: {issueId: '123'}}
      );
      apiOptions.queryKey(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
        {path: {}}
      );
      // @ts-expect-error a prefix still needs a path object, use `path: {}` for any value
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/*');
    });

    it('only accepts the path params of the url, as strings', () => {
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/*', {
        // @ts-expect-error `issueId` is not a param of this prefix
        path: {organizationIdOrSlug: 'acme', issueId: '123'},
      });
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/issues/$issueId/', {
        // @ts-expect-error path params must be strings
        path: {organizationIdOrSlug: 'acme', issueId: 123},
      });
      // @ts-expect-error a url without params takes no path
      apiOptions.queryKey('/users/', {path: {}});
      apiOptions.queryKey('/users/');
      apiOptions.queryKey('/users/*');
    });

    it('only accepts known urls and prefixes that end in a full segment', () => {
      // @ts-expect-error unknown url
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/isues/', {
        path: {organizationIdOrSlug: 'acme'},
      });
      // @ts-expect-error unknown prefix
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/isues/*', {path: {}});
      // @ts-expect-error a glob has to follow a slash
      apiOptions.queryKey('/organizations/$organizationIdOrSlug/iss*', {path: {}});
      // @ts-expect-error a glob has to be at the end
      apiOptions.queryKey('/organizations/*/issues/', {path: {}});
    });
  });
});
