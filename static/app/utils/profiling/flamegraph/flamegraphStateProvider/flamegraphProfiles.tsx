import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type SetProfilesActiveIndex = {
  payload: number;
  type: 'set thread id';
};

type SetRootNode = {
  payload: FlamegraphFrame | null;
  type: 'set selected root';
};

type FlamegraphProfilesAction = SetProfilesActiveIndex | SetRootNode;

type FlamegraphProfilesState = {
  selectedRoot: FlamegraphFrame | null;
  threadId: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfilesState,
  action: FlamegraphProfilesAction
): FlamegraphProfilesState {
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
