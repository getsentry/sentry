import {
  isSearchFilterParameter,
  unwrapSearchFilterArgument,
} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilter';
import {
  comparisonOperators,
  FilterType,
  filterTypeConfig,
  interchangeableFilterOperators,
  isInterchangeableFilterOperator,
  regexOperators,
  TermOperator,
  Token,
  wildcardOperators,
  type AggregateFilter,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {
  FieldValueType,
  type AggregateParameter,
  type FieldDefinition,
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
  [TermOperator.CONTAINS]: 'contains',
  [TermOperator.DOES_NOT_CONTAIN]: 'does not contain',
  [TermOperator.STARTS_WITH]: 'starts with',
  [TermOperator.DOES_NOT_START_WITH]: 'does not start with',
  [TermOperator.ENDS_WITH]: 'ends with',
  [TermOperator.DOES_NOT_END_WITH]: 'does not end with',
  [TermOperator.MATCHES]: 'matches regex',
  [TermOperator.DOES_NOT_MATCH]: 'does not match regex',
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
  allowRegexOperators,
}: {
  fieldDefinition: FieldDefinition | null;
  filterToken: TokenResult<Token.FILTER>;
  allowRegexOperators?: boolean;
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

  // Conditionally remove wildcard operators unless the effective field value
  // type is string and the field definition has not opted out.
  const patternOperatorsAllowed = areWildcardOperatorsAllowed(
    fieldDefinition,
    getFilterValueType(filterToken, fieldDefinition)
  );

  if (!patternOperatorsAllowed) {
    wildcardOperators.forEach(op => validOps.delete(op));
  }

  if (!patternOperatorsAllowed || !allowRegexOperators) {
    regexOperators.forEach(op => validOps.delete(op));
  }

  fieldDefinition?.disallowedOperators?.forEach(op => validOps.delete(op));

  if (fieldDefinition?.comparisonOperatorsFirst) {
    const ops = [...validOps];
    const isComparison = (op: TermOperator) =>
      (comparisonOperators as readonly TermOperator[]).includes(op);
    const isBasic = (op: TermOperator) =>
      op === TermOperator.DEFAULT || op === TermOperator.NOT_EQUAL;
    return [
      ...ops.filter(isBasic),
      ...ops.filter(isComparison),
      ...ops.filter(op => !isBasic(op) && !isComparison(op)),
    ];
  }

  return [...validOps];
}

function shouldEscapeTagValue(
  value: string,
  options: EscapeTagValueOptions = {}
): boolean {
  const {allowArrayValue = true} = options;
  return (
    SHOULD_ESCAPE_REGEX.test(value) ||
    value.startsWith('//') ||
    (allowArrayValue && value.startsWith('[') && value.endsWith(']'))
  );
}

interface EscapeTagValueOptions {
  allowArrayValue?: boolean;
}

export function escapeTagValue(value: string): string {
  if (!value) {
    return '';
  }

  // Wrap in quotes if there is a space or parens
  const shouldEscape = shouldEscapeTagValue(value);
  return shouldEscape ? `"${escapeDoubleQuotes(value)}"` : value;
}

export function escapeTagValueForSearch(
  value: string,
  options: EscapeTagValueOptions = {}
): string {
  if (!value) {
    return '';
  }

  let escapedValue = '';
  let consecutiveBackslashes = 0;

  for (const char of value) {
    if (char === '\\') {
      consecutiveBackslashes += 1;
      escapedValue += char;
      continue;
    }

    if (char === '*' && consecutiveBackslashes % 2 === 0) {
      escapedValue += '\\';
    }

    escapedValue += char;
    consecutiveBackslashes = 0;
  }

  const shouldEscape = shouldEscapeTagValue(escapedValue, options);

  return shouldEscape ? `"${escapeDoubleQuotes(escapedValue)}"` : escapedValue;
}

export function unescapeTagValue(value: string): string {
  return value.replace(/\\"/g, '"');
}

// This only inverts the query builder's wildcard escaping for search values that
// the search syntax can actually represent. In search syntax, `\*` already means
// a literal `*`, so odd backslash counts before `*` are not distinct raw values.
export function unescapeAsteriskSearchValue(value: string): string {
  let unescapedValue = '';

  for (let index = 0; index < value.length; index++) {
    const char = value[index];

    if (char === '\\' && value[index + 1] === '*') {
      unescapedValue += '*';
      index += 1;
      continue;
    }

    unescapedValue += char;
  }

  return unescapedValue;
}

export function formatFilterValue({
  token,
  valueType,
}: {
  token: TokenResult<Token.FILTER>['value'];
  valueType?: FieldValueType;
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
      if (valueType === FieldValueType.CURRENCY && token.text) {
        return `$${token.text}`;
      }
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
    const args = token.key.args?.args.map(
      arg => arg.value?.value ?? arg.value?.text ?? null
    );

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
  } else if (token.negated && token.operator === TermOperator.MATCHES) {
    operator = TermOperator.DOES_NOT_MATCH;
  } else if (token.operator === TermOperator.ENDS_WITH) {
    operator = TermOperator.ENDS_WITH;
  } else if (token.negated) {
    operator = TermOperator.NOT_EQUAL;
  }

  const label = OP_LABELS[operator] ?? operator;

  return {label, operator};
}

/**
 * Determines if wildcard operators should be allowed for a field.
 *
 * The logic is:
 * - If `disallowWildcardOperators` is explicitly true, wildcard operators are not allowed
 * - If the effective value type is string, check `allowWildcard` (defaults to true)
 */
export function areWildcardOperatorsAllowed(
  fieldDefinition: FieldDefinition | null,
  valueType: FieldValueType | null = fieldDefinition?.valueType ?? null
): boolean {
  if (fieldDefinition?.disallowWildcardOperators === true) {
    return false;
  }

  if (valueType === FieldValueType.STRING) {
    return fieldDefinition?.allowWildcard ?? true;
  }

  return false;
}

/**
 * Raw text of each argument of an aggregate filter key, such as
 * ['`span.op:db`', 'span.duration'] for count_if(`span.op:db`,span.duration).
 */
export function getAggregateArgTexts(token: AggregateFilter): string[] {
  return token.key.args?.args.map(arg => arg.value?.text ?? '') ?? [];
}

/**
 * Split aggregate parameter text on commas. Commas inside explicit tags
 * (`tags[foo,number]`), quoted values, and backtick-delimited `_if` filters
 * (`` `span.op:[db,http]` ``) do not split.
 */
export function splitAggregateParameters(text: string): string[] {
  const parameters: string[] = [];
  let closingDelimiter: string | null = null;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (closingDelimiter) {
      if (c === '\\' && closingDelimiter === '"') {
        i++;
      } else if (c === closingDelimiter) {
        closingDelimiter = null;
      }
      continue;
    }

    if (c === '[') {
      closingDelimiter = ']';
    } else if (c === '"' || c === '`') {
      closingDelimiter = c;
    } else if (c === ',') {
      parameters.push(text.slice(start, i));
      start = i + 1;
    }
  }

  parameters.push(text.slice(start));

  return parameters;
}

/**
 * Whether an aggregate takes an `_if` search filter argument, such as
 * count_if(`span.op:db`,span.duration).
 */
export function hasSearchFilterParameter(definition: FieldDefinition | null): boolean {
  return Boolean(definition?.parameters?.some(isSearchFilterParameter));
}

/**
 * Label for an argument, as the equation builder shows it: the filter without its
 * backticks, and the column's default label (`spans` for `span.duration`).
 */
export function getConditionalAggregateArgumentLabel(
  parameter: AggregateParameter | undefined,
  value: string
): string {
  if (isSearchFilterParameter(parameter)) {
    return unwrapSearchFilterArgument(value);
  }
  if (
    parameter?.kind === 'column' &&
    parameter.defaultLabel &&
    value === parameter.defaultValue
  ) {
    return parameter.defaultLabel;
  }
  return value;
}
