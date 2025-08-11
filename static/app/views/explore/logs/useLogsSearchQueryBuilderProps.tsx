import {useCallback} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePrevious from 'sentry/utils/usePrevious';
import {
  type TraceItemSearchQueryBuilderProps,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  useLogsFields,
  useLogsSearch,
  useSetLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
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
  const logsSearch = useLogsSearch();
  const oldLogsSearch = usePrevious(logsSearch);
  const fields = useLogsFields();
  const setLogsPageParams = useSetLogsPageParams();
  const onSearch = useCallback(
    (newQuery: string) => {
      const newSearch = new MutableSearch(newQuery);
      const suggestedColumns = findSuggestedColumns(newSearch, oldLogsSearch, {
        numberAttributes,
        stringAttributes,
      });

      const existingFields = new Set(fields);
      const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

      setLogsPageParams({
        search: newSearch,
        fields: newColumns.length ? [...fields, ...newColumns] : undefined,
      });
    },
    [oldLogsSearch, numberAttributes, stringAttributes, fields, setLogsPageParams]
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
  };

  const searchQueryBuilderProviderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return {
    tracesItemSearchQueryBuilderProps,
    searchQueryBuilderProviderProps,
  };
}
