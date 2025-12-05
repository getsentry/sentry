import {
  comparisonOperators,
  FilterType,
  filterTypeConfig,
  interchangeableFilterOperators,
  isInterchangeableFilterOperator,
  TermOperator,
  Token,
  wildcardOperators,
  type AggregateFilter,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

const SHOULD_ESCAPE_REGEX = /[\s"(),]/;

export const OP_LABELS = {
  [TermOperator.DEFAULT]: 'is',
  [TermOperator.GREATER_THAN]: '>',
  [TermOperator.GREATER_THAN_EQUAL]: '>=',
  [TermOperator.LESS_THAN]: '<',
  [TermOperator.LESS_THAN_EQUAL]: '<=',
  [TermOperator.EQUAL]: 'is',
  [TermOperator.NOT_EQUAL]: 'is not',
  [TermOperator.CONTAINS]: 'contains',
  [TermOperator.DOES_NOT_CONTAIN]: 'does not contain',
  [TermOperator.STARTS_WITH]: 'starts with',
  [TermOperator.DOES_NOT_START_WITH]: 'does not start with',
  [TermOperator.ENDS_WITH]: 'ends with',
  [TermOperator.DOES_NOT_END_WITH]: 'does not end with',
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

export function getValidOpsForFilter({
  filterToken,
  fieldDefinition,
}: {
  fieldDefinition: FieldDefinition | null;
  filterToken: TokenResult<Token.FILTER>;
}): readonly TermOperator[] {
  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.flatMap(type =>
    isInterchangeableFilterOperator(type) ? interchangeableFilterOperators[type] : []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    allValidTypes.flatMap(type => filterTypeConfig[type].validOps)
  );

  // Conditionally add comparison operators if they're not already present:
  // - Field definition allows comparison operators
  if (fieldDefinition?.allowComparisonOperators) {
    comparisonOperators.forEach(op => validOps.add(op));
  }

  // Conditionally remove wildcard operators if:
  // - Feature flag is not enabled
  // - Field definition does not allow wildcard operators
  // - Field definition is a string field
  if (
    !areWildcardOperatorsAllowed(fieldDefinition) ||
    fieldDefinition?.valueType !== FieldValueType.STRING
  ) {
    wildcardOperators.forEach(op => validOps.delete(op));
  }

  return [...validOps];
}

interface EscapeTagValueOptions {
  allowArrayValue?: boolean;
}

export function escapeTagValue(
  value: string,
  options: EscapeTagValueOptions = {}
): string {
  if (!value) {
    return '';
  }

  const {allowArrayValue = true} = options;

  // Wrap in quotes if there is a space or parens
  const shouldEscape =
    SHOULD_ESCAPE_REGEX.test(value) ||
    (allowArrayValue && value.startsWith('[') && value.endsWith(']'));
  return shouldEscape ? `"${escapeDoubleQuotes(value)}"` : value;
}

export function unescapeTagValue(value: string): string {
  return value.replace(/\\"/g, '"');
}

export function formatFilterValue({
  token,
}: {
  token: TokenResult<Token.FILTER>['value'];
}): string {
  switch (token.type) {
    case Token.VALUE_TEXT: {
      const content = token.value ? token.value : token.text;

      if (!token.value) {
        return content;
      }

      return token.quoted ? unescapeTagValue(content) : content;
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

export function getLabelAndOperatorFromToken(token: TokenResult<Token.FILTER>) {
  let operator = token.operator;

  if (token.negated && token.operator === TermOperator.CONTAINS) {
    operator = TermOperator.DOES_NOT_CONTAIN;
  } else if (token.negated && token.operator === TermOperator.STARTS_WITH) {
    operator = TermOperator.DOES_NOT_START_WITH;
  } else if (token.negated && token.operator === TermOperator.ENDS_WITH) {
    operator = TermOperator.DOES_NOT_END_WITH;
  } else if (token.operator === TermOperator.ENDS_WITH) {
    operator = TermOperator.ENDS_WITH;
  } else if (token.negated) {
    operator = TermOperator.NOT_EQUAL;
  }

  const label = OP_LABELS[operator] ?? operator;

  return {
    label,
    operator,
  };
}

/**
 * Determines if wildcard operators should be allowed for a field.
 *
 * The logic is:
 * - If `disallowWildcardOperators` is explicitly true, wildcard operators are not allowed
 * - If `disallowWildcardOperators` is explicitly false or undefined, check `allowWildcard` (defaults to true)
 */
export function areWildcardOperatorsAllowed(
  fieldDefinition: FieldDefinition | null
): boolean {
  if (!fieldDefinition) {
    return false;
  }

  if (fieldDefinition.disallowWildcardOperators === true) {
    return false;
  }

  if (fieldDefinition.valueType === FieldValueType.STRING) {
    return fieldDefinition.allowWildcard ?? true;
  }

  return false;
}
