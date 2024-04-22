import {type Reducer, useCallback, useReducer} from 'react';

import {
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';

type QueryBuilderState = {
  focus: null; // TODO(malwilley): Implement focus state
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

export type QueryBuilderActions = DeleteTokenAction | UpdateFilterOpAction;

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
