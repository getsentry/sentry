import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {
  useSpanSearchQueryBuilderProps,
  type UseSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import useOrganization from 'sentry/utils/useOrganization';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export function useMcpSpanSearchProps() {
  const organization = useOrganization();
  const {unsetCursor} = useTableCursor();
  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );

  const searchQueryBuilderProps: UseSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
        unsetCursor();
      },
      searchSource: 'mcp-monitoring',

      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
    }),
    [hasRawSearchReplacement, searchQuery, setSearchQuery, unsetCursor]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  return {
    queryBuilder: spanSearchQueryBuilderProps,
    provider: spanSearchQueryBuilderProviderProps,
  };
}
