import {type Reducer, useCallback, useMemo, useReducer} from 'react';

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

type ClickTokenKeyAction = {
  token: TokenResult<Token>;
  type: 'CLICK_TOKEN_KEY';
};

type ClickTokenOpAction = {
  token: TokenResult<Token>;
  type: 'CLICK_TOKEN_OP';
};

type ClickTokenValueAction = {
  token: TokenResult<Token>;
  type: 'CLICK_TOKEN_VALUE';
};

type UpdateTokenKeyAction = {
  token: TokenResult<Token>;
  type: 'UPDATE_TOKEN_KEY';
  value: string;
};

type UpdateTokenOpAction = {
  op: TermOperator;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_TOKEN_OP';
};

type UpdateTokenValueAction = {
  token: TokenResult<Token>;
  type: 'UPDATE_TOKEN_VALUE';
  value: string;
};

type DeleteTokenAction = {
  token: ParseResultToken;
  type: 'DELETE_TOKEN';
};

type AddTokenAction = {
  type: 'ADD_TOKEN';
  value: string;
};

type ArrowLeftAction = {
  type: 'ARROW_LEFT';
};

type ArrowRightAction = {
  type: 'ARROW_RIGHT';
};

export type QueryBuilderActions =
  | ClickTokenKeyAction
  | ClickTokenOpAction
  | ClickTokenValueAction
  | UpdateTokenOpAction
  | UpdateTokenKeyAction
  | UpdateTokenValueAction
  | AddTokenAction
  | DeleteTokenAction
  | ArrowLeftAction
  | ArrowRightAction;

// const FOCUS_ORDER: QueryBuilderPart[] = ['key', 'op', 'value', 'delete'];

// const rotateTokenFocus = (
//   state: QueryBuilderState,
//   direction: 'left' | 'right'
// ): QueryBuilderState => {
//   const focusedTokenId = state.focus?.tokenId ?? state.tokens?.at(-1)?.id;

//   const tokenIndex = state.tokens.findIndex(token => token.id === focusedTokenId);

//   if (tokenIndex === -1) {
//     return state;
//   }

//   const nextIndex = Math.max(tokenIndex + direction === 'left' ? -1 : 1, 0);

//   const nextToken = state.tokens[nextIndex];

//   if (!nextToken) {
//     const tokenId = makeTokenId();
//     return {
//       ...state,
//       tokens: [...state.tokens, {id: tokenId}],
//       focus: {
//         tokenId,
//         part: 'key',
//         editing: true,
//       },
//     };
//   }

//   return {
//     ...state,
//     focus: {
//       tokenId: nextToken.id,
//       part: direction === 'left' ? 'delete' : 'key',
//       editing: false,
//     },
//   };
// };

// const rotateFocus = (
//   state: QueryBuilderState,
//   direction: 'right' | 'left'
// ): QueryBuilderState => {
//   if (!state.focus) {
//     return state;
//   }

//   if (state.focus?.part) {
//     const partIndex = FOCUS_ORDER.indexOf(state.focus.part);

//     if (direction === 'left' ? partIndex > 0 : partIndex < FOCUS_ORDER.length - 1) {
//       const nextPart = FOCUS_ORDER[partIndex + direction === 'left' ? -1 : 1];

//       return {
//         ...state,
//         focus: {
//           ...state.focus,
//           part: nextPart,
//           editing: false,
//         },
//       };
//     }
//   }

//   return rotateTokenFocus(state, direction);
// };

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
        case 'CLICK_TOKEN_KEY':
          return {
            ...state,
            focus: {
              type: QueryBuilderFocusType.TOKEN_KEY,
              range: {
                start: action.token.location.start.offset,
                end: action.token.location.end.offset,
              },
              editing: true,
            },
          };
        case 'CLICK_TOKEN_OP':
          return {
            ...state,
            focus: {
              type: QueryBuilderFocusType.TOKEN_OP,
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
              type: QueryBuilderFocusType.TOKEN_VALUE,
              range: {
                start: action.token.location.start.offset,
                end: action.token.location.end.offset,
              },
              editing: true,
            },
          };
        case 'UPDATE_TOKEN_OP':
          return {
            ...state,
            query: modifyFilterOperator(state.query, action.token, action.op),
            focus: null,
          };
        case 'UPDATE_TOKEN_KEY':
          const newCursorPosition =
            action.token.location.start.offset + action.value.length + 1;

          return {
            ...state,
            query: replaceQueryToken(state.query, action.token, action.value),
            focus: {
              type: QueryBuilderFocusType.TOKEN_VALUE,
              editing: true,
              range: {
                start: newCursorPosition,
                end: newCursorPosition,
              },
            },
          };
        case 'UPDATE_TOKEN_VALUE':
          return {
            ...state,
            query: replaceQueryToken(state.query, action.token, action.value),
            focus: null,
          };
        case 'ADD_TOKEN':
          return {
            ...state,
            query: state.query + ' ' + action.value,
            focus: null,
          };
        case 'DELETE_TOKEN':
          return {
            ...state,
            query: removeQueryToken(state.query, action.token),
            focus: null,
          };
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  return useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state, dispatch]
  );
}
