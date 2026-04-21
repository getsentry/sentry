import {
  modifyFilterOperatorQuery,
  modifyFilterValue,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {getFilterValueType} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {cleanFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/utils';
import {getInitialFilterText} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import type {Tag} from 'sentry/types/group';
import {getFieldDefinition, type FieldDefinition} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';

export function globalFilterKeysAreEqual(a: GlobalFilter, b: GlobalFilter): boolean {
  return a.tag.key === b.tag.key && a.dataset === b.dataset;
}

/**
 * Merges two lists of global filters. Walks `baseFilters` in order and
 * replaces each entry with its match from `overrideFilters` (by tag key +
 * dataset) when one exists. Override filters that don't match any base
 * entry are appended at the end.
 */
export function mergeGlobalFilters(
  baseFilters: GlobalFilter[],
  overrideFilters: GlobalFilter[]
): GlobalFilter[] {
  const overridesByKey = new Map(
    overrideFilters.map(f => [`${f.tag.key}:${f.dataset}`, f])
  );
  const usedKeys = new Set<string>();

  const merged = baseFilters.map(f => {
    const key = `${f.tag.key}:${f.dataset}`;
    const override = overridesByKey.get(key);
    if (override) {
      usedKeys.add(key);
      return override;
    }
    return f;
  });

  for (const f of overrideFilters) {
    if (!usedKeys.has(`${f.tag.key}:${f.dataset}`)) {
      merged.push(f);
    }
  }

  return merged;
}

export function getFieldDefinitionForDataset(
  tag: Tag,
  datasetType: WidgetType
): FieldDefinition | null {
  const fieldType = () => {
    switch (datasetType) {
      case WidgetType.SPANS:
        return 'span';
      case WidgetType.LOGS:
        return 'log';
      case WidgetType.TRACEMETRICS:
        return 'tracemetric';
      default:
        return 'event';
    }
  };
  return getFieldDefinition(tag.key, fieldType(), tag.kind);
}

export function parseFilterValue(
  filterValue: string,
  globalFilter: GlobalFilter
): Array<TokenResult<Token.FILTER>> {
  const parsedResult = parseQueryBuilderValue(
    filterValue,
    () => getFieldDefinitionForDataset(globalFilter.tag, globalFilter.dataset),
    {
      filterKeys: {
        [globalFilter.tag.key]: globalFilter.tag,
      },
    }
  );
  if (!parsedResult) {
    return [];
  }
  return parsedResult.filter(token => token.type === Token.FILTER);
}

export function getFilterToken(
  globalFilter: GlobalFilter,
  fieldDefinition: FieldDefinition | null
) {
  const {tag, value} = globalFilter;
  let filterValue = value;
  if (value === '') {
    filterValue = getInitialFilterText(tag.key, fieldDefinition);
  }
  const filterTokens = parseFilterValue(filterValue, globalFilter);
  return filterTokens[0] ?? null;
}

export function isValidNumericFilterValue(
  value: string,
  filterToken: TokenResult<Token.FILTER>,
  globalFilter: GlobalFilter
) {
  const fieldDefinition = getFieldDefinitionForDataset(
    globalFilter.tag,
    globalFilter.dataset
  );
  const valueType = getFilterValueType(filterToken, fieldDefinition);
  return (
    cleanFilterValue({
      value,
      valueType,
      token: filterToken,
    }) !== null
  );
}

export function newNumericFilterQuery(
  newValue: string,
  newOperator: TermOperator,
  filterToken: TokenResult<Token.FILTER>,
  globalFilter: GlobalFilter
) {
  // Update the value of the filter
  const fieldDefinition = getFieldDefinitionForDataset(
    globalFilter.tag,
    globalFilter.dataset
  );
  const valueType = getFilterValueType(filterToken, fieldDefinition);
  const cleanedValue = cleanFilterValue({
    value: newValue,
    valueType,
    token: filterToken,
  });
  if (!cleanedValue) return '';
  const newFilterValue = modifyFilterValue(filterToken.text, filterToken, cleanedValue);

  const newFilterTokens = parseFilterValue(newFilterValue, globalFilter);
  const newFilterToken = newFilterTokens?.[0];
  if (!newFilterToken) {
    return '';
  }

  // Update the operator of the filter
  const newFilterQuery = modifyFilterOperatorQuery(
    newFilterValue,
    newFilterToken,
    newOperator
  );
  return newFilterQuery;
}
