import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type SetProfilesActiveIndex = {
  payload: number;
  type: 'set active profile index';
};

type SetSelectedNode = {
  payload: FlamegraphFrame | null;
  type: 'set selected node';
};

type FlamegraphProfilesAction = SetProfilesActiveIndex | SetSelectedNode;

type FlamegraphProfilesState = {
  activeProfileIndex: number | null;
  selectedNode: FlamegraphFrame | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfilesState,
  action: FlamegraphProfilesAction
): FlamegraphProfilesState {
  switch (action.type) {
    case 'set selected node': {
      return {...state, selectedNode: action.payload};
    }
    case 'set active profile index': {
      // When the profile index changes, we want to drop the selected and hovered nodes
      return {
        ...state,
        selectedNode: null,
        activeProfileIndex: action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
