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

  const {tags: numberTags, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringTags, secondaryAliases: stringSecondaryAliases} =
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
      numberTags,
      stringTags,
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
      numberSecondaryAliases,
      numberTags,
      searchQuery,
      setSearchQuery,
      stringSecondaryAliases,
      stringTags,
      unsetCursor,
    ]
  );

  return {
    queryBuilder: eapSpanSearchQueryBuilderProps,
    provider: useEAPSpanSearchQueryBuilderProps(eapSpanSearchQueryBuilderProps),
  };
}
