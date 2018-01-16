import * as types from '../constants/actionTypes';

export const loadOrganizations = organizations => ({
  type: types.LOAD_ORGANIZATIONS,
  organizations,
});

export const setActive = organization => ({
  type: types.SET_ACTIVE_ORGANIZATION,
  organization,
});
