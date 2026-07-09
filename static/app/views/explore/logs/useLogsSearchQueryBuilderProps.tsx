import {useCallback, useMemo} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {usePrevious} from 'sentry/utils/usePrevious';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {HiddenLogSearchFields} from 'sentry/views/explore/logs/constants';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {findSuggestedColumns} from 'sentry/views/explore/utils';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

export function useLogsSearchQueryBuilderProps({
  attributeQuery,
  booleanAttributes,
  booleanSecondaryAliases,
  numberAttributes,
  stringAttributes,
  numberSecondaryAliases,
  stringSecondaryAliases,
  validatedSearchQueryData,
}: {
  booleanAttributes: TagCollection;
  booleanSecondaryAliases: TagCollection;
  numberAttributes: TagCollection;
  numberSecondaryAliases: TagCollection;
  stringAttributes: TagCollection;
  stringSecondaryAliases: TagCollection;
  attributeQuery?: string;
  validatedSearchQueryData?: EventValidationData;
}) {
  const logsSearch = useQueryParamsSearch();
  const oldLogsSearch = usePrevious(logsSearch);
  const fields = useQueryParamsFields();
  const setQueryParams = useSetQueryParams();
  const [caseInsensitive, setCaseInsensitive] = useCaseInsensitivity();

  const {
    validatedBooleanAttributes,
    validatedNumberAttributes,
    validatedStringAttributes,
    invalidFilterKeys,
  } = useMemo(() => {
    const localInvalidFilterKeys: string[] = [];
    const localBooleanAttributes = {...booleanAttributes};
    const localNumberAttributes = {...numberAttributes};
    const localStringAttributes = {...stringAttributes};

    if (validatedSearchQueryData?.query.fields.length) {
      for (const item of validatedSearchQueryData.query.fields) {
        if (item.valid) {
          if (item.attrType === 'boolean' && item.name) {
            localBooleanAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.BOOLEAN,
            };
          }

          if (item.attrType === 'number' && item.name) {
            localNumberAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.MEASUREMENT,
            };
          }

          if (item.attrType === 'string' && item.name) {
            localStringAttributes[item.name] ??= {
              key: item.name,
              name: prettifyAttributeName(item.name),
              kind: FieldKind.TAG,
            };
          }

          continue;
        }

        if (item.name) {
          localInvalidFilterKeys.push(item.name);
        }
      }
    }

    return {
      validatedBooleanAttributes: localBooleanAttributes,
      validatedNumberAttributes: localNumberAttributes,
      validatedStringAttributes: localStringAttributes,
      invalidFilterKeys: localInvalidFilterKeys,
    };
  }, [
    booleanAttributes,
    numberAttributes,
    stringAttributes,
    validatedSearchQueryData?.query.fields,
  ]);

  const onSearch = useCallback(
    (newQuery: string) => {
      const newSearch = new MutableSearch(newQuery);
      const suggestedColumns = findSuggestedColumns(newSearch, oldLogsSearch, {
        numberAttributes: validatedNumberAttributes,
        stringAttributes: validatedStringAttributes,
        booleanAttributes: validatedBooleanAttributes,
      });

      const existingFields = new Set(fields);
      const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

      setQueryParams({
        query: newSearch.formatString(),
        fields: newColumns.length ? [...fields, ...newColumns] : undefined,
      });
    },
    [
      fields,
      oldLogsSearch,
      setQueryParams,
      validatedBooleanAttributes,
      validatedNumberAttributes,
      validatedStringAttributes,
    ]
  );

  const initialQuery = logsSearch.formatString();
  const tracesItemSearchQueryBuilderProps = useMemo<TraceItemSearchQueryBuilderProps>(
    () => ({
      initialQuery,
      searchSource: 'ourlogs',
      onSearch,
      booleanAttributes: validatedBooleanAttributes,
      numberAttributes: validatedNumberAttributes,
      stringAttributes: validatedStringAttributes,
      itemType: TraceItemDataset.LOGS as TraceItemDataset.LOGS,
      booleanSecondaryAliases,
      numberSecondaryAliases,
      stringSecondaryAliases,
      caseInsensitive,
      onCaseInsensitiveClick: setCaseInsensitive,
      defaultToAskSeerOnFreeTextSearch: true,
      replaceRawSearchKeys: ['message'],
      matchKeySuggestions: [{key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/}],
      hiddenAttributeKeys: HiddenLogSearchFields,
      attributeQuery,
      invalidFilterKeys,
    }),
    [
      attributeQuery,
      booleanSecondaryAliases,
      caseInsensitive,
      initialQuery,
      numberSecondaryAliases,
      onSearch,
      setCaseInsensitive,
      stringSecondaryAliases,
      invalidFilterKeys,
      validatedBooleanAttributes,
      validatedNumberAttributes,
      validatedStringAttributes,
    ]
  );

  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return {
    tracesItemSearchQueryBuilderProps,
    searchQueryBuilderProviderProps,
  };
}
