import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {
  ArithmeticBuilderAction,
  FocusOverride,
} from 'sentry/components/arithmeticBuilder/action';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import type {FieldDefinition} from 'sentry/utils/fields';

interface ArithmeticBuilderContextData {
  aggregations: string[];
  dispatch: Dispatch<ArithmeticBuilderAction>;
  focusOverride: FocusOverride | null;
  functionArguments: FunctionArgument[];
  getFieldDefinition: (
    key: string,
    attributeTexts?: readonly string[]
  ) => FieldDefinition | null;
  /**
   * When true, `_if` combinators use the EAP filter-first editor. Mirrors
   * `explore-conditional-aggregates`.
   */
  hasConditionalAggregates: boolean;
  /**
   * Fetches tag values for `_if` combinator filter arguments (e.g. after `span.op:`).
   */
  getFilterTagValues?: GetTagValues;
  getSuggestedKey?: (key: string) => string | null;
  references?: Set<string>;
}

export const ArithmeticBuilderContext = createContext<ArithmeticBuilderContextData>({
  dispatch: () => {},
  focusOverride: null,
  aggregations: [],
  functionArguments: [],
  getFieldDefinition: () => null,
  hasConditionalAggregates: false,
});

export function useArithmeticBuilder() {
  return useContext(ArithmeticBuilderContext);
}
