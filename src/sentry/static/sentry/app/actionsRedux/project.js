import * as types from '../constants/actionTypes';

export const setActive = project => ({
  type: types.SET_ACTIVE_PROJECT,
  project,
});
