import * as types from '../constants/actionTypes';

const initialState = {
  envs: [],
};

function environment(state = initialState, action) {
  switch (action.type) {
    case types.UPDATE_ENVIRONMENTS:
      return {envs: action.envs};
    default:
      return state;
  }
}

export default environment;
