import * as types from '../constants/actionTypes';

export const updateEnvironments = envs => ({
  type: types.UPDATE_ENVIRONMENTS,
  envs,
});
