import {useCallback} from 'react';
import {getFocusableTreeWalker} from '@react-aria/focus';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {
  FilterType,
  filterTypeConfig,
  interchangeableFilterOperators,
  type ParseResult,
  type ParseResultToken,
  parseSearch,
  type SearchConfig,
  type TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types';
import {escapeDoubleQuotes} from 'sentry/utils';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';

export const INTERFACE_TYPE_LOCALSTORAGE_KEY = 'search-query-builder-interface';

const SHOULD_ESCAPE_REGEX = /[\s"()]/;

function getSearchConfigFromKeys(keys: TagCollection): Partial<SearchConfig> {
  const config = {
    booleanKeys: new Set<string>(),
    numericKeys: new Set<string>(),
    dateKeys: new Set<string>(),
    durationKeys: new Set<string>(),
  } satisfies Partial<SearchConfig>;

  for (const key in keys) {
    const fieldDef = getFieldDefinition(key);
    if (!fieldDef) {
      continue;
    }

    switch (fieldDef.valueType) {
      case FieldValueType.BOOLEAN:
        config.booleanKeys.add(key);
        break;
      case FieldValueType.NUMBER:
      case FieldValueType.INTEGER:
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
  options?: {filterKeys: TagCollection}
): ParseResult | null {
  return collapseTextTokens(
    parseSearch(value || ' ', {
      flattenParenGroups: true,
      ...getSearchConfigFromKeys(options?.filterKeys ?? {}),
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

export function getKeyLabel(key: Tag) {
  return key.alias ?? key.key;
}

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

    const lastToken = acc[acc.length - 1];

    if (isSimpleTextToken(token) && isSimpleTextToken(lastToken)) {
      lastToken.value += token.value;
      lastToken.text += token.text;
      lastToken.location.end = token.location.end;
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

export function getValidOpsForFilter(
  filterToken: TokenResult<Token.FILTER>
): readonly TermOperator[] {
  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    allValidTypes.flatMap(type => filterTypeConfig[type].validOps)
  );

  return [...validOps];
}

export function escapeTagValue(value: string): string {
  if (!value) {
    return '';
  }

  // Wrap in quotes if there is a space or parens
  return SHOULD_ESCAPE_REGEX.test(value) ? `"${escapeDoubleQuotes(value)}"` : value;
}

export function unescapeTagValue(value: string): string {
  return value.replace(/\\"/g, '"');
}

export function formatFilterValue(token: TokenResult<Token.FILTER>['value']): string {
  switch (token.type) {
    case Token.VALUE_TEXT: {
      if (!token.value) {
        return token.text;
      }

      return token.quoted ? unescapeTagValue(token.value) : token.text;
    }
    case Token.VALUE_RELATIVE_DATE:
      return t('%s', `${token.value}${token.unit} ago`);
    default:
      return token.text;
  }
}

export function shiftFocusToChild(
  element: HTMLElement,
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>
) {
  // Ensure that the state is updated correctly
  state.selectionManager.setFocusedKey(item.key);

  // When this row gains focus, immediately shift focus to the input
  const walker = getFocusableTreeWalker(element);
  const nextNode = walker.nextNode();
  if (nextNode) {
    (nextNode as HTMLElement).focus();
  }
}

export function useShiftFocusToChild(
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>
) {
  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement, Element>) => {
      shiftFocusToChild(e.currentTarget, item, state);
    },
    [item, state]
  );

  return {
    shiftFocusProps: {onFocus},
  };
}

export function isDateToken(token: TokenResult<Token.FILTER>) {
  return [FilterType.DATE, FilterType.RELATIVE_DATE, FilterType.SPECIFIC_DATE].includes(
    token.filter
  );
}
