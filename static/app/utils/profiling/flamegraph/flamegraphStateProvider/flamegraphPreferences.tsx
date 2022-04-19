export interface FlamegraphPreferences {
  colorCoding:
    | 'by symbol name'
    | 'by system / application'
    | 'by library'
    | 'by recursion';
  sorting: 'left heavy' | 'call order';
  synchronizeXAxisWithTransaction: boolean;
  view: 'top down' | 'bottom up';
}

type FlamegraphPreferencesAction =
  | {payload: FlamegraphPreferences['colorCoding']; type: 'set color coding'}
  | {payload: FlamegraphPreferences['sorting']; type: 'set sorting'}
  | {payload: FlamegraphPreferences['view']; type: 'set view'}
  | {
      payload: FlamegraphPreferences['synchronizeXAxisWithTransaction'];
      type: 'set synchronizeXAxisWithTransaction';
    };

export function flamegraphPreferencesReducer(
  state: FlamegraphPreferences,
  action: FlamegraphPreferencesAction
): FlamegraphPreferences {
  switch (action.type) {
    case 'set color coding': {
      return {
        ...state,
        colorCoding: action.payload,
      };
    }
    case 'set sorting': {
      return {
        ...state,
        sorting: action.payload,
      };
    }
    case 'set view': {
      return {
        ...state,
        view: action.payload,
      };
    }
    case 'set synchronizeXAxisWithTransaction': {
      return {...state, synchronizeXAxisWithTransaction: action.payload};
    }
    default: {
      return state;
    }
  }
}
