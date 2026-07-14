import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {
  BooleanOperator,
  FilterType,
  InvalidReason,
  parseSearch,
  Token,
  type ParseResult,
  type ParseResultToken,
  type SearchConfig,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

function getFilterKeysFromQuery(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const keys = new Set<string>();
  const filterKeyPattern = /(?:^|[\s(])!?([^\s():]+):/g;

  for (const match of value.matchAll(filterKeyPattern)) {
    if (match[1]) {
      keys.add(match[1]);
    }
  }

  return Array.from(keys);
}

export function getFieldDefinitionForFilterKey(
  key: string,
  getFieldDefinition: FieldDefinitionGetter,
  filterKeys?: TagCollection
): FieldDefinition | null {
  const fieldDef = getFieldDefinition(key);
  if (fieldDef) {
    return fieldDef;
  }

  switch (filterKeys?.[key]?.kind) {
    case FieldKind.MEASUREMENT:
    case FieldKind.NUMERIC_METRICS:
      return {kind: FieldKind.FIELD, valueType: FieldValueType.NUMBER};
    case FieldKind.BOOLEAN:
      return {kind: FieldKind.FIELD, valueType: FieldValueType.BOOLEAN};
    case FieldKind.TAG:
      return {kind: FieldKind.FIELD, valueType: FieldValueType.STRING};
    default:
      return null;
  }
}

function addKeyToSearchConfig(
  config: Partial<SearchConfig>,
  key: string,
  getFieldDefinition: FieldDefinitionGetter,
  filterKeys: TagCollection
) {
  const fieldDef = getFieldDefinitionForFilterKey(key, getFieldDefinition, filterKeys);
  if (!fieldDef) {
    return;
  }

  if (fieldDef.allowComparisonOperators) {
    config.textOperatorKeys!.add(key);
  }

  switch (fieldDef.valueType) {
    case FieldValueType.BOOLEAN:
      config.booleanKeys!.add(key);
      break;
    case FieldValueType.NUMBER:
    case FieldValueType.INTEGER:
    case FieldValueType.PERCENTAGE:
    case FieldValueType.CURRENCY:
      config.numericKeys!.add(key);
      break;
    case FieldValueType.DATE:
      config.dateKeys!.add(key);
      break;
    case FieldValueType.DURATION:
      config.durationKeys!.add(key);
      break;
    case FieldValueType.SIZE:
      config.sizeKeys!.add(key);
      break;
    default:
      break;
  }
}

function getSearchConfigFromKeys({
  keys,
  getFieldDefinition,
  queryKeys = [],
}: {
  getFieldDefinition: FieldDefinitionGetter;
  keys: TagCollection;
  queryKeys?: string[];
}): Partial<SearchConfig> {
  const config = {
    textOperatorKeys: new Set<string>(),
    booleanKeys: new Set<string>(),
    numericKeys: new Set<string>(),
    dateKeys: new Set<string>(),
    durationKeys: new Set<string>(),
    percentageKeys: new Set<string>(),
    sizeKeys: new Set<string>(),
  } satisfies Partial<SearchConfig>;

  for (const key of Object.keys(keys)) {
    addKeyToSearchConfig(config, key, getFieldDefinition, keys);
  }

  for (const key of queryKeys) {
    addKeyToSearchConfig(config, key, getFieldDefinition, keys);
  }

  return config;
}

function markInvalidFilterKeys(
  tokens: ParseResult | null,
  invalidFilterKeys: string[] | undefined
): ParseResult | null {
  if (!tokens || !invalidFilterKeys?.length) {
    return tokens;
  }

  const invalidFilterKeySet = new Set(invalidFilterKeys);

  return tokens.map(token => {
    if (token.type !== Token.FILTER) {
      return token;
    }

    const keyName = getKeyName(token.key, {aggregateWithArgs: true});
    if (!invalidFilterKeySet.has(keyName) || token.invalid) {
      return token;
    }

    return {
      ...token,
      invalid: {
        type: InvalidReason.INVALID_KEY,
        reason: t('Invalid key. "%s" is not a supported search key.', token.key.text),
      },
    };
  });
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
    filterKeyAliases?: TagCollection;
    getFilterTokenWarning?: (key: string) => React.ReactNode;
    invalidFilterKeys?: string[];
    invalidMessages?: SearchConfig['invalidMessages'];
  }
): ParseResult | null {
  return markInvalidFilterKeys(
    collapseTextTokens(
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
        ...getSearchConfigFromKeys({
          keys: options?.filterKeys ?? {},
          getFieldDefinition,
          queryKeys: options?.disallowUnsupportedFilters
            ? []
            : getFilterKeysFromQuery(value),
        }),
        invalidMessages: options?.invalidMessages,
        supportedTags: {
          ...(options?.filterKeys ? options.filterKeys : {}),
          ...(options?.filterKeyAliases ? options.filterKeyAliases : {}),
        },
      })
    ),
    options?.invalidFilterKeys
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

export function parseTokenKey(key: string) {
  const [tokenType, indexStr] = key.split(':');
  const index = parseInt(indexStr!, 10);
  return {tokenType, index};
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
export function collapseTextTokens(tokens: ParseResult | null) {
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

    const lastToken = acc[acc.length - 1]!;

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

    acc.push(token);
    return acc;
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

export function isNumericFilterToken(token: TokenResult<Token.FILTER>): boolean {
  return [
    FilterType.NUMERIC,
    FilterType.DURATION,
    FilterType.SIZE,
    FilterType.AGGREGATE_NUMERIC,
    FilterType.AGGREGATE_PERCENTAGE,
    FilterType.AGGREGATE_DURATION,
    FilterType.AGGREGATE_SIZE,
  ].includes(token.filter);
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
    case SavedSearchType.LOG:
      return 'logs';
    default:
      return 'none';
  }
}

export function findNearestFreeTextKey(
  state: ListState<ParseResultToken>,
  startKey: Key | null,
  direction: 'right' | 'left'
): Key | null {
  let key = startKey;
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
