import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {
  ArithmeticBuilderAction,
  FocusOverride,
} from 'sentry/components/arithmeticBuilder/action';
import type {
  AggregateFunction,
  FunctionArgument,
} from 'sentry/components/arithmeticBuilder/types';

interface ArithmeticBuilderContextData {
  aggregateFunctions: AggregateFunction[];
  dispatch: Dispatch<ArithmeticBuilderAction>;
  focusOverride: FocusOverride | null;
  functionArguments: FunctionArgument[];
}

export const ArithmeticBuilderContext = createContext<ArithmeticBuilderContextData>({
  dispatch: () => {},
  focusOverride: null,
  aggregateFunctions: [],
  functionArguments: [],
});

export function useArithmeticBuilder() {
  return useContext(ArithmeticBuilderContext);
}
