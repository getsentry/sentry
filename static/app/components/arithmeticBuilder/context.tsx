import type {Dispatch} from 'react';
import {createContext, useContext} from 'react';

import type {ArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';

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
