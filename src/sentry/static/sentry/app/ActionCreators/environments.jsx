import EnvironmentActions from 'app/actions/environmentActions';
import EnvironmentStore from 'app/stores/environmentStore';

export function setActiveEnvironment(environment) {
  EnvironmentActions.setActive(environment);
}

export function setActiveEnvironmentName(name) {
  let environment = EnvironmentStore.getByName(name);

  if (!environment) return;
  setActiveEnvironment(environment);
}

export function clearActiveEnvironment() {
  EnvironmentActions.clearActive();
}

export function loadEnvironments(data, envName) {
  EnvironmentActions.loadData(data, envName);
}

export function loadActiveEnvironments(data) {
  EnvironmentActions.loadActiveData(data);
}

export function loadHiddenEnvironments(data) {
  EnvironmentActions.loadHiddenData(data);
}
