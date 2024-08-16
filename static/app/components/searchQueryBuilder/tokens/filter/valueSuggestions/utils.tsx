import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/date/parser';
import {parseFilterValueDuration} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/duration/parser';
import {parseFilterValuePercentage} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/percentage/parser';
import {escapeTagValue} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {DEFAULT_BOOLEAN_SUGGESTIONS} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/boolean';
import {getRelativeDateSuggestions} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/date';
import {getDurationSuggestions} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/duration';
import {getNumericSuggestions} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/numeric';
import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {FieldValueType} from 'sentry/utils/fields';

const FILTER_VALUE_NUMERIC = /^-?\d+(\.\d+)?[kmb]?$/i;
const FILTER_VALUE_INT = /^-?\d+[kmb]?$/i;

export function getValueSuggestions({
  filterValue,
  token,
  valueType,
}: {
  filterValue: string;
  token: TokenResult<Token.FILTER>;
  valueType: FieldValueType;
}): SuggestionSection[] | null {
  switch (valueType) {
    case FieldValueType.NUMBER:
    case FieldValueType.INTEGER:
      return getNumericSuggestions(filterValue);
    case FieldValueType.DURATION:
      return getDurationSuggestions(filterValue, token);
    case FieldValueType.PERCENTAGE:
      return [];
    case FieldValueType.BOOLEAN:
      return DEFAULT_BOOLEAN_SUGGESTIONS;
    case FieldValueType.DATE:
      return getRelativeDateSuggestions(filterValue, token);
    default:
      return null;
  }
}

/**
 * Given a value and a valueType, validates and cleans the value.
 * If the value is invalid and cannot be recovered, it will return null.
 */
export function cleanFilterValue(
  valueType: FieldValueType | null | undefined,
  value: string
): string | null {
  if (!valueType) {
    return escapeTagValue(value);
  }

  switch (valueType) {
    case FieldValueType.NUMBER:
      if (FILTER_VALUE_NUMERIC.test(value)) {
        return value;
      }
      return null;
    case FieldValueType.INTEGER:
      if (FILTER_VALUE_INT.test(value)) {
        return value;
      }
      return null;
    case FieldValueType.DURATION: {
      const parsed = parseFilterValueDuration(value);
      if (!parsed) {
        return null;
      }
      // Default to ms if no unit is provided
      if (!parsed.unit) {
        return `${parsed.value}ms`;
      }
      return value;
    }
    case FieldValueType.PERCENTAGE: {
      const parsed = parseFilterValuePercentage(value);
      if (!parsed) {
        return null;
      }
      // If the user passes "50%", convert to 0.5
      if (parsed.unit) {
        const numericValue = parseFloat(parsed.value);
        return isNaN(numericValue) ? parsed.value : (numericValue / 100).toString();
      }
      return parsed.value;
    }
    case FieldValueType.DATE:
      const parsed = parseFilterValueDate(value);

      if (!parsed) {
        return null;
      }
      return value;
    default:
      return escapeTagValue(value).trim();
  }
}
