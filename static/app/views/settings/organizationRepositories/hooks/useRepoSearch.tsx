import {useMemo} from 'react';

import type {Repository} from 'sentry/types/integrations';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';
import type {ScmRepoMatches} from 'sentry/views/settings/organizationRepositories/types';

// Allows about one typo per five characters, matched anywhere in the name.
// Looser thresholds match most repos in orgs that share an owner prefix.
const FUSE_OPTIONS = {
  keys: ['name'],
  minMatchCharLength: 1,
  threshold: 0.1,
  ignoreLocation: true,
};

/**
 * Builds a fuzzy search index over the given repositories and returns a
 * mapping of `repository.id` to Fuse match results for the active query.
 *
 * Returns `undefined` when the query is empty, which signals to consumers
 * (e.g. `ScmRepositoryTable`) that no filtering should be applied.
 */
export function useRepoSearch(
  repositories: Repository[],
  query: string
): ScmRepoMatches | undefined {
  const fuse = useFuzzySearch(repositories, FUSE_OPTIONS);

  return useMemo(() => {
    if (!query || !fuse) {
      return;
    }

    const matches: ScmRepoMatches = {};
    for (const result of fuse.search(query)) {
      if (result.matches) {
        matches[result.item.id] = result.matches;
      }
    }
    return matches;
  }, [fuse, query]);
}
