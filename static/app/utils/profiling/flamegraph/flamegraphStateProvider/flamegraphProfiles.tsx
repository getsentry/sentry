import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

type SetFocusFrame = {
  payload: {
    name: string;
    package: string;
  };
  type: 'set highlight frame name';
};

type SetProfilesThreadId = {
  payload: number;
  type: 'set thread id';
};

type SetRootNode = {
  payload: FlamegraphFrame | null;
  type: 'set selected root';
};

type FlamegraphProfilesAction = SetFocusFrame | SetProfilesThreadId | SetRootNode;

export type FlamegraphProfiles = {
  focusFrame: SetFocusFrame['payload'] | null;
  selectedRoot: FlamegraphFrame | null;
  threadId: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfiles,
  action: FlamegraphProfilesAction
): FlamegraphProfiles {
  switch (action.type) {
    case 'set highlight frame name': {
      return {
        ...state,
        focusFrame: action.payload,
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
