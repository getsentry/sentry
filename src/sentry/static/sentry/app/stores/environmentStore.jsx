import Reflux from 'reflux';
import {toTitleCase} from 'app/utils';

import ProjectActions from 'app/actions/projectActions';
import EnvironmentActions from 'app/actions/environmentActions';

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
        return encodeURIComponent(item.name) || DEFAULT_EMPTY_ROUTING_NAME;
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
    const allEnvs = this.items;

    const defaultEnv = allEnvs.find(e => e.name === this.defaultEnvironment);

    return defaultEnv || null;
  },
});

export default EnvironmentStore;
