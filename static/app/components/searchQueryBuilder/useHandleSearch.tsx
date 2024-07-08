import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {saveRecentSearch} from 'sentry/actionCreators/savedSearches';
import type {Client} from 'sentry/api';
import {tokenIsInvalid} from 'sentry/components/searchQueryBuilder/utils';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type UseHandleSearchProps = {
  parsedQuery: ParseResult | null;
  savedSearchType: any;
  searchSource: string;
  onSearch?: (query: string) => void;
};

async function saveAsRecentSearch({
  savedSearchType,
  query,
  api,
  organization,
}: {
  api: Client;
  organization: Organization;
  query: string;
  savedSearchType: any;
}) {
  // Only save recent search query if we have a savedSearchType (also 0 is a valid value)
  // Do not save empty string queries (i.e. if they clear search)
  if (typeof savedSearchType === 'undefined' || !query) {
    return;
  }

  try {
    await saveRecentSearch(api, organization.slug, savedSearchType, query);
  } catch (err) {
    // Silently capture errors if it fails to save
    Sentry.captureException(err);
  }
}

export function useHandleSearch({
  parsedQuery,
  savedSearchType,
  searchSource,
  onSearch,
}: UseHandleSearchProps) {
  const api = useApi();
  const organization = useOrganization();

  return useCallback(
    (query: string) => {
      onSearch?.(query);

      const searchType = savedSearchType === 0 ? 'issues' : 'events';

      if (parsedQuery?.some(token => tokenIsInvalid(token))) {
        trackAnalytics('search.search_with_invalid', {
          organization,
          query,
          search_type: searchType,
          search_source: searchSource,
          new_experience: true,
        });
        return;
      }

      trackAnalytics('search.searched', {
        organization,
        query,
        search_type: searchType,
        search_source: searchSource,
        new_experience: true,
      });

      saveAsRecentSearch({api, organization, query, savedSearchType});
    },
    [api, onSearch, organization, parsedQuery, savedSearchType, searchSource]
  );
}
