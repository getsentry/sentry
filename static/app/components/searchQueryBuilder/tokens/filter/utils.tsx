import {
  type SearchQueryBuilderOperators,
  WildcardOperators,
} from 'sentry/components/searchQueryBuilder/types';
import {
  type AggregateFilter,
  allOperators,
  FilterType,
  filterTypeConfig,
  interchangeableFilterOperators,
  TermOperator,
  Token,
  type TokenResult,
  WildcardPositions,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {
  type FieldDefinition,
  FieldValueType,
  getFieldDefinition,
} from 'sentry/utils/fields';

const SHOULD_ESCAPE_REGEX = /[\s"(),]/;

export const OP_LABELS = {
  [TermOperator.DEFAULT]: 'is',
  [TermOperator.GREATER_THAN]: '>',
  [TermOperator.GREATER_THAN_EQUAL]: '>=',
  [TermOperator.LESS_THAN]: '<',
  [TermOperator.LESS_THAN_EQUAL]: '<=',
  [TermOperator.EQUAL]: 'is',
  [TermOperator.NOT_EQUAL]: 'is not',
  [WildcardOperators.CONTAINS]: 'contains',
  [WildcardOperators.DOES_NOT_CONTAIN]: 'does not contain',
  [WildcardOperators.STARTS_WITH]: 'starts with',
  [WildcardOperators.ENDS_WITH]: 'ends with',
};

export const DATE_OP_LABELS = {
  [TermOperator.GREATER_THAN]: 'is after',
  [TermOperator.GREATER_THAN_EQUAL]: 'is on or after',
  [TermOperator.LESS_THAN]: 'is before',
  [TermOperator.LESS_THAN_EQUAL]: 'is on or before',
  [TermOperator.EQUAL]: 'is',
  [TermOperator.DEFAULT]: 'is',
};

export const DATE_OPTIONS = [
  TermOperator.GREATER_THAN,
  TermOperator.GREATER_THAN_EQUAL,
  TermOperator.LESS_THAN,
  TermOperator.LESS_THAN_EQUAL,
  TermOperator.EQUAL,
] as const;

export function isAggregateFilterToken(
  token: TokenResult<Token.FILTER>
): token is AggregateFilter {
  switch (token.filter) {
    case FilterType.AGGREGATE_DATE:
    case FilterType.AGGREGATE_DURATION:
    case FilterType.AGGREGATE_NUMERIC:
    case FilterType.AGGREGATE_PERCENTAGE:
    case FilterType.AGGREGATE_RELATIVE_DATE:
    case FilterType.AGGREGATE_SIZE:
      return true;
    default:
      return false;
  }
}

export function getValidOpsForFilter(
  filterToken: TokenResult<Token.FILTER>,
  hasWildcardOperators: boolean
): readonly SearchQueryBuilderOperators[] {
  const fieldDefinition = getFieldDefinition(filterToken.key.text);

  if (fieldDefinition?.allowComparisonOperators) {
    const validOps = new Set<SearchQueryBuilderOperators>(allOperators);

    return [...validOps];
  }

  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<SearchQueryBuilderOperators>(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    allValidTypes.flatMap(type => filterTypeConfig[type].validOps)
  );

  // Special case for text, add contains operator
  if (
    hasWildcardOperators &&
    fieldDefinition?.allowWildcard !== false &&
    (filterToken.filter === FilterType.TEXT || filterToken.filter === FilterType.TEXT_IN)
  ) {
    validOps.add(WildcardOperators.CONTAINS);
    validOps.add(WildcardOperators.DOES_NOT_CONTAIN);
    validOps.add(WildcardOperators.STARTS_WITH);
    validOps.add(WildcardOperators.ENDS_WITH);
  }

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

export function formatFilterValue({
  token,
  stripWildcards = false,
}: {
  token: TokenResult<Token.FILTER>['value'];
  stripWildcards?: boolean;
}): string {
  switch (token.type) {
    case Token.VALUE_TEXT: {
      const content = token.value ? token.value : token.text;
      const cleanedContent = stripWildcards ? content.replace(/^\*+|\*+$/g, '') : content;

      if (!token.value) {
        return cleanedContent;
      }

      return token.quoted ? unescapeTagValue(cleanedContent) : cleanedContent;
    }
    case Token.VALUE_RELATIVE_DATE:
      return t('%s', `${token.value}${token.unit} ago`);
    default:
      return token.text;
  }
}

/**
 * Gets the value type for a given token.
 *
 * For most tokens, this is the value type of the field definition.
 * For aggregate tokens, this can be dependent on the function parameters.
 */
export function getFilterValueType(
  token: TokenResult<Token.FILTER>,
  fieldDefinition: FieldDefinition | null
): FieldValueType {
  if (isAggregateFilterToken(token)) {
    const args = token.key.args?.args.map(arg => arg.value?.value ?? null);

    if (fieldDefinition?.parameterDependentValueType && args) {
      return fieldDefinition.parameterDependentValueType(args);
    }
  }

  return fieldDefinition?.valueType ?? FieldValueType.STRING;
}

export function getArgsToken(token: AggregateFilter) {
  // Args are null if none are provided. If that is the case, we can use the space
  // within the parens for determining where replacements should be made.
  if (!token.key.args) {
    return token.key.argsSpaceBefore;
  }

  return token.key.args;
}

export function convertTokenTypeToValueType(tokenType: Token): FieldValueType {
  switch (tokenType) {
    case Token.VALUE_BOOLEAN:
      return FieldValueType.BOOLEAN;
    case Token.VALUE_ISO_8601_DATE:
    case Token.VALUE_RELATIVE_DATE:
      return FieldValueType.DATE;
    case Token.VALUE_DURATION:
      return FieldValueType.DURATION;
    case Token.VALUE_NUMBER:
    case Token.VALUE_NUMBER_LIST:
      return FieldValueType.NUMBER;
    case Token.VALUE_PERCENTAGE:
      return FieldValueType.PERCENTAGE;
    case Token.VALUE_TEXT:
    case Token.VALUE_TEXT_LIST:
    default:
      return FieldValueType.STRING;
  }
}

type TokenValue = string | boolean | undefined;

function getIsContains(tokenValue: TokenValue) {
  return tokenValue === WildcardPositions.SURROUNDED;
}

function getIsStartsWith(tokenValue: TokenValue) {
  return tokenValue === WildcardPositions.TRAILING;
}

function getIsEndsWith(tokenValue: TokenValue) {
  return tokenValue === WildcardPositions.LEADING;
}

export function getLabelAndOperatorFromToken(
  token: TokenResult<Token.FILTER>,
  hasWildcardOperators: boolean
) {
  if (token.value.type === Token.VALUE_TEXT && hasWildcardOperators) {
    if (getIsContains(token.value.wildcard)) {
      return {
        label: token.negated ? t('does not contain') : t('contains'),
        operator: token.negated
          ? WildcardOperators.DOES_NOT_CONTAIN
          : WildcardOperators.CONTAINS,
      };
    }

    if (getIsStartsWith(token.value.wildcard)) {
      return {
        label: t('starts with'),
        operator: WildcardOperators.STARTS_WITH,
      };
    }

    if (getIsEndsWith(token.value.wildcard)) {
      return {
        label: t('ends with'),
        operator: WildcardOperators.ENDS_WITH,
      };
    }
  } else if (token.value.type === Token.VALUE_TEXT_LIST && hasWildcardOperators) {
    if (token.value.items.every(entry => getIsContains(entry.value?.wildcard))) {
      return {
        label: token.negated ? t('does not contain') : t('contains'),
        operator: token.negated
          ? WildcardOperators.DOES_NOT_CONTAIN
          : WildcardOperators.CONTAINS,
      };
    }

    if (token.value.items.every(entry => getIsStartsWith(entry.value?.wildcard))) {
      return {
        label: t('starts with'),
        operator: WildcardOperators.STARTS_WITH,
      };
    }

    if (token.value.items.every(entry => getIsEndsWith(entry.value?.wildcard))) {
      return {
        label: t('ends with'),
        operator: WildcardOperators.ENDS_WITH,
      };
    }
  }

  const operator = token.negated ? TermOperator.NOT_EQUAL : token.operator;
  const label = OP_LABELS[operator] ?? operator;

  return {
    label,
    operator,
  };
}
