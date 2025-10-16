import {useCallback} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
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

export function useLogsSearchQueryBuilderProps({
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
  const logsSearch = useQueryParamsSearch();
  const oldLogsSearch = usePrevious(logsSearch);
  const fields = useQueryParamsFields();
  const setQueryParams = useSetQueryParams();
  const [caseInsensitive, setCaseInsensitive] = useCaseInsensitivity();
  const onSearch = useCallback(
    (newQuery: string) => {
      const newSearch = new MutableSearch(newQuery);
      const suggestedColumns = findSuggestedColumns(newSearch, oldLogsSearch, {
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
    [oldLogsSearch, numberAttributes, stringAttributes, fields, setQueryParams]
  );

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch,
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS as TraceItemDataset.LOGS,
    numberSecondaryAliases,
    stringSecondaryAliases,
    caseInsensitive,
    onCaseInsensitiveClick: setCaseInsensitive,
  };

  const searchQueryBuilderProviderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return {
    tracesItemSearchQueryBuilderProps,
    searchQueryBuilderProviderProps,
  };
}
