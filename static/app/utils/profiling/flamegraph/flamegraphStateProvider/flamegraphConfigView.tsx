import {Rect} from 'sentry/utils/profiling/gl/utils';

export type FlamegraphConfigView = {
  configView: Rect | null;
};

type FlamegraphConfigViewAction = {
  payload: Rect | null;
  type: 'set config view';
};

export function flamegraphConfigViewReducer(
  state: FlamegraphConfigView,
  action: FlamegraphConfigViewAction
): FlamegraphConfigView {
  switch (action.type) {
    case 'set config view': {
      return {
        ...state,
        configView: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
