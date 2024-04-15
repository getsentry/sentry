import {type Reducer, useCallback, useMemo, useReducer} from 'react';

import type {
  QueryBuilderFocusState,
  QueryBuilderPart,
  QueryBuilderToken,
} from 'sentry/components/searchQueryBuilder/types';
import {
  parseSearch,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import domId from 'sentry/utils/domId';

type QueryBuilderState = {
  focus: QueryBuilderFocusState | null;
  tokens: QueryBuilderToken[];
};

type ClickTokenPartAction = {
  part: 'key' | 'op' | 'value';
  token: QueryBuilderToken;
  type: 'CLICK_TOKEN_PART';
};

type UpdateTokenAction = {
  id: string;
  token: Partial<QueryBuilderToken>;
  type: 'UPDATE_TOKEN';
};

type UpdateTokenKeyAction = {
  key: string;
  tokenId: string;
  type: 'UPDATE_TOKEN_KEY';
};

type UpdateTokenValueAction = {
  tokenId: string;
  type: 'UPDATE_TOKEN_VALUE';
  value: string;
};

type DeleteTokenAction = {
  tokenId: string;
  type: 'DELETE_TOKEN';
};

type AddTokenAction = {
  tokenId: string;
  type: 'ADD_TOKEN';
};

type ArrowLeftAction = {
  type: 'ARROW_LEFT';
};

type ArrowRightAction = {
  type: 'ARROW_RIGHT';
};

type FocusAction = {
  type: 'FOCUS';
};

type BlurAction = {
  type: 'BLUR';
};

type BlurTokenAction = {
  type: 'BLUR_TOKEN';
};

export type QueryBuilderActions =
  | ClickTokenPartAction
  | UpdateTokenAction
  | UpdateTokenKeyAction
  | UpdateTokenValueAction
  | AddTokenAction
  | DeleteTokenAction
  | ArrowLeftAction
  | ArrowRightAction
  | FocusAction
  | BlurAction
  | BlurTokenAction;

const FOCUS_ORDER: QueryBuilderPart[] = ['key', 'op', 'value', 'delete'];

const makeTokenId = () => domId('search-token-');

const clearUnrealizedTokens = (state: QueryBuilderState): QueryBuilderState => {
  return {
    ...state,
    tokens: state.tokens.filter(token => {
      if (!token.key || !defined(token.operator) || !token.value) {
        return false;
      }

      return true;
    }),
  };
};

const rotateTokenFocus = (
  state: QueryBuilderState,
  direction: 'left' | 'right'
): QueryBuilderState => {
  const focusedTokenId = state.focus?.tokenId ?? state.tokens?.at(-1)?.id;

  const tokenIndex = state.tokens.findIndex(token => token.id === focusedTokenId);

  if (tokenIndex === -1) {
    return state;
  }

  const nextIndex = Math.max(tokenIndex + direction === 'left' ? -1 : 1, 0);

  const nextToken = state.tokens[nextIndex];

  if (!nextToken) {
    const tokenId = makeTokenId();
    return {
      ...state,
      tokens: [...state.tokens, {id: tokenId}],
      focus: {
        tokenId,
        part: 'key',
        editing: true,
      },
    };
  }

  return {
    ...state,
    focus: {
      tokenId: nextToken.id,
      part: direction === 'left' ? 'delete' : 'key',
      editing: false,
    },
  };
};

const rotateFocus = (
  state: QueryBuilderState,
  direction: 'right' | 'left'
): QueryBuilderState => {
  if (!state.focus) {
    return state;
  }

  if (state.focus?.part) {
    const partIndex = FOCUS_ORDER.indexOf(state.focus.part);

    if (direction === 'left' ? partIndex > 0 : partIndex < FOCUS_ORDER.length - 1) {
      const nextPart = FOCUS_ORDER[partIndex + direction === 'left' ? -1 : 1];

      return {
        ...state,
        focus: {
          ...state.focus,
          part: nextPart,
          editing: false,
        },
      };
    }
  }

  return rotateTokenFocus(state, direction);
};

const addToken = (state: QueryBuilderState): QueryBuilderState => {
  const hasEmptyToken = state.tokens.find(token => !token.key);

  if (hasEmptyToken) {
    return {
      ...state,
      focus: {
        tokenId: hasEmptyToken.id,
        part: 'key',
        editing: true,
      },
    };
  }

  const newTokenId = makeTokenId();

  return {
    ...state,
    focus: {
      tokenId: newTokenId,
      part: 'key',
      editing: true,
    },
    tokens: [...state.tokens, {id: newTokenId}],
  };
};

export function useQueryBuilderState({initialQuery}: {initialQuery: string}) {
  const initialTokens: QueryBuilderToken[] = useMemo(() => {
    const parsed = parseSearch(initialQuery);

    return (
      parsed
        ?.filter(
          (token): token is TokenResult<Token.FILTER> => token.type === Token.FILTER
        )
        .map(token => {
          return {
            id: makeTokenId(),
            key: token.key.text,
            operator: token.operator, // negation?
            value:
              'items' in token.value
                ? token.value.items.map(item => item.value.text)
                : token.value.text,
          };
        }) ?? []
    );
  }, [initialQuery]);

  const initialState: QueryBuilderState = {focus: null, tokens: initialTokens};

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      switch (action.type) {
        case 'CLICK_TOKEN_PART':
          return {
            ...state,
            focus: {
              tokenId: action.token.id,
              editing: true,
              part: action.part,
            },
          };
        case 'ARROW_LEFT':
          return rotateFocus(state, 'left');
        case 'ARROW_RIGHT':
          return rotateFocus(state, 'right');
        case 'UPDATE_TOKEN':
          return {
            ...state,
            tokens: state.tokens.map(token => {
              if (token.id === action.id) {
                return {
                  operator: '',
                  ...token,
                  ...action.token,
                };
              }

              return token;
            }),
          };
        case 'UPDATE_TOKEN_KEY':
          return {
            ...state,
            focus: {
              tokenId: action.tokenId,
              part: 'value',
              editing: true,
            },
            tokens: state.tokens.map(token => {
              if (token.id === action.tokenId) {
                return {
                  ...token,
                  key: action.key,
                  operator: '',
                  value: '',
                };
              }

              return token;
            }),
          };
        case 'UPDATE_TOKEN_VALUE':
          const tokens = state.tokens.map(token => {
            if (token.id === action.tokenId) {
              return {
                ...token,
                value: action.value,
              };
            }

            return token;
          });

          return addToken({
            ...state,
            tokens,
          });
        case 'DELETE_TOKEN':
          return {
            ...state,
            tokens: state.tokens.filter(token => token.id !== action.tokenId),
            focus: null,
          };
        case 'BLUR_TOKEN':
          return {
            ...clearUnrealizedTokens(state),
            focus: null,
          };
        case 'BLUR':
          return {
            ...state,
            focus: null,
          };
        case 'FOCUS':
          if (state.focus) {
            return state;
          }

          const unrealizedToken = state.tokens.find(token => !token.key);

          if (unrealizedToken) {
            return {
              ...state,
              focus: {
                tokenId: unrealizedToken.id,
                part: 'key',
                editing: true,
              },
            };
          }

          return addToken(state);
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
