import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {
  ArithmeticBuilderAction,
  FocusOverride,
} from 'sentry/components/arithmeticBuilder/action';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {FieldDefinition} from 'sentry/utils/fields';

interface ArithmeticBuilderContextData {
  aggregations: string[];
  dispatch: Dispatch<ArithmeticBuilderAction>;
  focusOverride: FocusOverride | null;
  functionArguments: FunctionArgument[];
  getFieldDefinition: (key: string) => FieldDefinition | null;
  getSuggestedKey?: (key: string) => string | null;
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
