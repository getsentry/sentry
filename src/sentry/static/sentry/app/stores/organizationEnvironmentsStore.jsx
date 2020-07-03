import Reflux from 'reflux';

import EnvironmentActions from 'app/actions/environmentActions';
import {getDisplayName, getUrlRoutingName} from 'app/utils/environment';

const OrganizationEnvironmentsStore = Reflux.createStore({
  init() {
    this.environments = null;
    this.error = null;

    this.listenTo(EnvironmentActions.fetchEnvironments, this.onFetchEnvironments);
    this.listenTo(
      EnvironmentActions.fetchEnvironmentsSuccess,
      this.onFetchEnvironmentsSuccess
    );
    this.listenTo(
      EnvironmentActions.fetchEnvironmentsError,
      this.onFetchEnvironmentsError
    );
  },

  makeEnvironment(item) {
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
    this.environments = null;
    this.error = null;
    this.trigger(this.get());
  },

  onFetchEnvironmentsSuccess(environments) {
    this.environments = environments.map(this.makeEnvironment);
    this.error = null;
    this.trigger(this.get());
  },

  onFetchEnvironmentsError(error) {
    this.environments = null;
    this.error = error;
    this.trigger(this.get());
  },

  get() {
    return {environments: this.environments, error: this.error};
  },
});

export default OrganizationEnvironmentsStore;
