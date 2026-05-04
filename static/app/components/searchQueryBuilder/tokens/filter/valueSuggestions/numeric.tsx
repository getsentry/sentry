import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import {FieldValueType} from 'sentry/utils/fields';

const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;
const NUMERIC_UNITS = ['k', 'm', 'b'] as const;
const DEFAULT_NUMERIC_VALUES = ['100', '100k', '100m', '100b'] as const;
const DEFAULT_CURRENCY_VALUES = ['100'] as const;

function isNumeric(value: string) {
  return NUMERIC_REGEX.test(value);
}

function labelForValue(value: string, valueType?: FieldValueType) {
  return valueType === FieldValueType.CURRENCY ? `$${value}` : undefined;
}

export function getNumericSuggestions(
  inputValue: string,
  valueType?: FieldValueType
): SuggestionSection[] {
  if (!inputValue) {
    const defaultValues =
      valueType === FieldValueType.CURRENCY
        ? DEFAULT_CURRENCY_VALUES
        : DEFAULT_NUMERIC_VALUES;

    return [
      {
        sectionText: '',
        suggestions: defaultValues.map(value => ({
          value,
          label: labelForValue(value, valueType),
        })),
      },
    ];
  }

  if (valueType === FieldValueType.CURRENCY) {
    return [];
  }

  if (isNumeric(inputValue)) {
    return [
      {
        sectionText: '',
        suggestions: NUMERIC_UNITS.map(unit => {
          const value = `${inputValue}${unit}`;
          return {
            value,
            label: labelForValue(value, valueType),
          };
        }),
      },
    ];
  }

  // If the value is not numeric, don't show any suggestions
  return [];
}
