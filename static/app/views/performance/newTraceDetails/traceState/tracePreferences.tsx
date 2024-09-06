import * as Sentry from '@sentry/react';

import clamp from 'sentry/utils/number/clamp';
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
  layoutOptions: TraceLayoutPreferences[];
  minimized: boolean;
  sizes: {
    [key in TraceLayoutPreferences]: number;
  };
};

export type TracePreferencesState = {
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

export const DEFAULT_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: false,
    sizes: {
      'drawer left': 0.33,
      'drawer right': 0.33,
      'drawer bottom': 0.5,
    },
    layoutOptions: ['drawer left', 'drawer right', 'drawer bottom'],
  },
  layout: 'drawer right',
  list: {
    width: 0.5,
  },
};

export function storeTraceViewPreferences(
  key: string,
  state: TracePreferencesState
): void {
  // Make sure we dont fire this during a render phase
  window.requestAnimationFrame(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      Sentry.captureException(e);
    }
  });
}

function isInt(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function correctListWidth(state: TracePreferencesState): TracePreferencesState {
  if (state.list.width < 0.1 || state.list.width > 0.9) {
    state.list.width = 0.5;
  }
  return state;
}

export function loadTraceViewPreferences(key: string): TracePreferencesState | null {
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // We need a more robust way to validate the stored preferences.
      // Since we dont have a schema validation lib, just do it manually for now.
      if (
        parsed?.drawer &&
        typeof parsed.drawer.minimized === 'boolean' &&
        Array.isArray(parsed.drawer.layoutOptions) &&
        parsed.drawer.sizes &&
        isInt(parsed.drawer.sizes['drawer left']) &&
        isInt(parsed.drawer.sizes['drawer right']) &&
        isInt(parsed.drawer.sizes['drawer bottom']) &&
        parsed.layout &&
        typeof parsed.layout === 'string' &&
        parsed.list &&
        isInt(parsed.list.width)
      ) {
        correctListWidth(parsed);
        return parsed;
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return null;
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
            [state.layout]: clamp(action.payload, 0, 1),
          },
        },
      };
    case 'set list width':
      return {
        ...state,
        list: {
          width: clamp(action.payload, 0.1, 0.9),
        },
      };
    default:
      traceReducerExhaustiveActionCheck(action);
      return state;
  }
}
