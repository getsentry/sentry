import * as types from '../constants/actionTypes';

const initialState = {
  organizations: [],
};

function organizations(state = initialState, action) {
  switch (action.type) {
    case types.LOAD_ORGANIZATIONS:
      return {organizations: action.organizations};
    default:
      return state;
  }
}

export default organizations;
