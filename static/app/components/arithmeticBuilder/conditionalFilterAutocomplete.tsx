import {useMemo} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQuery} from '@tanstack/react-query';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import {
  formatConditionalFilterClause,
  getConditionalFilterEditContext,
} from 'sentry/components/arithmeticBuilder/conditionalFilter';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {FieldKind} from 'sentry/utils/fields';

function useFilterKeyItems(
  attributes: FunctionArgument[]
): Array<SelectOptionWithKey<string>> {
  return useMemo(() => {
    return attributes.map(item => {
      const key = item.name;
      const filterKey = `${key}:`;
      return {
        key,
        label: filterKey,
        value: filterKey,
        textValue: key,
        hideCheck: true,
      };
    });
  }, [attributes]);
}

function useFilterValueItems({
  enabled,
  filterKey,
  valueQuery,
  getFilterTagValues,
  tagKind,
}: {
  enabled: boolean;
  filterKey: string;
  valueQuery: string;
  getFilterTagValues?: GetTagValues;
  tagKind?: FieldKind;
}): Array<SelectOptionWithKey<string>> {
  const tag = useMemo(
    () => ({
      key: filterKey,
      name: filterKey,
      kind: tagKind,
    }),
    [filterKey, tagKind]
  );

  const queryKey = useMemo(
    () => ['arithmetic-filter-tag-values', tag, valueQuery] as const,
    [tag, valueQuery]
  );
  const [debouncedQueryKey] = useDebouncedValue(queryKey, {
    wait: DEFAULT_DEBOUNCE_DURATION,
  });
  const debouncedFilterKey = debouncedQueryKey[1].key;

  const {data} = useQuery({
    queryKey: debouncedQueryKey,
    queryFn: ctx =>
      getFilterTagValues!({
        tag: ctx.queryKey[1],
        searchQuery: ctx.queryKey[2] ?? '',
      }),
    // Gate on the *debounced* key. `enabled` flips true as soon as the user types `:`,
    // but the query key still holds the previous empty key for one debounce window —
    // fetching then hits `/attributes//values/` and 404-retries.
    //
    // Do not use keepPreviousData: after switching keys in a compound filter, placeholder
    // results from the prior key would be rewritten with the new key's clause.
    enabled: enabled && Boolean(getFilterTagValues && debouncedFilterKey),
    staleTime: 30_000,
    retry: false,
  });

  return useMemo(() => {
    // Hide results until debounce catches up to the key the cursor is editing.
    if (!data?.length || debouncedFilterKey !== filterKey) {
      return [];
    }

    return data.map(item => {
      const tagValue = typeof item === 'string' ? item : item.value;
      return {
        key: `filter-value:${filterKey}:${tagValue}`,
        label: tagValue,
        value: formatConditionalFilterClause(filterKey, tagValue),
        textValue: tagValue,
        hideCheck: true,
      };
    });
  }, [data, debouncedFilterKey, filterKey]);
}

export function useConditionalFilterAutocomplete({
  enabled,
  filterValue,
  functionArguments,
  getFilterTagValues,
  selectionIndex,
}: {
  enabled: boolean;
  filterValue: string;
  functionArguments: FunctionArgument[];
  selectionIndex: number;
  getFilterTagValues?: GetTagValues;
}) {
  const editContext = useMemo(
    () => (enabled ? getConditionalFilterEditContext(filterValue, selectionIndex) : null),
    [enabled, filterValue, selectionIndex]
  );

  const editPhase = editContext?.phase ?? 'key';
  const parsedFilterInput = useMemo(() => {
    if (editContext?.phase !== 'value' || !editContext.filterKey) {
      return null;
    }
    return {
      filterKey: editContext.filterKey,
      valueQuery: editContext.valueQuery ?? '',
    };
  }, [editContext]);

  const filterKeyItems = useFilterKeyItems(functionArguments);
  const filterValueItems = useFilterValueItems({
    enabled: enabled && Boolean(parsedFilterInput && getFilterTagValues),
    filterKey: parsedFilterInput?.filterKey ?? '',
    valueQuery: parsedFilterInput?.valueQuery ?? '',
    getFilterTagValues,
    tagKind: functionArguments.find(
      argument => argument.name === parsedFilterInput?.filterKey
    )?.kind,
  });

  const comboBoxFilterValue = useMemo(() => {
    if (!editContext) {
      return '';
    }
    if (editContext.phase === 'value' && parsedFilterInput && getFilterTagValues) {
      return parsedFilterInput.valueQuery;
    }
    return editContext.phase === 'key' ? editContext.editText : '';
  }, [editContext, getFilterTagValues, parsedFilterInput]);

  const items = useMemo(() => {
    if (!enabled) {
      return [];
    }
    if (editPhase === 'value' && parsedFilterInput && getFilterTagValues) {
      return filterValueItems;
    }
    const keyQuery = (editContext?.editText ?? '').trim().toLowerCase();
    if (!keyQuery) {
      return filterKeyItems;
    }
    return filterKeyItems.filter(
      item =>
        item.value.toLowerCase().includes(keyQuery) ||
        (item.textValue?.toLowerCase().includes(keyQuery) ?? false)
    );
  }, [
    editContext?.editText,
    editPhase,
    enabled,
    filterKeyItems,
    filterValueItems,
    getFilterTagValues,
    parsedFilterInput,
  ]);

  return {
    comboBoxFilterValue,
    editPhase,
    items,
    parsedFilterInput,
  };
}
