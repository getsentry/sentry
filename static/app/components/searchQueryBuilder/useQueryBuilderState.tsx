import {type Reducer, useCallback, useReducer} from 'react';

import {
  type QueryBuilderFocusState,
  QueryBuilderFocusType,
} from 'sentry/components/searchQueryBuilder/types';
import {
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';

type QueryBuilderState = {
  focus: QueryBuilderFocusState | null;
  query: string;
};

type DeleteTokenAction = {
  token: ParseResultToken;
  type: 'DELETE_TOKEN';
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

type ExitTokenAction = {
  type: 'EXIT_TOKEN';
};

type ClickTokenOpAction = {
  token: TokenResult<Token>;
  type: 'CLICK_TOKEN_OP';
};

type ClickTokenValueAction = {
  token: TokenResult<Token>;
  type: 'CLICK_TOKEN_VALUE';
};

export type QueryBuilderActions =
  | DeleteTokenAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction
  | ExitTokenAction
  | ClickTokenOpAction
  | ClickTokenValueAction;

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
  return (
    query.substring(0, token.location.start.offset) +
    value +
    query.substring(token.location.end.offset)
  );
}

export function useQueryBuilderState({initialQuery}: {initialQuery: string}) {
  const initialState: QueryBuilderState = {query: initialQuery, focus: null};

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      switch (action.type) {
        case 'DELETE_TOKEN':
          return {
            ...state,
            query: removeQueryToken(state.query, action.token),
            focus: null,
          };
        case 'UPDATE_FILTER_OP':
          return {
            ...state,
            query: modifyFilterOperator(state.query, action.token, action.op),
            focus: null,
          };
        case 'UPDATE_TOKEN_VALUE':
          return {
            ...state,
            query: replaceQueryToken(state.query, action.token, action.value),
            focus: null,
          };
        case 'EXIT_TOKEN':
          return {
            ...state,
            focus: null,
          };
        case 'CLICK_TOKEN_OP':
          return {
            ...state,
            focus: {
              type: QueryBuilderFocusType.FILTER_OP,
              range: {
                start: action.token.location.start.offset,
                end: action.token.location.end.offset,
              },
            },
          };
        case 'CLICK_TOKEN_VALUE':
          return {
            ...state,
            focus: {
              type: QueryBuilderFocusType.FILTER_VALUE,
              range: {
                start: action.token.location.start.offset,
                end: action.token.location.end.offset,
              },
              editing: true,
            },
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
