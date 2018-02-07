import Reflux from 'reflux';
import {toTitleCase} from '../utils';

import ProjectActions from '../actions/projectActions';
import EnvironmentActions from '../actions/environmentActions';

import {setDefaultEnvironment} from '../actionCreators/environments';

const PRODUCTION_ENV_NAMES = new Set([
  'production',
  'prod',
  'release',
  'master',
  'trunk',
]);

const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';
const DEFAULT_EMPTY_ROUTING_NAME = 'none';

const EnvironmentStore = Reflux.createStore({
  init() {
    this.items = [];
    this.defaultEnvironment = null;
    this.listenTo(EnvironmentActions.loadData, this.loadInitialData);
    this.listenTo(ProjectActions.setActive, this.onSetActiveProject);
  },

  loadInitialData(items) {
    this.items = items.map(item => ({
      id: item.id,
      name: item.name,
      get displayName() {
        return toTitleCase(item.name) || DEFAULT_EMPTY_ENV_NAME;
      },
      get urlRoutingName() {
        return item.name || DEFAULT_EMPTY_ROUTING_NAME;
      },
    }));
    this.trigger(this.items, 'initial');

    // Update the default environment in the latest context store
    setDefaultEnvironment(this.getDefault());
  },

  getByName(name) {
    return this.items.find(item => item.name === name) || null;
  },

  getAll() {
    return this.items;
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

    let prodEnvs = allEnvs.filter(e => PRODUCTION_ENV_NAMES.has(e.name));

    return defaultEnv || (prodEnvs.length && prodEnvs[0]) || null;
  },
});

export default EnvironmentStore;
