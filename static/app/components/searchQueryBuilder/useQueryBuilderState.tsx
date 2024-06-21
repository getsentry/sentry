import {type Reducer, useCallback, useReducer} from 'react';

import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/filterValueParser/date/parser';
import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';
import {
  isDateToken,
  makeTokenKey,
  parseQueryBuilderValue,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';

type QueryBuilderState = {
  focusOverride: FocusOverride | null;
  query: string;
};

type ClearAction = {type: 'CLEAR'};

type UpdateQueryAction = {
  query: string;
  type: 'UPDATE_QUERY';
  focusOverride?: FocusOverride | null;
};

type ResetFocusOverrideAction = {type: 'RESET_FOCUS_OVERRIDE'};

type DeleteTokenAction = {
  token: ParseResultToken;
  type: 'DELETE_TOKEN';
};

type UpdateFreeTextAction = {
  text: string;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
  type: 'UPDATE_FREE_TEXT';
  focusOverride?: FocusOverride;
};

type PasteFreeTextAction = {
  text: string;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
  type: 'PASTE_FREE_TEXT';
};

type UpdateFilterOpAction = {
  op: TermOperator;
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

type DeleteLastMultiSelectFilterValueAction = {
  token: TokenResult<Token.FILTER>;
  type: 'DELETE_LAST_MULTI_SELECT_FILTER_VALUE';
};

export type QueryBuilderActions =
  | ClearAction
  | UpdateQueryAction
  | ResetFocusOverrideAction
  | DeleteTokenAction
  | UpdateFreeTextAction
  | PasteFreeTextAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction
  | MultiSelectFilterValueAction
  | DeleteLastMultiSelectFilterValueAction;

function removeQueryToken(query: string, token: TokenResult<Token>): string {
  return removeExcessWhitespaceFromParts(
    query.substring(0, token.location.start.offset),
    query.substring(token.location.end.offset)
  );
}

function modifyFilterOperator(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: TermOperator
): string {
  if (isDateToken(token)) {
    return modifyFilterOperatorDate(query, token, newOperator);
  }

  const isNotEqual = newOperator === TermOperator.NOT_EQUAL;

  const newToken: TokenResult<Token.FILTER> = {...token};
  newToken.operator = isNotEqual ? TermOperator.DEFAULT : newOperator;
  newToken.negated = isNotEqual;

  return replaceQueryToken(query, token, stringifyToken(newToken));
}

function modifyFilterOperatorDate(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: TermOperator
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
        const generatedIsoDateStr = new Date().toISOString();
        const newTokenStr = `${token.key.text}:${newOperator}${generatedIsoDateStr}`;
        return replaceQueryToken(query, token, newTokenStr);
      }
      return modifyFilterOperator(query, token, newOperator);
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
    return replaceQueryToken(query, token.value, newValue);
  }
  return `${token.key.text}:${newValue}`;
}

function replaceQueryToken(
  query: string,
  token: TokenResult<Token>,
  value: string
): string {
  const start = query.substring(0, token.location.start.offset);
  const end = query.substring(token.location.end.offset);

  return start + value + end;
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
export function replaceTokenWithPadding(
  query: string,
  token: TokenResult<Token>,
  value: string
): string {
  const start = query.substring(0, token.location.start.offset);
  const end = query.substring(token.location.end.offset);

  return removeExcessWhitespaceFromParts(start, value, end);
}

function updateFreeText(
  state: QueryBuilderState,
  action: UpdateFreeTextAction
): QueryBuilderState {
  const newQuery = replaceTokenWithPadding(state.query, action.token, action.text);

  return {
    ...state,
    query: newQuery,
    focusOverride:
      action.focusOverride === undefined ? state.focusOverride : action.focusOverride,
  };
}

function pasteFreeText(
  state: QueryBuilderState,
  action: PasteFreeTextAction
): QueryBuilderState {
  const newQuery = replaceTokenWithPadding(state.query, action.token, action.text);
  const cursorPosition = action.token.location.start.offset + action.text.length;
  const newParsedQuery = parseQueryBuilderValue(newQuery);
  const focusedToken = newParsedQuery?.find(
    token =>
      token.type === Token.FREE_TEXT && token.location.start.offset >= cursorPosition
  );
  const focusedItemKey = focusedToken ? makeTokenKey(focusedToken, newParsedQuery) : null;

  return {
    ...state,
    query: newQuery,
    focusOverride: focusedItemKey ? {itemKey: focusedItemKey} : null,
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
    return {...state, query: replaceQueryToken(state.query, token.value, '')};
  }

  const newValue =
    uniqNonEmptyValues.length > 1
      ? `[${uniqNonEmptyValues.join(',')}]`
      : uniqNonEmptyValues[0];

  return {...state, query: replaceQueryToken(state.query, token.value, newValue)};
}

function multiSelectTokenValue(
  state: QueryBuilderState,
  action: MultiSelectFilterValueAction
) {
  const tokenValue = action.token.value;

  switch (tokenValue.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST:
      const values = tokenValue.items.map(item => item.value?.text ?? '');
      const containsValue = values.includes(action.value);
      const newValues = containsValue
        ? values.filter(value => value !== action.value)
        : [...values, action.value];

      return updateFilterMultipleValues(state, action.token, newValues);
    default:
      if (tokenValue.text === action.value) {
        return updateFilterMultipleValues(state, action.token, ['']);
      }
      return updateFilterMultipleValues(state, action.token, [
        tokenValue.text,
        action.value,
      ]);
  }
}

function deleteLastMultiSelectTokenValue(
  state: QueryBuilderState,
  action: DeleteLastMultiSelectFilterValueAction
) {
  const tokenValue = action.token.value;

  switch (tokenValue.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST:
      const newValues = tokenValue.items.slice(0, -1).map(item => item.value?.text ?? '');

      return updateFilterMultipleValues(state, action.token, newValues);
    default:
      return updateFilterMultipleValues(state, action.token, ['']);
  }
}

export function useQueryBuilderState({initialQuery}: {initialQuery: string}) {
  const initialState: QueryBuilderState = {query: initialQuery, focusOverride: null};

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      switch (action.type) {
        case 'CLEAR':
          return {
            ...state,
            query: '',
            focusOverride: {
              itemKey: `${Token.FREE_TEXT}:0`,
            },
          };
        case 'UPDATE_QUERY':
          return {
            ...state,
            query: action.query,
            focusOverride: action.focusOverride ?? null,
          };
        case 'RESET_FOCUS_OVERRIDE':
          return {
            ...state,
            focusOverride: null,
          };
        case 'DELETE_TOKEN':
          return {
            ...state,
            query: removeQueryToken(state.query, action.token),
          };
        case 'UPDATE_FREE_TEXT':
          return updateFreeText(state, action);
        case 'PASTE_FREE_TEXT':
          return pasteFreeText(state, action);
        case 'UPDATE_FILTER_OP':
          return {
            ...state,
            query: modifyFilterOperator(state.query, action.token, action.op),
          };
        case 'UPDATE_TOKEN_VALUE':
          return {
            ...state,
            query: modifyFilterValue(state.query, action.token, action.value),
          };
        case 'TOGGLE_FILTER_VALUE':
          return multiSelectTokenValue(state, action);
        case 'DELETE_LAST_MULTI_SELECT_FILTER_VALUE':
          return deleteLastMultiSelectTokenValue(state, action);
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    state,
    dispatch,
  };
}
