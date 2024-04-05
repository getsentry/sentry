import {traceReducerExhaustiveActionCheck} from 'sentry/views/performance/newTraceDetails/traceState';

type TraceLayoutPreferences = 'drawer left' | 'drawer bottom' | 'drawer right';

type TracePreferencesAction =
  | {payload: TraceLayoutPreferences; type: 'set layout'}
  | {
      payload: number;
      type: 'store drawer dimension';
    }
  | {payload: boolean; type: 'minimize drawer'};

type TraceDrawerPreferences = {
  minimized: boolean;
  sizes: {
    [key in TraceLayoutPreferences]?: number;
  };
};

type TracePreferencesState = {
  drawer: TraceDrawerPreferences;
  layout: TraceLayoutPreferences;
  list: {
    width: number;
  };
};

export function tracePreferencesReducer(
  state: TracePreferencesState,
  action: TracePreferencesAction
): TracePreferencesState {
  switch (action.type) {
    case 'minimize drawer':
      return {...state, drawer: {...state.drawer, minimized: action.payload}};
    case 'set layout':
      return {...state, layout: action.payload};
    case 'store drawer dimension':
      return {
        ...state,
        drawer: {...state.drawer, [state.layout]: action.payload},
      };
    default:
      traceReducerExhaustiveActionCheck(action);
      return state;
  }
}
