import EnvironmentActions from '../actions/environmentActions';

export function setActiveEnvironment(environment) {
  EnvironmentActions.setActive(environment);
}

export function clearActiveEnvironment() {
  EnvironmentActions.clearActive();
}

export function loadEnvironments(data) {
  EnvironmentActions.loadData(data);
}

export function loadActiveEnvironments(data) {
  EnvironmentActions.loadActiveData(data);
}

export function loadHiddenEnvironments(data) {
  EnvironmentActions.loadHiddenData(data);
}

export function setDefaultEnvironment(env) {
  EnvironmentActions.setDefault(env);
}
