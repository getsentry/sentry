import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type SetProfilesActiveIndex = {
  payload: number;
  type: 'set thread id';
};

type SetSelectedNode = {
  payload: FlamegraphFrame | null;
  type: 'set selected node';
};

type FlamegraphProfilesAction = SetProfilesActiveIndex | SetSelectedNode;

type FlamegraphProfilesState = {
  selectedNode: FlamegraphFrame | null;
  threadId: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfilesState,
  action: FlamegraphProfilesAction
): FlamegraphProfilesState {
  switch (action.type) {
    case 'set selected node': {
      return {...state, selectedNode: action.payload};
    }
    case 'set thread id': {
      // When the profile index changes, we want to drop the selected and hovered nodes
      return {
        ...state,
        selectedNode: null,
        threadId: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
