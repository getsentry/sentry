import {useContext, useReducer} from 'react';

import {
  FlamegraphPreferences,
  FlamegraphPreferencesAction,
  FlamegraphPreferencesContext,
} from './FlamegraphPreferencesProvider';

function flamegraphPreferencesReducer(
  state: FlamegraphPreferences,
  action: FlamegraphPreferencesAction
): FlamegraphPreferences {
  switch (action.type) {
    case 'set color coding': {
      return {
        ...state,
        colorCoding: action.value,
      };
    }
    case 'set sorting': {
      return {
        ...state,
        sorting: action.value,
      };
    }
    case 'set view': {
      return {
        ...state,
        view: action.value,
      };
    }
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unhandled case: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

export function useFlamegraphPreferences(
  initialState: Partial<FlamegraphPreferences> = {}
): [FlamegraphPreferences, React.Dispatch<FlamegraphPreferencesAction>] {
  return useReducer(flamegraphPreferencesReducer, {
    colorCoding: 'by symbol name',
    sorting: 'call order',
    view: 'top down',
    ...initialState,
  });
}

export function useFlamegraphPreferencesValue(): FlamegraphPreferences {
  const context = useContext(FlamegraphPreferencesContext);

  if (context === null) {
    throw new Error(
      'useFlamegraphPreferences called outside of FlamegraphPreferencesProvider'
    );
  }

  return context[0];
}
