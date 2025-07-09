import {type Reducer, useCallback, useReducer} from 'react';

import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/date/parser';
import {
  convertTokenTypeToValueType,
  getArgsToken,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {getDefaultValueForValueType} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {
  type FieldDefinitionGetter,
  type FocusOverride,
  isWildcardOperator,
  type SearchQueryBuilderOperators,
  WildcardOperators,
} from 'sentry/components/searchQueryBuilder/types';
import {
  isDateToken,
  makeTokenKey,
  parseQueryBuilderValue,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  type AggregateFilter,
  FilterType,
  type ParseResultToken,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName, stringifyToken} from 'sentry/components/searchSyntax/utils';
import useOrganization from 'sentry/utils/useOrganization';

type QueryBuilderState = {
  /**
   * This may lag the `query` value in the cases where:
   * 1. The filter has been created, but no value has been entered yet.
   * 2. A free text value has been typed, but the user has not blurred the input or pressed enter.
   */
  committedQuery: string;
  /**
   * There are certain cases where we want to move the cursor to a different location after
   * a state change. useApplyFocusOverride reads this value and focuses the selected item.
   */
  focusOverride: FocusOverride | null;
  /**
   * The current query value.
   * This is the basic source of truth for what is currently being displayed.
   */
  query: string;
};

type ClearAction = {type: 'CLEAR'};

type CommitQueryAction = {
  type: 'COMMIT_QUERY';
};

type UpdateQueryAction = {
  query: string;
  type: 'UPDATE_QUERY';
  focusOverride?: FocusOverride | null;
  shouldCommitQuery?: boolean;
};

type ResetFocusOverrideAction = {type: 'RESET_FOCUS_OVERRIDE'};

type DeleteTokenAction = {
  token: ParseResultToken;
  type: 'DELETE_TOKEN';
};

type DeleteTokensAction = {
  tokens: ParseResultToken[];
  type: 'DELETE_TOKENS';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextAction = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT';
  focusOverride?: FocusOverride;
};

type ReplaceTokensWithTextAction = {
  text: string;
  tokens: ParseResultToken[];
  type: 'REPLACE_TOKENS_WITH_TEXT';
  focusOverride?: FocusOverride;
};

type UpdateFilterKeyAction = {
  key: string;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_FILTER_KEY';
};

type UpdateFilterOpAction = {
  op: SearchQueryBuilderOperators;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_FILTER_OP';
};

type UpdateTokenValueAction = {
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_TOKEN_VALUE';
  value: string;
};

type MultiSelectFilterValueAction = {
  token: TokenResult<Token.FILTER>;
  type: 'TOGGLE_FILTER_VALUE';
  value: string;
};

type UpdateAggregateArgsAction = {
  token: AggregateFilter;
  type: 'UPDATE_AGGREGATE_ARGS';
  value: string;
  focusOverride?: FocusOverride;
};

export type QueryBuilderActions =
  | ClearAction
  | CommitQueryAction
  | UpdateQueryAction
  | ResetFocusOverrideAction
  | DeleteTokenAction
  | DeleteTokensAction
  | UpdateFreeTextAction
  | ReplaceTokensWithTextAction
  | UpdateFilterKeyAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction
  | UpdateAggregateArgsAction
  | MultiSelectFilterValueAction;

function removeQueryTokensFromQuery(
  query: string,
  tokens: Array<TokenResult<Token>>
): string {
  if (!tokens.length) {
    return query;
  }

  return removeExcessWhitespaceFromParts(
    query.substring(0, tokens[0]!.location.start.offset),
    query.substring(tokens.at(-1)!.location.end.offset)
  );
}

function deleteQueryTokens(
  state: QueryBuilderState,
  action: DeleteTokensAction
): QueryBuilderState {
  if (!action.tokens.length) {
    return state;
  }

  return {
    ...state,
    query: removeQueryTokensFromQuery(state.query, action.tokens),
    focusOverride: action.focusOverride ?? null,
  };
}

export function addWildcardToToken(
  token: TokenResult<Token.VALUE_TEXT>,
  isContains: boolean,
  isStartsWith: boolean,
  isEndsWith: boolean
) {
  let newTokenValue = token.value;
  if ((isContains || isEndsWith) && !token.value.startsWith('*')) {
    newTokenValue = `*${newTokenValue}`;
  }

  if ((isContains || isStartsWith) && !token.value.endsWith('*')) {
    newTokenValue = `${newTokenValue}*`;
  }

  return newTokenValue;
}

export function removeWildcardFromToken(
  token: TokenResult<Token.VALUE_TEXT>,
  isContains: boolean,
  isStartsWith: boolean,
  isEndsWith: boolean
) {
  let newTokenValue = token.value;
  if (!isEndsWith && !isContains && token.value.startsWith('*')) {
    newTokenValue = newTokenValue.slice(1);
  }

  if (!isStartsWith && !isContains && token.value.endsWith('*')) {
    newTokenValue = newTokenValue.slice(0, -1);
  }

  return newTokenValue;
}

function modifyFilterOperatorQuery(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: SearchQueryBuilderOperators,
  hasWildcardOperators: boolean
): string {
  if (isDateToken(token)) {
    return modifyFilterOperatorDate(query, token, newOperator);
  }

  const isNotEqual =
    newOperator === TermOperator.NOT_EQUAL ||
    newOperator === WildcardOperators.DOES_NOT_CONTAIN;
  const newToken: TokenResult<Token.FILTER> = {...token};
  newToken.negated = isNotEqual;

  if (isWildcardOperator(newOperator)) {
    // whenever we have a wildcard operator, we want to set the operator to the default,
    // because there is no special characters for the wildcard operators just the asterisk
    newToken.operator = TermOperator.DEFAULT;
  } else {
    newToken.operator = isNotEqual ? TermOperator.DEFAULT : newOperator;
  }

  const isContains =
    newOperator === WildcardOperators.CONTAINS ||
    newOperator === WildcardOperators.DOES_NOT_CONTAIN;
  const isStartsWith = newOperator === WildcardOperators.STARTS_WITH;
  const isEndsWith = newOperator === WildcardOperators.ENDS_WITH;

  if (hasWildcardOperators && newToken.value.type === Token.VALUE_TEXT) {
    newToken.value.value = addWildcardToToken(
      newToken.value,
      isContains,
      isStartsWith,
      isEndsWith
    );
    newToken.value.value = removeWildcardFromToken(
      newToken.value,
      isContains,
      isStartsWith,
      isEndsWith
    );
  } else if (hasWildcardOperators && newToken.value.type === Token.VALUE_TEXT_LIST) {
    newToken.value.items.forEach(item => {
      if (!item.value) return;
      item.value.value = addWildcardToToken(
        item.value,
        isContains,
        isStartsWith,
        isEndsWith
      );
      item.value.value = removeWildcardFromToken(
        item.value,
        isContains,
        isStartsWith,
        isEndsWith
      );
    });
  }

  return replaceQueryToken(query, token, stringifyToken(newToken));
}

function modifyFilterOperator(
  state: QueryBuilderState,
  action: UpdateFilterOpAction,
  hasWildcardOperators: boolean
): QueryBuilderState {
  const newQuery = modifyFilterOperatorQuery(
    state.query,
    action.token,
    action.op,
    hasWildcardOperators
  );

  if (newQuery === state.query) {
    return state;
  }

  return {
    ...state,
    query: newQuery,
    committedQuery: newQuery,
  };
}

function modifyFilterOperatorDate(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: SearchQueryBuilderOperators
): string {
  switch (newOperator) {
    case TermOperator.GREATER_THAN:
    case TermOperator.LESS_THAN: {
      if (token.filter === FilterType.RELATIVE_DATE) {
        token.value.sign = newOperator === TermOperator.GREATER_THAN ? '-' : '+';
      } else if (
        token.filter === FilterType.SPECIFIC_DATE ||
        token.filter === FilterType.DATE
      ) {
        token.operator = newOperator;
      }
      return replaceQueryToken(query, token, stringifyToken(token));
    }

    // The "equal" and "or equal to" operators require a specific date
    case TermOperator.EQUAL:
    case TermOperator.GREATER_THAN_EQUAL:
    case TermOperator.LESS_THAN_EQUAL:
      // If it's a relative date, modify the operator and generate an ISO timestamp
      if (token.filter === FilterType.RELATIVE_DATE) {
        const generatedIsoDateStr = token.value.parsed?.value ?? new Date().toISOString();
        const newTokenStr = `${token.key.text}:${newOperator}${generatedIsoDateStr}`;
        return replaceQueryToken(query, token, newTokenStr);
      }
      token.operator = newOperator;
      return replaceQueryToken(query, token, stringifyToken(token));
    default:
      return replaceQueryToken(query, token, newOperator);
  }
}

function modifyFilterValueDate(
  query: string,
  token: TokenResult<Token.FILTER>,
  newValue: string
): string {
  const parsedValue = parseFilterValueDate(newValue);

  if (!parsedValue) {
    return query;
  }

  if (token.value.type === parsedValue?.type) {
    return replaceQueryToken(query, token.value, newValue);
  }

  if (parsedValue.type === Token.VALUE_ISO_8601_DATE) {
    if (token.value.type === Token.VALUE_RELATIVE_DATE) {
      if (token.value.sign === '-') {
        return replaceQueryToken(query, token.value, `>${newValue}`);
      }
      return replaceQueryToken(query, token.value, `<${newValue}`);
    }
    return replaceQueryToken(query, token.value, newValue);
  }

  return replaceQueryToken(query, token, `${token.key.text}:${newValue}`);
}

// Uses the token's location to replace a sequence of tokens with the new text value
function replaceQueryTokens(
  query: string,
  tokens: Array<TokenResult<Token>>,
  value: string
): string {
  if (tokens.length === 0) {
    return query;
  }

  const start = query.substring(0, tokens[0]!.location.start.offset);
  const end = query.substring(tokens.at(-1)!.location.end.offset);

  return start + value + end;
}

// Uses the token's location to replace the given with the new text value
function replaceQueryToken(
  query: string,
  token: TokenResult<Token>,
  value: string
): string {
  return replaceQueryTokens(query, [token], value);
}

// Takes a list of token replacements and applies them to the query
function multipleReplaceQueryToken(
  query: string,
  replacements: Array<{replacement: string; token: TokenResult<Token>}>
) {
  // Because replacements to earlier tokens can affect the offsets of later tokens,
  // we need to apply the replacements in order from rightmost to leftmost
  const sortedReplacements = replacements.sort(
    (a, b) => b.token.location.start.offset - a.token.location.start.offset
  );

  let newQuery = query;
  for (const {token, replacement} of sortedReplacements) {
    newQuery = replaceQueryToken(newQuery, token, replacement);
  }

  return newQuery;
}

function removeExcessWhitespaceFromParts(...parts: string[]): string {
  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(' ')
    .trim();
}

// Ensures that the replaced token is separated from the rest of the query
// and cleans up any extra whitespace
function replaceTokensWithPadding(
  query: string,
  tokens: Array<TokenResult<Token>>,
  value: string
): string {
  if (tokens.length === 0) {
    return query;
  }

  const start = query.substring(0, tokens[0]!.location.start.offset);
  const end = query.substring(tokens.at(-1)!.location.end.offset);

  return removeExcessWhitespaceFromParts(start, value, end);
}

function updateFreeText(
  state: QueryBuilderState,
  action: UpdateFreeTextAction
): QueryBuilderState {
  const newQuery = replaceTokensWithPadding(state.query, action.tokens, action.text);

  if (newQuery === state.query) {
    return state;
  }

  // Only update the committed query if we aren't in the middle of creating a filter
  const committedQuery = action.shouldCommitQuery ? newQuery : state.committedQuery;

  return {
    ...state,
    query: newQuery,
    committedQuery,
    focusOverride:
      action.focusOverride === undefined ? state.focusOverride : action.focusOverride,
  };
}

function replaceTokensWithText(
  state: QueryBuilderState,
  {
    getFieldDefinition,
    text,
    tokens,
    focusOverride: incomingFocusOverride,
  }: {
    getFieldDefinition: FieldDefinitionGetter;
    text: string;
    tokens: Array<TokenResult<Token>>;
    focusOverride?: FocusOverride;
  }
): QueryBuilderState {
  const newQuery = replaceTokensWithPadding(state.query, tokens, text);

  if (newQuery === state.query) {
    return state;
  }

  // Only update the committed query if we aren't in the middle of creating a filter
  const committedQuery =
    incomingFocusOverride?.part === 'value' ? state.committedQuery : newQuery;

  if (incomingFocusOverride) {
    return {
      ...state,
      query: newQuery,
      committedQuery,
      focusOverride: incomingFocusOverride,
    };
  }

  const cursorPosition = (tokens[0]?.location.start.offset ?? 0) + text.length; // TODO: Ensure this is sorted
  const newParsedQuery = parseQueryBuilderValue(newQuery, getFieldDefinition);
  const focusedToken = newParsedQuery?.find(
    (token: any) =>
      token.type === Token.FREE_TEXT && token.location.end.offset >= cursorPosition
  );

  const focusOverride = focusedToken
    ? {itemKey: makeTokenKey(focusedToken, newParsedQuery)}
    : null;

  return {
    ...state,
    query: newQuery,
    committedQuery: newQuery,
    focusOverride,
  };
}

function modifyFilterValue(
  query: string,
  token: TokenResult<Token.FILTER>,
  newValue: string
): string {
  if (isDateToken(token)) {
    return modifyFilterValueDate(query, token, newValue);
  }

  // stop the user from entering multiple wildcards by themselves
  newValue = newValue.replace(/\*\*+/g, '*');

  return replaceQueryToken(query, token.value, newValue);
}

function updateFilterMultipleValues(
  state: QueryBuilderState,
  token: TokenResult<Token.FILTER>,
  values: string[]
) {
  const uniqNonEmptyValues = Array.from(
    new Set(values.filter(value => value.length > 0))
  );
  if (uniqNonEmptyValues.length === 0) {
    return {...state, query: replaceQueryToken(state.query, token.value, '""')};
  }

  const newValue =
    uniqNonEmptyValues.length > 1
      ? `[${uniqNonEmptyValues.join(',')}]`
      : uniqNonEmptyValues[0]!;

  return {...state, query: replaceQueryToken(state.query, token.value, newValue)};
}

function multiSelectTokenValue(
  state: QueryBuilderState,
  action: MultiSelectFilterValueAction
) {
  const tokenValue = action.token.value;

  switch (tokenValue.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST: {
      const values = tokenValue.items.map(item => item.value?.text ?? '');
      const containsValue = values.includes(action.value);
      const newValues = containsValue
        ? values.filter(value => value !== action.value)
        : [...values, action.value];

      return updateFilterMultipleValues(state, action.token, newValues);
    }
    default: {
      if (tokenValue.text === action.value) {
        return updateFilterMultipleValues(state, action.token, ['']);
      }
      const newValue = tokenValue.value
        ? [tokenValue.text, action.value]
        : [action.value];
      return updateFilterMultipleValues(state, action.token, newValue);
    }
  }
}

function updateAggregateArgs(
  state: QueryBuilderState,
  action: UpdateAggregateArgsAction,
  {
    getFieldDefinition,
  }: {
    getFieldDefinition: FieldDefinitionGetter;
  }
): QueryBuilderState {
  const fieldDefinition = getFieldDefinition(getKeyName(action.token.key));
  const focusOverride =
    action.focusOverride === undefined ? state.focusOverride : action.focusOverride;

  if (!fieldDefinition?.parameterDependentValueType) {
    return {
      ...state,
      query: replaceQueryToken(state.query, getArgsToken(action.token), action.value),
      focusOverride,
    };
  }

  const newValueType = fieldDefinition.parameterDependentValueType(
    action.value.split(',').map(arg => arg.trim())
  );
  const oldValueType = convertTokenTypeToValueType(action.token.value.type);

  if (newValueType === oldValueType) {
    return {
      ...state,
      query: replaceQueryToken(state.query, getArgsToken(action.token), action.value),
      focusOverride,
    };
  }

  const newValue = getDefaultValueForValueType(newValueType);

  return {
    ...state,
    query: multipleReplaceQueryToken(state.query, [
      {token: getArgsToken(action.token), replacement: action.value},
      {token: action.token.value, replacement: newValue},
    ]),
    focusOverride,
  };
}

function updateFilterKey(
  state: QueryBuilderState,
  action: UpdateFilterKeyAction
): QueryBuilderState {
  const newQuery = replaceQueryToken(state.query, action.token.key, action.key);

  if (newQuery === state.query) {
    return state;
  }

  return {
    ...state,
    query: newQuery,
    committedQuery: newQuery,
  };
}

export function useQueryBuilderState({
  initialQuery,
  getFieldDefinition,
  disabled,
}: {
  disabled: boolean;
  getFieldDefinition: FieldDefinitionGetter;
  initialQuery: string;
}) {
  const hasWildcardOperators = useOrganization().features.includes(
    'search-query-builder-wildcard-operators'
  );

  const initialState: QueryBuilderState = {
    query: initialQuery,
    committedQuery: initialQuery,
    focusOverride: null,
  };
  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      if (disabled) {
        return state;
      }

      switch (action.type) {
        case 'CLEAR':
          return {
            ...state,
            query: '',
            committedQuery: '',
            focusOverride: {
              itemKey: `${Token.FREE_TEXT}:0`,
            },
          };
        case 'COMMIT_QUERY':
          if (state.query === state.committedQuery) {
            return state;
          }
          return {
            ...state,
            committedQuery: state.query,
          };
        case 'UPDATE_QUERY': {
          const shouldCommitQuery = action.shouldCommitQuery ?? true;
          return {
            ...state,
            query: action.query,
            committedQuery: shouldCommitQuery ? action.query : state.committedQuery,
            focusOverride: action.focusOverride ?? null,
          };
        }
        case 'RESET_FOCUS_OVERRIDE':
          return {
            ...state,
            focusOverride: null,
          };
        case 'DELETE_TOKEN':
          return replaceTokensWithText(state, {
            tokens: [action.token],
            text: '',
            getFieldDefinition,
          });
        case 'DELETE_TOKENS':
          return deleteQueryTokens(state, action);
        case 'UPDATE_FREE_TEXT':
          return updateFreeText(state, action);
        case 'REPLACE_TOKENS_WITH_TEXT':
          return replaceTokensWithText(state, {
            tokens: action.tokens,
            text: action.text,
            focusOverride: action.focusOverride,
            getFieldDefinition,
          });
        case 'UPDATE_FILTER_KEY':
          return updateFilterKey(state, action);
        case 'UPDATE_FILTER_OP':
          return modifyFilterOperator(state, action, hasWildcardOperators);
        case 'UPDATE_TOKEN_VALUE':
          return {
            ...state,
            query: modifyFilterValue(state.query, action.token, action.value),
          };
        case 'UPDATE_AGGREGATE_ARGS':
          return updateAggregateArgs(state, action, {getFieldDefinition});
        case 'TOGGLE_FILTER_VALUE':
          return multiSelectTokenValue(state, action);
        default:
          return state;
      }
    },
    [disabled, getFieldDefinition, hasWildcardOperators]
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    state,
    dispatch,
  };
}
