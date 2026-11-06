import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import type {FieldDefinition} from 'sentry/utils/fields';

import type {ArithmeticBuilderAction, FocusOverride} from './action';
import type {FunctionArgument} from './types';

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
});

export function useArithmeticBuilder() {
  return useContext(ArithmeticBuilderContext);
}
