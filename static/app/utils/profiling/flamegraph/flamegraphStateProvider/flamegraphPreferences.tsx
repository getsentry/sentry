export type FlamegraphColorCodings = [
  'by symbol name',
  'by system / application',
  'by library',
  'by recursion',
  'by frequency'
];

export type FlamegraphSorting = ['left heavy', 'call order'];
export type FlamegraphViewOptions = ['top down', 'bottom up'];
export type FlamegraphAxisOptions = ['standalone', 'transaction'];

export interface FlamegraphPreferences {
  colorCoding: FlamegraphColorCodings[number];
  layout: 'table right' | 'table bottom' | 'table left';
  sorting: FlamegraphSorting[number];
  view: FlamegraphViewOptions[number];
  xAxis: FlamegraphAxisOptions[number];
}

type FlamegraphPreferencesAction =
  | {payload: FlamegraphPreferences['colorCoding']; type: 'set color coding'}
  | {payload: FlamegraphPreferences['sorting']; type: 'set sorting'}
  | {payload: FlamegraphPreferences['view']; type: 'set view'}
  | {payload: FlamegraphPreferences['layout']; type: 'set layout'}
  | {
      payload: FlamegraphPreferences['xAxis'];
      type: 'set xAxis';
    };

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
    case 'set xAxis': {
      return {...state, xAxis: action.payload};
    }
    default: {
      return state;
    }
  }
}
