import Reflux from 'reflux';
import {toTitleCase} from 'app/utils';

import ProjectActions from 'app/actions/projectActions';
import EnvironmentActions from 'app/actions/environmentActions';

import {setActiveEnvironment} from 'app/actionCreators/environments';
import {ALL_ENVIRONMENTS_KEY} from 'app/constants';

const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';
const DEFAULT_EMPTY_ROUTING_NAME = 'none';

const EnvironmentStore = Reflux.createStore({
  init() {
    this.items = [];
    this.hidden = null;
    this.defaultEnvironment = null;
    this.listenTo(EnvironmentActions.loadData, this.loadInitialData);
    this.listenTo(EnvironmentActions.loadActiveData, this.loadActiveData);
    this.listenTo(EnvironmentActions.loadHiddenData, this.loadHiddenData);
    this.listenTo(ProjectActions.setActive, this.onSetActiveProject);
  },

  loadInitialData(items, activeEnvironmentName) {
    this.loadActiveData(items);
    // Update the default environment in the latest context store
    // The active environment will be null (aka All Environments) if the name matches
    // ALL_ENVIRONMENTS_KEY otherwise find the environment matching the name provided
    let activeEnvironment = null;
    if (activeEnvironmentName !== ALL_ENVIRONMENTS_KEY) {
      activeEnvironment = this.getByName(activeEnvironmentName) || this.getDefault();
    }
    setActiveEnvironment(activeEnvironment);
  },

  loadHiddenData(items) {
    this.loadData('hidden', items);
  },

  loadActiveData(items) {
    this.loadData('items', items);
  },

  loadData(key, items) {
    items = items || [];
    this[key] = items.map(item => ({
      id: item.id,
      name: item.name,
      get displayName() {
        return toTitleCase(item.name) || DEFAULT_EMPTY_ENV_NAME;
      },
      get urlRoutingName() {
        return item.name || DEFAULT_EMPTY_ROUTING_NAME;
      },
    }));
    this.trigger(this.items);
  },

  getByName(name) {
    const envs = this.items;
    return envs.find(item => item.name === name) || null;
  },

  getActive() {
    return this.items;
  },

  getHidden() {
    return this.hidden;
  },

  onSetActiveProject(project) {
    if (project) {
      this.defaultEnvironment = project.defaultEnvironment || null;
    }
  },

  // Default environment is either the first based on the set of common names
  // or the first in the environment list if none match
  getDefault() {
    let allEnvs = this.items;

    let defaultEnv = allEnvs.find(e => e.name === this.defaultEnvironment);

    return defaultEnv || null;
  },
});

export default EnvironmentStore;
