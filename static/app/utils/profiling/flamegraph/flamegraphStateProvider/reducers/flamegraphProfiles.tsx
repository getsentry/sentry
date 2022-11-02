import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type SetProfilesThreadId = {
  payload: number;
  type: 'set thread id';
};

type SetRootNode = {
  payload: FlamegraphFrame | null;
  type: 'set selected root';
};

type SetHighlightFrame = {
  payload: {
    name: string;
    package: string;
  } | null;
  type: 'set highlight frame';
};

type FlamegraphProfilesAction = SetHighlightFrame | SetProfilesThreadId | SetRootNode;

export type FlamegraphProfiles = {
  highlightFrame: {name: string; package: string} | null;
  selectedRoot: FlamegraphFrame | null;
  threadId: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfiles,
  action: FlamegraphProfilesAction
): FlamegraphProfiles {
  switch (action.type) {
    case 'set highlight frame': {
      return {
        ...state,
        highlightFrame: action.payload,
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
