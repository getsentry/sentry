import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect} from 'sentry/utils/profiling/gl/utils';

type SetProfilesThreadId = {
  payload: number;
  type: 'set thread id';
};

type SetRootNode = {
  payload: FlamegraphFrame | null;
  type: 'set selected root';
};

type SetHighlightAllFrames = {
  payload: {
    name: string;
    package: string;
  } | null;
  type: 'set highlight all frames';
};

type JumpToView = {
  payload: {
    view: Rect;
    threadId?: number;
  };
  type: 'jump to view';
};

type FlamegraphProfilesAction =
  | SetHighlightAllFrames
  | SetProfilesThreadId
  | SetRootNode
  | JumpToView;

export type FlamegraphProfiles = {
  highlightFrames: {name: string; package: string} | null;
  selectedRoot: FlamegraphFrame | null;
  threadId: number | null;
  zoomIntoView: Rect | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfiles,
  action: FlamegraphProfilesAction
): FlamegraphProfiles {
  switch (action.type) {
    case 'set highlight all frames': {
      return {
        ...state,
        highlightFrames: action.payload,
      };
    }
    case 'set selected root': {
      return {...state, selectedRoot: action.payload};
    }
    case 'set thread id': {
      // When the profile index changes, we want to drop the selected and hovered nodes
      return {
        ...state,
        selectedRoot: null,
        zoomIntoView: null,
        threadId: action.payload,
      };
    }
    case 'jump to view': {
      return {
        ...state,
        threadId: action.payload.threadId ?? state.threadId,
        zoomIntoView: action.payload.view,
      };
    }
    default: {
      return state;
    }
  }
}
