type FlamegraphProfilesgAction = {
  payload: number;
  type: 'set active profile index';
};

type FlamegraphProfiles = {
  activeProfileIndex: number | null;
};

export function flamegraphProfilesReducer(
  state: FlamegraphProfiles,
  action: FlamegraphProfilesgAction
): FlamegraphProfiles {
  switch (action.type) {
    case 'set active profile index': {
      return {activeProfileIndex: action.payload};
    }
    default: {
      return state;
    }
  }
}
