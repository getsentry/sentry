import * as types from '../constants/actionTypes';

const initialState = {
  project: null,
  organization: null,
};

function latestContext(state = initialState, action) {
  switch (action.type) {
    case types.SET_ACTIVE_PROJECT:
      return {...state, project: action.project || null};
    case types.SET_ACTIVE_ORGANIZATION:
      return {...state, organization: action.organization || null};
    case types.LOAD_ORGANIZATIONS:
      const {organizations} = action;
      const firstOrg = organizations && organizations.length ? organizations[0] : null;
      return {...state, organization: firstOrg};
    case types.UPDATE_ORGANIZATION:
      const updatedOrgIsLatest =
        this.state.organization &&
        action.organization &&
        action.organization.slug === this.state.organization.slug;

      if (updatedOrgIsLatest) {
        return {...state, organization: action.organization};
      } else {
        return state;
      }
    default:
      return state;
  }
}

export default latestContext;
