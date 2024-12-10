import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {
  BooleanOperator,
  FilterType,
  type ParseResult,
  type ParseResultToken,
  parseSearch,
  type SearchConfig,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import {FieldValueType} from 'sentry/utils/fields';

export const INTERFACE_TYPE_LOCALSTORAGE_KEY = 'search-query-builder-interface';

function getSearchConfigFromKeys(
  keys: TagCollection,
  getFieldDefinition: FieldDefinitionGetter
): Partial<SearchConfig> {
  const config = {
    textOperatorKeys: new Set<string>(),
    booleanKeys: new Set<string>(),
    numericKeys: new Set<string>(),
    dateKeys: new Set<string>(),
    durationKeys: new Set<string>(),
    percentageKeys: new Set<string>(),
  } satisfies Partial<SearchConfig>;

  for (const key in keys) {
    const fieldDef = getFieldDefinition(key);
    if (!fieldDef) {
      continue;
    }

    if (fieldDef.allowComparisonOperators) {
      config.textOperatorKeys.add(key);
    }

    switch (fieldDef.valueType) {
      case FieldValueType.BOOLEAN:
        config.booleanKeys.add(key);
        break;
      case FieldValueType.NUMBER:
      case FieldValueType.INTEGER:
      case FieldValueType.PERCENTAGE:
        config.numericKeys.add(key);
        break;
      case FieldValueType.DATE:
        config.dateKeys.add(key);
        break;
      case FieldValueType.DURATION:
        config.durationKeys.add(key);
        break;
      default:
        break;
    }
  }

  return config;
}

export function parseQueryBuilderValue(
  value: string,
  getFieldDefinition: FieldDefinitionGetter,
  options?: {
    filterKeys: TagCollection;
    disallowFreeText?: boolean;
    disallowLogicalOperators?: boolean;
    disallowUnsupportedFilters?: boolean;
    disallowWildcard?: boolean;
    getFilterTokenWarning?: (key: string) => React.ReactNode;
    invalidMessages?: SearchConfig['invalidMessages'];
  }
): ParseResult | null {
  return collapseTextTokens(
    parseSearch(value || ' ', {
      flattenParenGroups: true,
      disallowFreeText: options?.disallowFreeText,
      getFilterTokenWarning: options?.getFilterTokenWarning,
      validateKeys: options?.disallowUnsupportedFilters,
      disallowWildcard: options?.disallowWildcard,
      disallowedLogicalOperators: options?.disallowLogicalOperators
        ? new Set([BooleanOperator.AND, BooleanOperator.OR])
        : undefined,
      disallowParens: options?.disallowLogicalOperators,
      ...getSearchConfigFromKeys(options?.filterKeys ?? {}, getFieldDefinition),
      invalidMessages: options?.invalidMessages,
      supportedTags: options?.filterKeys,
    })
  );
}

/**
 * Generates a unique key for the given token.
 *
 * It's important that the key is as stable as possible. Since we derive tokens
 * from the a simple query string, this is difficult to guarantee. The best we
 * can do is to use the token type and which iteration of that type it is.
 *
 * Example for query "is:unresolved foo assignee:me bar":
 * Keys: ["freeText:0", "filter:0", "freeText:1" "filter:1", "freeText:2"]
 */
export function makeTokenKey(token: ParseResultToken, allTokens: ParseResult | null) {
  const tokenTypeIndex =
    allTokens?.filter(tk => tk.type === token.type).indexOf(token) ?? 0;

  return `${token.type}:${tokenTypeIndex}`;
}

const isSimpleTextToken = (
  token: ParseResultToken
): token is TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES> => {
  return [Token.FREE_TEXT, Token.SPACES].includes(token.type);
};

/**
 * Collapse adjacent FREE_TEXT and SPACES tokens into a single token.
 * This is useful for rendering the minimum number of inputs in the UI.
 */
function collapseTextTokens(tokens: ParseResult | null) {
  if (!tokens) {
    return null;
  }

  return tokens.reduce<ParseResult>((acc, token) => {
    // For our purposes, SPACES are equivalent to FREE_TEXT
    // Combining them ensures that keys don't change when text is added or removed,
    // which would cause the cursor to jump around.
    if (isSimpleTextToken(token)) {
      token.type = Token.FREE_TEXT;
    }

    if (acc.length === 0) {
      return [token];
    }

    const lastToken = acc[acc.length - 1];

    if (isSimpleTextToken(token) && isSimpleTextToken(lastToken)) {
      const freeTextToken = lastToken as TokenResult<Token.FREE_TEXT>;
      freeTextToken.value += token.value;
      freeTextToken.text += token.text;
      freeTextToken.location.end = token.location.end;

      if (token.type === Token.FREE_TEXT) {
        freeTextToken.quoted = freeTextToken.quoted || token.quoted;
        freeTextToken.invalid = freeTextToken.invalid ?? token.invalid;
      }

      return acc;
    }

    return [...acc, token];
  }, []);
}

export function tokenIsInvalid(token: TokenResult<Token>) {
  if (
    token.type !== Token.FILTER &&
    token.type !== Token.FREE_TEXT &&
    token.type !== Token.LOGIC_BOOLEAN
  ) {
    return false;
  }

  return Boolean(token.invalid);
}

export function queryIsValid(parsedQuery: ParseResult | null) {
  if (!parsedQuery) {
    return false;
  }

  return !parsedQuery.some(tokenIsInvalid);
}

export function isDateToken(token: TokenResult<Token.FILTER>) {
  return [FilterType.DATE, FilterType.RELATIVE_DATE, FilterType.SPECIFIC_DATE].includes(
    token.filter
  );
}

export function recentSearchTypeToLabel(type: SavedSearchType | undefined) {
  switch (type) {
    case SavedSearchType.ISSUE:
      return 'issues';
    case SavedSearchType.EVENT:
      return 'events';
    case SavedSearchType.METRIC:
      return 'metrics';
    case SavedSearchType.REPLAY:
      return 'replays';
    case SavedSearchType.SESSION:
      return 'sessions';
    case SavedSearchType.SPAN:
      return 'spans';
    default:
      return 'none';
  }
}

export function findNearestFreeTextKey(
  state: ListState<ParseResultToken>,
  startKey: Key | null,
  direction: 'right' | 'left'
): Key | null {
  let key: Key | null = startKey;
  while (key) {
    const item = state.collection.getItem(key);
    if (!item) {
      break;
    }
    if (item.value?.type === Token.FREE_TEXT) {
      return key;
    }
    key = (direction === 'right' ? item.nextKey : item.prevKey) ?? null;
  }

  if (key) {
    return key;
  }

  return direction === 'right'
    ? state.collection.getLastKey()
    : state.collection.getFirstKey();
}
