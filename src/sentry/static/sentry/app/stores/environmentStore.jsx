import Reflux from 'reflux';
import {toTitleCase} from '../utils';

const PRODUCTION_ENV_NAMES = new Set([
  'production',
  'prod',
  'release',
  'master',
  'trunk',
]);

const DEFAULT_ENV_NAME = '(Default Environment)';
const DEFAULT_ROUTING_NAME = 'none';

const EnvironmentStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  loadInitialData(items) {
    this.items = items.map(item => ({
      id: item.id,
      name: item.name,
      get displayName() {
        return toTitleCase(item.name) || DEFAULT_ENV_NAME;
      },
      get urlRoutingName() {
        return item.name || DEFAULT_ROUTING_NAME;
      },
    }));
    this.trigger(this.items, 'initial');
  },

  getByName(name) {
    name = '' + name;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].name === name) {
        return this.items[i];
      }
    }
    return null;
  },

  getAll() {
    return this.items;
  },

  // Default environment is either the first based on the set of common names
  // or the first in the environment list if none match
  getDefault() {
    let allEnvs = this.items;
    let prodEnvs = allEnvs.filter(e => PRODUCTION_ENV_NAMES.has(e.name));

    return (prodEnvs.length && prodEnvs[0]) || (allEnvs.length && allEnvs[0]) || null;
  },
});

export default EnvironmentStore;
