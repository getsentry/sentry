import {createStore} from 'reflux';

import {Environment} from 'sentry/types';
import {getDisplayName, getUrlRoutingName} from 'sentry/utils/environment';

import {CommonStoreDefinition} from './types';

type EnhancedEnvironment = Environment & {
  displayName: string;
  urlRoutingName: string;
};

type State = {
  environments: EnhancedEnvironment[] | null;
  error: Error | null;
};

interface OrganizationEnvironmentsStoreDefinition extends CommonStoreDefinition<State> {
  init(): void;
  onFetchEnvironments(): void;
  onFetchEnvironmentsError(error: Error): void;
  onFetchEnvironmentsSuccess(environments: Environment[]): void;
  state: State;
}

const storeConfig: OrganizationEnvironmentsStoreDefinition = {
  state: {
    environments: null,
    error: null,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = {environments: null, error: null};
  },

  makeEnvironment(item: Environment): EnhancedEnvironment {
    return {
      id: item.id,
      name: item.name,
      get displayName() {
        return getDisplayName(item);
      },
      get urlRoutingName() {
        return getUrlRoutingName(item);
      },
    };
  },

  onFetchEnvironments() {
    this.state = {environments: null, error: null};
    this.trigger(this.state);
  },

  onFetchEnvironmentsSuccess(environments) {
    this.state = {error: null, environments: environments.map(this.makeEnvironment)};
    this.trigger(this.state);
  },

  onFetchEnvironmentsError(error) {
    this.state = {error, environments: null};
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },
};

const OrganizationEnvironmentsStore = createStore(storeConfig);
export default OrganizationEnvironmentsStore;
