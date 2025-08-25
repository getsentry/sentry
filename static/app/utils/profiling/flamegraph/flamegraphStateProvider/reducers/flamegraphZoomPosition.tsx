import {Rect} from 'sentry/utils/profiling/speedscope';

type FlamegraphZoomPositionAction = {
  payload: Rect;
  type: 'checkpoint';
};

type FlamegraphZoomPosition = {
  view: Rect;
};

export function flamegraphZoomPositionReducer(
  _state: FlamegraphZoomPosition,
  action: FlamegraphZoomPositionAction
): FlamegraphZoomPosition {
  switch (action.type) {
    case 'checkpoint':
      return {view: Rect.From(action.payload)};
  }
}
