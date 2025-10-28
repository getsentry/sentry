import {
  modifyFilterOperatorQuery,
  modifyFilterValue,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {getFilterValueType} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {cleanFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/utils';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import type {Tag, TagCollection} from 'sentry/types/group';
import {getFieldDefinition, type FieldDefinition} from 'sentry/utils/fields';
import {WidgetType} from 'sentry/views/dashboards/types';

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
      default:
        return 'event';
    }
  };
  return getFieldDefinition(tag.key, fieldType(), tag.kind);
}

export function parseFilterValue(
  filterValue: string,
  filterKeys: TagCollection
): Array<TokenResult<Token.FILTER>> {
  const parsedResult = parseQueryBuilderValue(filterValue, getFieldDefinition, {
    filterKeys,
  });
  if (!parsedResult) {
    return [];
  }
  return parsedResult.filter(token => token.type === Token.FILTER);
}

export function isValidNumericFilterValue(
  value: string,
  filterToken: TokenResult<Token.FILTER>
) {
  const fieldDefinition = getFieldDefinition(filterToken.key.text);
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
  filterKeys: TagCollection
) {
  // Update the value of the filter
  const fieldDefinition = getFieldDefinition(filterToken.key.text);
  const valueType = getFilterValueType(filterToken, fieldDefinition);
  const cleanedValue = cleanFilterValue({
    value: newValue,
    valueType,
    token: filterToken,
  });
  if (!cleanedValue) return '';
  const filterWithNewValue = modifyFilterValue(
    filterToken.text,
    filterToken,
    cleanedValue
  );

  const newFilterTokens = parseFilterValue(filterWithNewValue, filterKeys);
  const filterTokenWithNewValue = newFilterTokens?.[0];
  if (!filterTokenWithNewValue) {
    return '';
  }

  // Update the operator of the filter
  const newFilterQuery = modifyFilterOperatorQuery(
    filterWithNewValue,
    filterTokenWithNewValue,
    newOperator,
    false
  );
  return newFilterQuery;
}
