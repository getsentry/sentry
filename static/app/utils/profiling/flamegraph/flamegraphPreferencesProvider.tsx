import {createContext, useReducer} from 'react';

export interface FlamegraphPreferences {
  colorCoding:
    | 'by symbol name'
    | 'by system / application'
    | 'by library'
    | 'by recursion';
  sorting: 'left heavy' | 'call order';
  view: 'top down' | 'bottom up';
}

export type FlamegraphPreferencesAction =
  | {type: 'set color coding'; value: FlamegraphPreferences['colorCoding']}
  | {type: 'set sorting'; value: FlamegraphPreferences['sorting']}
  | {type: 'set view'; value: FlamegraphPreferences['view']};

export function flamegraphPreferencesReducer(
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

type FlamegraphPreferencesContextValue = [
  FlamegraphPreferences,
  React.Dispatch<FlamegraphPreferencesAction>
];

export const FlamegraphPreferencesContext =
  createContext<FlamegraphPreferencesContextValue | null>(null);

interface FlamegraphPreferencesProviderProps {
  children: React.ReactNode;
}

export function FlamegraphPreferencesProvider(
  props: FlamegraphPreferencesProviderProps
): React.ReactElement {
  const reducer = useReducer(flamegraphPreferencesReducer, {
    colorCoding: 'by symbol name',
    sorting: 'call order',
    view: 'top down',
  });

  return (
    <FlamegraphPreferencesContext.Provider value={reducer}>
      {props.children}
    </FlamegraphPreferencesContext.Provider>
  );
}
