import {
  modifyFilterOperatorQuery,
  modifyFilterValue,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {getFilterValueType} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {cleanFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/utils';
import {getInitialFilterText} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {type FieldDefinition} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';

export function globalFilterKeysAreEqual(a: GlobalFilter, b: GlobalFilter): boolean {
  return a.tag.key === b.tag.key && a.dataset === b.dataset;
}

export const getFieldType = (datasetType: WidgetType) => {
  switch (datasetType) {
    case WidgetType.SPANS:
      return 'span';
    case WidgetType.LOGS:
      return 'log';
    default:
      return 'event';
  }
};

export function parseFilterValue(
  filterValue: string,
  globalFilter: GlobalFilter,
  getFieldDefinition: FieldDefinitionGetter
): Array<TokenResult<Token.FILTER>> {
  const parsedResult = parseQueryBuilderValue(
    filterValue,
    () =>
      getFieldDefinition(
        globalFilter.tag.key,
        getFieldType(globalFilter.dataset),
        globalFilter.tag.kind
      ),
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
  fieldDefinition: FieldDefinition | null,
  getFieldDefinition: FieldDefinitionGetter
) {
  const {tag, value} = globalFilter;
  let filterValue = value;
  if (value === '') {
    filterValue = getInitialFilterText(tag.key, fieldDefinition);
  }
  const filterTokens = parseFilterValue(filterValue, globalFilter, getFieldDefinition);
  return filterTokens[0] ?? null;
}

export function isValidNumericFilterValue(
  value: string,
  filterToken: TokenResult<Token.FILTER>,
  globalFilter: GlobalFilter,
  getFieldDefinition: FieldDefinitionGetter
) {
  const fieldDefinition = getFieldDefinition(
    globalFilter.tag.key,
    getFieldType(globalFilter.dataset),
    globalFilter.tag.kind
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
  globalFilter: GlobalFilter,
  getFieldDefinition: FieldDefinitionGetter
) {
  // Update the value of the filter
  const fieldDefinition = getFieldDefinition(
    globalFilter.tag.key,
    getFieldType(globalFilter.dataset),
    globalFilter.tag.kind
  );
  const valueType = getFilterValueType(filterToken, fieldDefinition);
  const cleanedValue = cleanFilterValue({
    value: newValue,
    valueType,
    token: filterToken,
  });
  if (!cleanedValue) return '';
  const newFilterValue = modifyFilterValue(filterToken.text, filterToken, cleanedValue);

  const newFilterTokens = parseFilterValue(
    newFilterValue,
    globalFilter,
    getFieldDefinition
  );
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
