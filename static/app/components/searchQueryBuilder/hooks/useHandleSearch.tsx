import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {saveRecentSearch} from 'sentry/actionCreators/savedSearches';
import type {Client} from 'sentry/api';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import {
  queryIsValid,
  recentSearchTypeToLabel,
  tokenIsInvalid,
} from 'sentry/components/searchQueryBuilder/utils';
import {Token, type ParseResult} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type UseHandleSearchProps = {
  parsedQuery: ParseResult | null;
  recentSearches: SavedSearchType | undefined;
  searchSource: string;
  namespace?: string;
  onSearch?: (query: string, state: CallbackSearchState) => void;
};

async function saveAsRecentSearch({
  recentSearches,
  query,
  api,
  organization,
  namespace,
}: {
  api: Client;
  organization: Organization;
  query: string;
  recentSearches: SavedSearchType | undefined;
  namespace?: string;
}) {
  // Only save recent search query if there is a type provided.
  // Do not save empty string queries (i.e. if they clear search)
  if (typeof recentSearches === 'undefined' || !query) {
    return;
  }

  try {
    await saveRecentSearch(api, organization.slug, recentSearches, query, namespace);
  } catch (err) {
    // Silently capture errors if it fails to save
    Sentry.captureException(err);
  }
}

function trackIndividualSearchFilters({
  parsedQuery,
  searchType,
  searchSource,
  query,
  organization,
}: {
  organization: Organization;
  parsedQuery: ParseResult | null;
  query: string;
  searchSource: string;
  searchType: string;
}) {
  try {
    parsedQuery?.forEach(token => {
      if (token.type !== 'filter') {
        return;
      }

      const values =
        token.value.type === Token.VALUE_TEXT_LIST ||
        token.value.type === Token.VALUE_NUMBER_LIST
          ? token.value.items.map(item => item.value!.text)
          : [token.value.text];

      trackAnalytics('search.searched_filter', {
        organization,
        query,
        key: getKeyName(token.key),
        values,
        search_type: searchType,
        search_source: searchSource,
        new_experience: true,
      });
    });
  } catch (e) {
    Sentry.captureException(e);
  }
}

export function useHandleSearch({
  parsedQuery,
  recentSearches,
  searchSource,
  onSearch,
  namespace,
}: UseHandleSearchProps) {
  const api = useApi();
  const organization = useOrganization();
  const debouncedSaveAsRecentSearch = useMemo(
    () => debounce(saveAsRecentSearch, 3000),
    []
  );

  return useCallback(
    (query: string) => {
      onSearch?.(query, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)});

      const searchType = recentSearchTypeToLabel(recentSearches);

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
      });

      trackIndividualSearchFilters({
        parsedQuery,
        searchType,
        searchSource,
        query,
        organization,
      });

      debouncedSaveAsRecentSearch({
        api,
        organization,
        query,
        recentSearches,
        namespace,
      });
    },
    [
      api,
      debouncedSaveAsRecentSearch,
      onSearch,
      organization,
      parsedQuery,
      recentSearches,
      namespace,
      searchSource,
    ]
  );
}
