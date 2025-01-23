import {
  type AggregateFilter,
  allOperators,
  FilterType,
  filterTypeConfig,
  interchangeableFilterOperators,
  type TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {
  type FieldDefinition,
  FieldValueType,
  getFieldDefinition,
} from 'sentry/utils/fields';

const SHOULD_ESCAPE_REGEX = /[\s"(),]/;

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
  filterToken: TokenResult<Token.FILTER>
): readonly TermOperator[] {
  const fieldDefinition = getFieldDefinition(filterToken.key.text);

  if (fieldDefinition?.allowComparisonOperators) {
    return allOperators;
  }

  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
