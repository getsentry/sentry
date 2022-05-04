export type FlamegraphColorCodings = [
  'by symbol name',
  'by system / application',
  'by library',
  'by recursion'
];

export type FlamegraphSorting = ['left heavy', 'call order'];
export type FlamegraphViewOptions = ['top down', 'bottom up'];
export type FlamegraphAxisOptions = ['standalone', 'transaction'];
export type FlamegraphScroll = ['inverted', 'natural'];

export interface FlamegraphPreferences {
  colorCoding: FlamegraphColorCodings[number];
  scroll: FlamegraphScroll[number];
  sorting: FlamegraphSorting[number];
  view: FlamegraphViewOptions[number];
  xAxis: FlamegraphAxisOptions[number];
}

type FlamegraphPreferencesAction =
  | {payload: FlamegraphPreferences['colorCoding']; type: 'set color coding'}
  | {payload: FlamegraphPreferences['sorting']; type: 'set sorting'}
  | {payload: FlamegraphPreferences['view']; type: 'set view'}
  | {
      payload: FlamegraphPreferences['xAxis'];
      type: 'set xAxis';
    }
  | {payload: FlamegraphPreferences['scroll']; type: 'set scroll'};

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
    case 'set xAxis': {
      return {...state, xAxis: action.payload};
    }
    case 'set scroll': {
      return {...state, scroll: action.payload};
    }
    default: {
      return state;
    }
  }
}
