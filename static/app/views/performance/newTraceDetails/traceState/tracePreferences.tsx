import * as Sentry from '@sentry/react';

import {traceReducerExhaustiveActionCheck} from 'sentry/views/performance/newTraceDetails/traceState';

type TraceLayoutPreferences = 'drawer left' | 'drawer bottom' | 'drawer right';

type TracePreferencesAction =
  | {payload: TraceLayoutPreferences; type: 'set layout'}
  | {
      payload: number;
      type: 'set drawer dimension';
    }
  | {payload: number; type: 'set list width'}
  | {payload: boolean; type: 'minimize drawer'};

type TraceDrawerPreferences = {
  minimized: boolean;
  sizes: {
    [key in TraceLayoutPreferences]: number;
  };
};

type TracePreferencesState = {
  drawer: TraceDrawerPreferences;
  layout: TraceLayoutPreferences;
  list: {
    width: number;
  };
};

export const TRACE_DRAWER_DEFAULT_SIZES: TraceDrawerPreferences['sizes'] = {
  'drawer left': 0.33,
  'drawer right': 0.33,
  'drawer bottom': 0.5,
};

const DEFAULT_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: false,
    sizes: {
      'drawer left': 0.33,
      'drawer right': 0.33,
      'drawer bottom': 0.5,
    },
  },
  layout: 'drawer right',
  list: {
    width: 0.5,
  },
};

export function storeTraceViewPreferences(state: TracePreferencesState): void {
  // Make sure we dont fire this during a render phase
  window.requestAnimationFrame(() => {
    try {
      localStorage.setItem('trace-view-preferences', JSON.stringify(state));
    } catch (e) {
      Sentry.captureException(e);
    }
  });
}

function isInt(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}
export function loadTraceViewPreferences(): TracePreferencesState {
  const stored = localStorage.getItem('trace-view-preferences');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);

      // We need a more robust way to validate the stored preferences.
      // Since we dont have a schema validation lib, just do it manually for now.
      if (
        parsed?.drawer &&
        typeof parsed.drawer.minimized === 'boolean' &&
        parsed.drawer.sizes &&
        isInt(parsed.drawer.sizes['drawer left']) &&
        isInt(parsed.drawer.sizes['drawer right']) &&
        isInt(parsed.drawer.sizes['drawer bottom']) &&
        parsed.layout &&
        typeof parsed.layout === 'string' &&
        parsed.list &&
        isInt(parsed.list.width)
      ) {
        return parsed;
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return DEFAULT_TRACE_VIEW_PREFERENCES;
}

export function tracePreferencesReducer(
  state: TracePreferencesState,
  action: TracePreferencesAction
): TracePreferencesState {
  switch (action.type) {
    case 'minimize drawer':
      return {...state, drawer: {...state.drawer, minimized: action.payload}};
    case 'set layout':
      return {
        ...state,
        layout: action.payload,
        drawer: {...state.drawer, minimized: false},
      };
    case 'set drawer dimension':
      return {
        ...state,
        drawer: {
          ...state.drawer,
          sizes: {
            ...state.drawer.sizes,
            [state.layout]:
              action.payload < 0 ? 0 : action.payload > 1 ? 1 : action.payload,
          },
        },
      };
    case 'set list width':
      return {
        ...state,
        list: {
          width: action.payload < 0 ? 0 : action.payload > 1 ? 1 : action.payload,
        },
      };
    default:
      traceReducerExhaustiveActionCheck(action);
      return state;
  }
}
