import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type SetProfilesActiveIndex = {
  payload: number;
  type: 'set thread id';
};

type SetRootNode = {
  payload: FlamegraphFrame | null;
  type: 'set root node';
};

type FlamegraphProfilesAction = SetProfilesActiveIndex | SetRootNode;

type FlamegraphProfilesState = {
  root: FlamegraphFrame | null;
  threadId: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfilesState,
  action: FlamegraphProfilesAction
): FlamegraphProfilesState {
  switch (action.type) {
    case 'set root node': {
      return {...state, root: action.payload};
    }
    case 'set thread id': {
      // When the profile index changes, we want to drop the selected and hovered nodes
      return {
        ...state,
        root: null,
        threadId: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
