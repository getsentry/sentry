import {useCallback, useEffect, useReducer, type Reducer} from 'react';

import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/date/parser';
import {
  convertTokenTypeToValueType,
  escapeTagValue,
  getArgsToken,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {getDefaultValueForValueType} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {
  type FieldDefinitionGetter,
  type FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {isDateToken, makeTokenKey} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  TermOperator,
  Token,
  WildcardOperators,
  type AggregateFilter,
  type ParseResult,
  type ParseResultToken,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName, stringifyToken} from 'sentry/components/searchSyntax/utils';

type QueryBuilderState = {
  /**
   * This is a flag that is set to true when the user has committed a query.
   * It is used to clear the ask seer feedback when the user deletes a token.
   */
  clearAskSeerFeedback: boolean;

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

type UpdateFreeTextActionOnSelect = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_SELECT';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextActionOnBlur = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_BLUR';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextActionOnCommit = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_COMMIT';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextActionOnExit = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_EXIT';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextActionOnFunction = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_FUNCTION';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextActionOnParenthesis = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_PARENTHESIS';
  focusOverride?: FocusOverride;
};

type UpdateFreeTextActionOnColon = {
  shouldCommitQuery: boolean;
  text: string;
  tokens: ParseResultToken[];
  type: 'UPDATE_FREE_TEXT_ON_COLON';
  focusOverride?: FocusOverride;
};

type ReplaceTokensWithTextOnPasteAction = {
  text: string;
  tokens: ParseResultToken[];
  type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE';
  focusOverride?: FocusOverride;
};

type ReplaceTokensWithTextOnDeleteAction = {
  text: string;
  tokens: ParseResultToken[];
  type: 'REPLACE_TOKENS_WITH_TEXT_ON_DELETE';
  focusOverride?: FocusOverride;
};

type ReplaceTokensWithTextOnCutAction = {
  text: string;
  tokens: ParseResultToken[];
  type: 'REPLACE_TOKENS_WITH_TEXT_ON_CUT';
  focusOverride?: FocusOverride;
};

type ReplaceTokensWithTextOnKeyDownAction = {
  text: string;
  tokens: ParseResultToken[];
  type: 'REPLACE_TOKENS_WITH_TEXT_ON_KEY_DOWN';
  focusOverride?: FocusOverride;
};

type ReplaceTokensWithTextOnSelectAction = {
  text: string;
  tokens: ParseResultToken[];
  type: 'REPLACE_TOKENS_WITH_TEXT_ON_SELECT';
  focusOverride?: FocusOverride;
};

type UpdateFilterKeyAction = {
  key: string;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_FILTER_KEY';
};

type UpdateFilterOpAction = {
  op: TermOperator;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_FILTER_OP';
  focusOverride?: FocusOverride;
  shouldCommitQuery?: boolean;
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

type UpdateLogicOperatorAction = {
  token: TokenResult<Token.LOGIC_BOOLEAN>;
  type: 'UPDATE_LOGIC_OPERATOR';
  value: string;
};

type WrapTokensWithParenthesesAction = {
  tokens: ParseResultToken[];
  type: 'WRAP_TOKENS_WITH_PARENTHESES';
  focusOverride?: FocusOverride;
};

type ResetClearAskSeerFeedbackAction = {type: 'RESET_CLEAR_ASK_SEER_FEEDBACK'};

type UpdateFreeTextActions =
  | UpdateFreeTextActionOnSelect
  | UpdateFreeTextActionOnBlur
  | UpdateFreeTextActionOnCommit
  | UpdateFreeTextActionOnExit
  | UpdateFreeTextActionOnFunction
  | UpdateFreeTextActionOnParenthesis
  | UpdateFreeTextActionOnColon;

export type QueryBuilderActions =
  | ClearAction
  | CommitQueryAction
  | UpdateQueryAction
  | ResetFocusOverrideAction
  | DeleteTokenAction
  | DeleteTokensAction
  | UpdateFreeTextActionOnSelect
  | UpdateFreeTextActionOnBlur
  | UpdateFreeTextActionOnCommit
  | UpdateFreeTextActionOnExit
  | UpdateFreeTextActionOnFunction
  | UpdateFreeTextActionOnParenthesis
  | UpdateFreeTextActionOnColon
  | ReplaceTokensWithTextOnPasteAction
  | ReplaceTokensWithTextOnDeleteAction
  | ReplaceTokensWithTextOnCutAction
  | ReplaceTokensWithTextOnKeyDownAction
  | ReplaceTokensWithTextOnSelectAction
  | UpdateFilterKeyAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction
  | UpdateAggregateArgsAction
  | MultiSelectFilterValueAction
  | ResetClearAskSeerFeedbackAction
  | UpdateLogicOperatorAction
  | WrapTokensWithParenthesesAction;

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

export function modifyFilterOperatorQuery(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: TermOperator
): string {
  if (isDateToken(token)) {
    return modifyFilterOperatorDate(query, token, newOperator);
  }

  const newToken: TokenResult<Token.FILTER> = {...token};
  newToken.negated =
    newOperator === TermOperator.NOT_EQUAL ||
    newOperator === TermOperator.DOES_NOT_CONTAIN ||
    newOperator === TermOperator.DOES_NOT_START_WITH ||
    newOperator === TermOperator.DOES_NOT_END_WITH;

  if (newOperator === TermOperator.DOES_NOT_CONTAIN) {
    newToken.operator = TermOperator.CONTAINS;
  } else if (newOperator === TermOperator.DOES_NOT_START_WITH) {
    newToken.operator = TermOperator.STARTS_WITH;
  } else if (newOperator === TermOperator.DOES_NOT_END_WITH) {
    newToken.operator = TermOperator.ENDS_WITH;
  } else {
    newToken.operator =
      newOperator === TermOperator.NOT_EQUAL ? TermOperator.DEFAULT : newOperator;
  }

  return replaceQueryToken(query, token, stringifyToken(newToken));
}

function modifyFilterOperator(
  state: QueryBuilderState,
  action: UpdateFilterOpAction
): QueryBuilderState {
  const newQuery = modifyFilterOperatorQuery(state.query, action.token, action.op);

  if (newQuery === state.query && !action.focusOverride) {
    return state;
  }

  return {
    ...state,
    focusOverride: action.focusOverride ?? null,
    query: newQuery,
    committedQuery: (action.shouldCommitQuery ?? true) ? newQuery : state.committedQuery,
  };
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

function wrapTokensWithParentheses(
  state: QueryBuilderState,
  action: WrapTokensWithParenthesesAction,
  parseQuery: (query: string) => ParseResult | null
): QueryBuilderState {
  if (action.tokens.length === 0) {
    return state;
  }

  const firstToken = action.tokens[0]!;
  const lastToken = action.tokens[action.tokens.length - 1]!;

  const before = state.query.substring(0, firstToken.location.start.offset);
  const middle = state.query.substring(
    firstToken.location.start.offset,
    lastToken.location.end.offset
  );
  const after = state.query.substring(lastToken.location.end.offset);

  const newQuery = `${before}(${middle})${after}`.trim();
  const cursorPosition = firstToken.location.start.offset + middle.length + 2;
  const newParsedQuery = parseQuery(newQuery);

  const focusedToken = newParsedQuery?.find(
    (token: any) =>
      token.type === Token.FREE_TEXT && token.location.start.offset >= cursorPosition
  );

  const focusOverride = focusedToken
    ? {itemKey: makeTokenKey(focusedToken, newParsedQuery)}
    : newParsedQuery?.length
      ? {
          itemKey: makeTokenKey(
            newParsedQuery[newParsedQuery.length - 1]!,
            newParsedQuery
          ),
        }
      : null;

  return {
    ...state,
    query: newQuery,
    committedQuery: newQuery,
    focusOverride,
  };
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
  action: UpdateFreeTextActions
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
    parseQuery,
    text,
    tokens,
    focusOverride: incomingFocusOverride,
    shouldCommitQuery,
  }: {
    parseQuery: (query: string) => ParseResult | null;
    shouldCommitQuery: boolean;
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
    incomingFocusOverride?.part === 'value' && shouldCommitQuery
      ? state.committedQuery
      : newQuery;

  if (incomingFocusOverride) {
    return {
      ...state,
      query: newQuery,
      committedQuery,
      focusOverride: incomingFocusOverride,
    };
  }

  const cursorPosition = (tokens[0]?.location.start.offset ?? 0) + text.length; // TODO: Ensure this is sorted
  const newParsedQuery = parseQuery(newQuery);

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
    committedQuery: shouldCommitQuery ? newQuery : state.committedQuery,
    focusOverride,
  };
}

export function modifyFilterValue(
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

/**
 * This function is used to replace free text tokens with the specified
 * `replaceRawSearchKeys` prop from `SearchQueryBuilder`. This function also handles
 * escaping values, as well as merging the previously created filter.
 *
 * Example, `replaceRawSearchKeys` set to `['span.description']`
 *
 * 1. User types `text` -> `span.description:*text*`
 * 2. User types `some text` -> `span.description:"*some text*"`
 * 3. `span.description:*test*` already exists, user types `some text` -> `span.
 * description:[*test*,"*some text*"]`
 */
export function replaceFreeTextTokens(
  currentQuery: string,
  parseQuery: (query: string) => ParseResult | null,
  replaceRawSearchKeys: string[]
) {
  if (
    currentQuery.trim().length === 0 ||
    replaceRawSearchKeys.length === 0 ||
    (replaceRawSearchKeys.length !== 0 && replaceRawSearchKeys[0] === '')
  ) {
    return undefined;
  }

  const currentQueryTokens = parseQuery(currentQuery) ?? [];
  const foundFreeTextToken = currentQueryTokens.some(
    token => token.type === Token.FREE_TEXT && token.text.trim().length > 0
  );

  if (!foundFreeTextToken) {
    return undefined;
  }

  const primarySearchKey = replaceRawSearchKeys[0] ?? '';
  const replacedQuery: string[] = [];
  for (const token of currentQueryTokens) {
    if (token.type === Token.L_PAREN) {
      replacedQuery.push('(');
      continue;
    }

    if (token.type === Token.R_PAREN) {
      replacedQuery.push(')');
      continue;
    }

    if (token.type !== Token.FREE_TEXT) {
      const stringifiedToken = stringifyToken(token);
      if (stringifiedToken.length > 0) {
        replacedQuery.push(stringifiedToken);
      }
      continue;
    }

    if (token.text.trim().length === 0) {
      continue;
    }

    const value = escapeTagValue(token.text.trim());

    // We don't want to break user flows, so if they include an asterisk in their free
    // text value, leave it as an `is` filter.
    if (value.includes('*')) {
      replacedQuery.push(`${primarySearchKey}:${value}`);
    } else if (
      !token.quoted &&
      value.startsWith('"') &&
      value.endsWith('"') &&
      value.includes(' ')
    ) {
      const formattedValue = value
        .slice(1, -1)
        .trim()
        .replace(/\s+/g, ' ')
        .replaceAll(' ', '*');
      replacedQuery.push(`${primarySearchKey}:"*${formattedValue}*"`);
    } else {
      replacedQuery.push(`${primarySearchKey}:${WildcardOperators.CONTAINS}${value}`);
    }
  }

  const finalQuery = replacedQuery.join(' ').trim();
  const newParsedQuery = parseQuery(finalQuery) ?? [];
  const focusedToken = newParsedQuery?.findLast(token => token.type === Token.FREE_TEXT);
  const focusOverride = focusedToken
    ? {itemKey: makeTokenKey(focusedToken, newParsedQuery)}
    : null;

  return {newQuery: finalQuery, focusOverride};
}

function updateFreeTextAndReplaceText(
  state: QueryBuilderState,
  action:
    | UpdateFreeTextActionOnBlur
    | UpdateFreeTextActionOnExit
    | UpdateFreeTextActionOnCommit,
  parseQuery: (query: string) => ParseResult | null,
  replaceRawSearchKeys?: string[]
): QueryBuilderState {
  const newState = updateFreeText(state, action);

  if (!replaceRawSearchKeys || replaceRawSearchKeys.length === 0) {
    return newState;
  }

  const replacedState = replaceFreeTextTokens(
    newState.query,
    parseQuery,
    replaceRawSearchKeys ?? []
  );

  const query = replacedState?.newQuery ? replacedState.newQuery : newState.query;

  let focusOverride = null;
  // Only update the focus override if the user has committed the query or exited the
  // input. This is to prevent issues when the user blurs the input, they would be
  // re-focused onto it.
  if (
    action.type === 'UPDATE_FREE_TEXT_ON_COMMIT' ||
    action.type === 'UPDATE_FREE_TEXT_ON_EXIT'
  ) {
    focusOverride = replacedState?.focusOverride
      ? replacedState.focusOverride
      : newState.focusOverride;
  }

  // Only update the committed query if we aren't in the middle of creating a filter
  const committedQuery = action.shouldCommitQuery ? query : state.committedQuery;

  return {
    ...newState,
    query,
    committedQuery,
    focusOverride,
  };
}

function updateLogicOperator(
  state: QueryBuilderState,
  action: UpdateLogicOperatorAction
): QueryBuilderState {
  const newQuery = replaceQueryToken(state.query, action.token, action.value);
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
  displayAskSeerFeedback,
  setDisplayAskSeerFeedback,
  replaceRawSearchKeys,
  parseQuery,
}: {
  disabled: boolean;
  displayAskSeerFeedback: boolean;
  getFieldDefinition: FieldDefinitionGetter;
  initialQuery: string;
  parseQuery: (query: string) => ParseResult | null;
  setDisplayAskSeerFeedback: (value: boolean) => void;
  replaceRawSearchKeys?: string[];
}) {
  const initialState: QueryBuilderState = {
    query: initialQuery,
    committedQuery: initialQuery,
    focusOverride: null,
    clearAskSeerFeedback: false,
  };

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      if (disabled) {
        return state;
      }

      const hasReplaceRawSearchKeys =
        replaceRawSearchKeys && replaceRawSearchKeys.length > 0;

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
            return {...state};
          }
          return {...state, committedQuery: state.query};
        case 'UPDATE_QUERY': {
          const shouldCommitQuery = action.shouldCommitQuery ?? true;

          if (!hasReplaceRawSearchKeys) {
            return {
              ...state,
              query: action.query,
              committedQuery: shouldCommitQuery ? action.query : state.committedQuery,
              focusOverride: action.focusOverride ?? null,
            };
          }

          const replacedState = replaceFreeTextTokens(
            action.query,
            parseQuery,
            replaceRawSearchKeys
          );

          const query = replacedState?.newQuery ? replacedState.newQuery : action.query;
          const committedQuery = shouldCommitQuery ? query : state.committedQuery;
          const focusOverride = replacedState?.focusOverride
            ? replacedState.focusOverride
            : (action.focusOverride ?? null);

          return {
            ...state,
            query,
            committedQuery,
            focusOverride,
          };
        }
        case 'RESET_FOCUS_OVERRIDE':
          return {
            ...state,
            focusOverride: null,
          };
        case 'DELETE_TOKEN': {
          return {
            ...replaceTokensWithText(state, {
              tokens: [action.token],
              text: '',
              parseQuery,
              shouldCommitQuery: true,
            }),
            clearAskSeerFeedback: displayAskSeerFeedback ? true : false,
          };
        }
        case 'DELETE_TOKENS': {
          return {
            ...deleteQueryTokens(state, action),
            clearAskSeerFeedback: displayAskSeerFeedback ? true : false,
          };
        }
        case 'UPDATE_FREE_TEXT_ON_BLUR': {
          const newState = updateFreeText(state, action);
          return {
            ...newState,
            committedQuery: state.committedQuery,
            clearAskSeerFeedback:
              newState.query !== state.query && displayAskSeerFeedback ? true : false,
          };
        }
        case 'UPDATE_FREE_TEXT_ON_SELECT':
        case 'UPDATE_FREE_TEXT_ON_COLON':
        case 'UPDATE_FREE_TEXT_ON_FUNCTION':
        case 'UPDATE_FREE_TEXT_ON_PARENTHESIS': {
          const newState = updateFreeText(state, action);
          return {
            ...newState,
            clearAskSeerFeedback:
              newState.query !== state.query && displayAskSeerFeedback ? true : false,
          };
        }
        case 'UPDATE_FREE_TEXT_ON_EXIT':
        case 'UPDATE_FREE_TEXT_ON_COMMIT': {
          const newState = updateFreeTextAndReplaceText(
            state,
            action,
            parseQuery,
            replaceRawSearchKeys
          );

          return {
            ...newState,
            clearAskSeerFeedback:
              newState.query !== state.query && displayAskSeerFeedback ? true : false,
          };
        }
        case 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE':
        case 'REPLACE_TOKENS_WITH_TEXT_ON_KEY_DOWN': {
          return replaceTokensWithText(state, {
            tokens: action.tokens,
            text: action.text,
            focusOverride: action.focusOverride,
            parseQuery,
            shouldCommitQuery: hasReplaceRawSearchKeys ? false : true,
          });
        }
        case 'REPLACE_TOKENS_WITH_TEXT_ON_CUT':
        case 'REPLACE_TOKENS_WITH_TEXT_ON_DELETE':
        case 'REPLACE_TOKENS_WITH_TEXT_ON_SELECT': {
          return replaceTokensWithText(state, {
            tokens: action.tokens,
            text: action.text,
            focusOverride: action.focusOverride,
            parseQuery,
            shouldCommitQuery: true,
          });
        }
        case 'UPDATE_FILTER_KEY':
          return updateFilterKey(state, action);
        case 'UPDATE_FILTER_OP':
          return modifyFilterOperator(state, action);
        case 'UPDATE_TOKEN_VALUE':
          return {
            ...state,
            query: modifyFilterValue(state.query, action.token, action.value),
          };
        case 'UPDATE_LOGIC_OPERATOR':
          return updateLogicOperator(state, action);
        case 'UPDATE_AGGREGATE_ARGS':
          return updateAggregateArgs(state, action, {getFieldDefinition});
        case 'TOGGLE_FILTER_VALUE':
          return multiSelectTokenValue(state, action);
        case 'WRAP_TOKENS_WITH_PARENTHESES':
          return wrapTokensWithParentheses(state, action, parseQuery);
        case 'RESET_CLEAR_ASK_SEER_FEEDBACK':
          return {...state, clearAskSeerFeedback: false};
        default:
          return state;
      }
    },
    [
      disabled,
      displayAskSeerFeedback,
      getFieldDefinition,
      parseQuery,
      replaceRawSearchKeys,
    ]
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (state.clearAskSeerFeedback) {
      setDisplayAskSeerFeedback(false);
      // Reset the flag after clearing the feedback
      dispatch({type: 'RESET_CLEAR_ASK_SEER_FEEDBACK'});
    }
  }, [setDisplayAskSeerFeedback, state.clearAskSeerFeedback]);

  return {
    state,
    dispatch,
  };
}
