import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {useEAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import useOrganization from 'sentry/utils/useOrganization';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export function useMcpSpanSearchProps() {
  const organization = useOrganization();
  const {unsetCursor} = useTableCursor();
  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );

  const {tags: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemTags('string');

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
        unsetCursor();
      },
      searchSource: 'mcp-monitoring',
      numberAttributes,
      stringAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
    }),
    [
      hasRawSearchReplacement,
      numberAttributes,
      numberSecondaryAliases,
      searchQuery,
      setSearchQuery,
      stringAttributes,
      stringSecondaryAliases,
      unsetCursor,
    ]
  );

  const {searchQueryBuilderProviderProps, traceItemSearchQueryBuilderProps} =
    useEAPSpanSearchQueryBuilderProps(eapSpanSearchQueryBuilderProps);

  return {
    queryBuilder: traceItemSearchQueryBuilderProps,
    provider: searchQueryBuilderProviderProps,
  };
}
