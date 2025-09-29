import {useCallback} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePrevious from 'sentry/utils/usePrevious';
import {
  useSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {findSuggestedColumns} from 'sentry/views/explore/utils';

export function useMetricsSearchQueryBuilderProps({
  numberAttributes,
  stringAttributes,
  numberSecondaryAliases,
  stringSecondaryAliases,
}: {
  numberAttributes: TagCollection;
  numberSecondaryAliases: TagCollection;
  stringAttributes: TagCollection;
  stringSecondaryAliases: TagCollection;
}) {
  const metricsSearch = useQueryParamsSearch();
  const oldMetricsSearch = usePrevious(metricsSearch);
  const fields = useQueryParamsFields();
  const setQueryParams = useSetQueryParams();

  const onSearch = useCallback(
    (newQuery: string) => {
      const newSearch = new MutableSearch(newQuery);
      const suggestedColumns = findSuggestedColumns(newSearch, oldMetricsSearch, {
        numberAttributes,
        stringAttributes,
      });

      const existingFields = new Set(fields);
      const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

      setQueryParams({
        query: newSearch.formatString(),
        fields: newColumns.length ? [...fields, ...newColumns] : undefined,
      });
    },
    [oldMetricsSearch, numberAttributes, stringAttributes, fields, setQueryParams]
  );

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps = {
    itemType: TraceItemDataset.TRACEMETRICS,
    numberAttributes,
    stringAttributes,
    numberSecondaryAliases,
    stringSecondaryAliases,
    onSearch,
  };

  const searchQueryBuilderProviderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return {
    tracesItemSearchQueryBuilderProps,
    searchQueryBuilderProviderProps,
  };
}
