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
import type {TagCollection} from 'sentry/types/group';
import {getFieldDefinition} from 'sentry/utils/fields';

export function parseFilterValue(filterValue: string, filterKeys: TagCollection) {
  const parsedResult = parseQueryBuilderValue(filterValue, getFieldDefinition, {
    filterKeys,
  });
  const filterTokens = parsedResult?.filter(token => token.type === Token.FILTER);
  return filterTokens?.[0] as TokenResult<Token.FILTER>;
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
  const filterTokenWithNewValue = parseFilterValue(filterWithNewValue, filterKeys);

  // Update the operator of the filter
  const newFilterQuery = modifyFilterOperatorQuery(
    filterWithNewValue,
    filterTokenWithNewValue,
    newOperator,
    false
  );
  return newFilterQuery;
}
