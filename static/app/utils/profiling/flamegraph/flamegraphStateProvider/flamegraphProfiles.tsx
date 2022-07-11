import {
  FlamegraphFrame,
  getFlamegraphFrameId,
} from 'sentry/utils/profiling/flamegraphFrame';

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
  selectedNodeId: string | null;
  threadId: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfilesState,
  action: FlamegraphProfilesAction
): FlamegraphProfilesState {
  switch (action.type) {
    case 'set selected node': {
      return {
        ...state,
        selectedNode: action.payload,
        selectedNodeId: action.payload ? getFlamegraphFrameId(action.payload!) : null,
      };
    }
    case 'set thread id': {
      // When the profile index changes, we want to drop the selected and hovered nodes
      return {
        ...state,
        selectedNode: null,
        selectedNodeId: null,
        threadId: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
