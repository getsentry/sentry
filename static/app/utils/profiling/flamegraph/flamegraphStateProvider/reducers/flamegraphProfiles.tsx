import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

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

type FlamegraphProfilesAction = SetHighlightAllFrames | SetProfilesThreadId | SetRootNode;

export type FlamegraphProfiles = {
  highlightFrames: {name: string; package: string} | null;
  selectedRoot: FlamegraphFrame | null;
  threadId: number | null;
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
        threadId: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
