type SetProfilesActiveIndexAction = {
  payload: number;
  type: 'set active profile index';
};

type FlamegraphProfilesAction = SetProfilesActiveIndexAction;

type FlamegraphProfilesState = {
  activeProfileIndex: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfilesState,
  action: FlamegraphProfilesAction
): FlamegraphProfilesState {
  switch (action.type) {
    case 'set active profile index': {
      return {...state, activeProfileIndex: action.payload};
    }
    default: {
      return state;
    }
  }
}
