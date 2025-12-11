import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {
  useEAPSpanSearchQueryBuilderProps,
  type UseEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import useOrganization from 'sentry/utils/useOrganization';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export function useAgentSpanSearchProps() {
  const organization = useOrganization();
  const {unsetCursor} = useTableCursor();
  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );

  const searchQueryBuilderProps: UseEAPSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
        unsetCursor();
      },
      searchSource: 'agent-monitoring',

      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
    }),
    [hasRawSearchReplacement, searchQuery, setSearchQuery, unsetCursor]
  );

  const {searchQueryBuilderProviderProps, eapSpanSearchQueryBuilderProps} =
    useEAPSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  return {
    queryBuilder: eapSpanSearchQueryBuilderProps,
    provider: searchQueryBuilderProviderProps,
  };
}
