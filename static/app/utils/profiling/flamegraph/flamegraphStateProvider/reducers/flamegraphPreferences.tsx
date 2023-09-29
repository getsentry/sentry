import {Flamegraph} from 'sentry/utils/profiling/flamegraph';

export type FlamegraphColorCodings = [
  'by system vs application frame',
  'by system frame',
  'by application frame',
  'by symbol name',
  'by library',
  'by recursion',
  'by frequency',
];

export type FlamegraphSorting = Flamegraph['sort'];
export type FlamegraphViewOptions = 'top down' | 'bottom up';

export interface FlamegraphPreferences {
  colorCoding: FlamegraphColorCodings[number];
  layout: 'table right' | 'table bottom' | 'table left';
  sorting: FlamegraphSorting;
  timelines: {
    battery_chart: boolean;
    cpu_chart: boolean;
    memory_chart: boolean;
    minimap: boolean;
    transaction_spans: boolean;
    ui_frames: boolean;
  };
  view: FlamegraphViewOptions[number];
}

type FlamegraphPreferencesAction =
  | {
      payload: {timeline: keyof FlamegraphPreferences['timelines']; value: boolean};
      type: 'toggle timeline';
    }
  | {payload: FlamegraphPreferences['colorCoding']; type: 'set color coding'}
  | {payload: FlamegraphPreferences['sorting']; type: 'set sorting'}
  | {payload: FlamegraphPreferences['view']; type: 'set view'}
  | {payload: FlamegraphPreferences['layout']; type: 'set layout'};

export function flamegraphPreferencesReducer(
  state: FlamegraphPreferences,
  action: FlamegraphPreferencesAction
): FlamegraphPreferences {
  switch (action.type) {
    case 'set layout': {
      return {
        ...state,
        layout: action.payload,
      };
    }
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
    case 'toggle timeline': {
      return {
        ...state,
        timelines: {
          ...state.timelines,
          [action.payload.timeline]: action.payload.value,
        },
      };
    }
    default: {
      return state;
    }
  }
}
