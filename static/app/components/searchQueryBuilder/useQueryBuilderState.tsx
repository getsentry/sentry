import {type Reducer, useCallback, useReducer} from 'react';

import {
  type QueryBuilderFocusState,
  QueryBuilderFocusType,
} from 'sentry/components/searchQueryBuilder/types';
import {
  type ParseResultToken,
  parseSearch,
  TermOperator,
  Token,
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

type FocusFreeTextAction = {
  cursor: number;
  type: 'FOCUS_FREE_TEXT';
};

export type QueryBuilderActions =
  | DeleteTokenAction
  | UpdateFreeTextAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction
  | ExitTokenAction
  | ClickTokenOpAction
  | ClickTokenValueAction
  | FocusFreeTextAction;

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

// Sets focus to the end of the query
function createEndFocusState(query: string): QueryBuilderFocusState {
  return {
    type: QueryBuilderFocusType.TOKEN,
    range: {
      start: query.length,
      end: query.length,
    },
  };
}

function resetFocus(state: QueryBuilderState): QueryBuilderState {
  return {
    ...state,
    focus: createEndFocusState(state.query),
  };
}

function findMatchingFilterToken({
  query,
  originalToken,
  newFilterToken,
}: {
  newFilterToken: TokenResult<Token.FILTER>;
  originalToken: TokenResult<Token>;
  query: string;
}): TokenResult<Token.FILTER> | null {
  const parsedQuery = parseSearch(query);

  for (const token of parsedQuery ?? []) {
    if (
      token.location.start.offset >= originalToken.location.start.offset &&
      token.type === Token.FILTER &&
      token.key.text === newFilterToken.key.text
    ) {
      return token;
    }
  }

  return null;
}

function calculateNewFocusAfterFreeTextUpdate(
  query: string,
  action: UpdateFreeTextAction
) {
  const parsed = parseSearch(action.text);
  const newFilterToken = parsed?.find(
    (token): token is TokenResult<Token.FILTER> => token.type === Token.FILTER
  );

  if (!newFilterToken) {
    return createEndFocusState(query);
  }

  const matchingToken = findMatchingFilterToken({
    query,
    originalToken: action.token,
    newFilterToken,
  });

  if (!matchingToken) {
    return createEndFocusState(query);
  }

  return {
    type: QueryBuilderFocusType.FILTER_VALUE,
    range: {
      start: matchingToken.location.start.offset,
      end: matchingToken.location.end.offset,
    },
    editing: true,
  };
}

function updateFreeText(
  state: QueryBuilderState,
  action: UpdateFreeTextAction
): QueryBuilderState {
  const newQuery = replaceTokenWithPadding(state.query, action.token, action.text);

  return {
    ...state,
    focus: calculateNewFocusAfterFreeTextUpdate(newQuery, action),
    query: newQuery,
  };
}

export function useQueryBuilderState({initialQuery}: {initialQuery: string}) {
  const initialState: QueryBuilderState = {query: initialQuery, focus: null};

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      switch (action.type) {
        case 'DELETE_TOKEN':
          return resetFocus({
            ...state,
            query: removeQueryToken(state.query, action.token),
          });
        case 'UPDATE_FREE_TEXT':
          return updateFreeText(state, action);
        case 'UPDATE_FILTER_OP':
          return resetFocus({
            ...state,
            query: modifyFilterOperator(state.query, action.token, action.op),
          });
        case 'UPDATE_TOKEN_VALUE':
          return resetFocus({
            ...state,
            query: replaceQueryToken(state.query, action.token, action.value),
          });
        case 'EXIT_TOKEN':
          return resetFocus({
            ...state,
          });
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
        case 'FOCUS_FREE_TEXT':
          return {
            ...state,
            focus: {
              type: QueryBuilderFocusType.TOKEN,
              range: {
                start: action.cursor,
                end: action.cursor,
              },
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
