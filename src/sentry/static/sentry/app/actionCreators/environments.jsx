import EnvironmentActions from '../actions/environmentActions';

export function setActiveEnvironment(environment) {
  EnvironmentActions.setActive(environment);
}

export function clearActiveEnvironment() {
  EnvironmentActions.clearActive();
}
