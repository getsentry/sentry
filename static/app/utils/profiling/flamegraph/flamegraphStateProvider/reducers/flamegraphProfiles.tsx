import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

interface SetProfilesThreadId {
  payload: number;
  type: 'set thread id';
}

interface SetRootNode {
  payload: FlamegraphFrame | null;
  type: 'set selected root';
}

type FlamegraphProfilesAction = SetProfilesThreadId | SetRootNode;

interface FlamegraphProfiles {
  selectedRoot: FlamegraphFrame | null;
  threadId: number | null;
}

export function flamegraphProfilesReducer(
  state: FlamegraphProfiles,
  action: FlamegraphProfilesAction
): FlamegraphProfiles {
  switch (action.type) {
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
