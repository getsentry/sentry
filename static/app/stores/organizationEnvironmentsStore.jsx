import Reflux from 'reflux';
import {toTitleCase} from 'app/utils';

const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';
const DEFAULT_EMPTY_ROUTING_NAME = 'none';

const OrganizationEnvironmentsStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  makeEnvironment(item) {
    return {
      id: item.id,
      name: item.name,
      get displayName() {
        return toTitleCase(item.name) || DEFAULT_EMPTY_ENV_NAME;
      },
      get urlRoutingName() {
        return item.name || DEFAULT_EMPTY_ROUTING_NAME;
      },
    };
  },

  loadInitialData(environments) {
    this.items = environments.map(this.makeEnvironment);
  },

  getActive() {
    return this.items;
  },
});

export default OrganizationEnvironmentsStore;
