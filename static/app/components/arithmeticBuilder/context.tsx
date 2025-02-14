import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {
  ArithmeticBuilderAction,
  FocusOverride,
} from 'sentry/components/arithmeticBuilder/action';

interface ArithmeticBuilderContextData {
  dispatch: Dispatch<ArithmeticBuilderAction>;
  focusOverride: FocusOverride | null;
}

export const ArithmeticBuilderContext = createContext<ArithmeticBuilderContextData>({
  dispatch: () => {},
  focusOverride: null,
});

export function useArithmeticBuilder() {
  return useContext(ArithmeticBuilderContext);
}
