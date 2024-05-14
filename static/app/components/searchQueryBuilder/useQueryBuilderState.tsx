import {type Reducer, useCallback, useReducer} from 'react';

import {
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';

type QueryBuilderState = {
  query: string;
};

type DeleteTokenAction = {
  token: ParseResultToken;
  type: 'DELETE_TOKEN';
};

type UpdateFreeTextAction = {
  text: string;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
  type: 'UPDATE_FREE_TEXT';
};

type UpdateFilterOpAction = {
  op: TermOperator;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_FILTER_OP';
};

type UpdateTokenValueAction = {
  token: TokenResult<Token>;
  type: 'UPDATE_TOKEN_VALUE';
  value: string;
};

export type QueryBuilderActions =
  | DeleteTokenAction
  | UpdateFreeTextAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction;

function removeQueryToken(query: string, token: TokenResult<Token>): string {
  return (
    query.substring(0, token.location.start.offset) +
    query.substring(token.location.end.offset)
  );
}

function modifyFilterOperator(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: TermOperator
): string {
  const isNotEqual = newOperator === TermOperator.NOT_EQUAL;

  token.operator = isNotEqual ? TermOperator.DEFAULT : newOperator;
  token.negated = isNotEqual;

  return (
    query.substring(0, token.location.start.offset) +
    stringifyToken(token) +
    query.substring(token.location.end.offset)
  );
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

// Ensures that the replaced token is separated from the rest of the query
// and cleans up any extra whitespace
function replaceTokenWithPadding(
  query: string,
  token: TokenResult<Token>,
  value: string
): string {
  const start = query.substring(0, token.location.start.offset);
  const end = query.substring(token.location.end.offset);

  return (start.trimEnd() + ' ' + value.trim() + ' ' + end.trimStart()).trim();
}

function updateFreeText(
  state: QueryBuilderState,
  action: UpdateFreeTextAction
): QueryBuilderState {
  const newQuery = replaceTokenWithPadding(state.query, action.token, action.text);

  return {
    ...state,
    query: newQuery,
  };
}

export function useQueryBuilderState({initialQuery}: {initialQuery: string}) {
  const initialState: QueryBuilderState = {query: initialQuery};

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      switch (action.type) {
        case 'DELETE_TOKEN':
          return {
            query: removeQueryToken(state.query, action.token),
          };
        case 'UPDATE_FREE_TEXT':
          return updateFreeText(state, action);
        case 'UPDATE_FILTER_OP':
          return {
            query: modifyFilterOperator(state.query, action.token, action.op),
          };
        case 'UPDATE_TOKEN_VALUE':
          return {
            query: replaceQueryToken(state.query, action.token, action.value),
          };
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
