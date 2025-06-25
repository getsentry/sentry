import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {
  ArithmeticBuilderAction,
  CountDownFocusOverride,
} from 'sentry/components/arithmeticBuilder/action';
import type {
  AggregateFunction,
  FunctionArgument,
} from 'sentry/components/arithmeticBuilder/types';

interface ArithmeticBuilderContextData {
  aggregateFunctions: AggregateFunction[];
  dispatch: Dispatch<ArithmeticBuilderAction>;
  focusOverride: CountDownFocusOverride | null;
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
