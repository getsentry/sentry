import Reflux from 'reflux';

import TrialRequestedActions from 'getsentry/actions/trialRequestedActions';

type State = {
  requested: boolean;
};

type TrialRequestedStoreInterface = {
  getTrialRequstedState: () => State['requested'];
};

const storeConfig: Reflux.StoreDefinition & TrialRequestedStoreInterface = {
  state: {
    requested: false,
  } as State,

  init() {
    this.listenTo(TrialRequestedActions.requested, this.onRequested);
    this.listenTo(TrialRequestedActions.clearNotification, this.onClearNotification);
  },

  onRequested() {
    this.state = {...this.state, requested: true};
    this.trigger(this.state);
  },

  onClearNotification() {
    this.state = {...this.state, requested: false};
    this.trigger(this.state);
  },

  getTrialRequstedState() {
    return this.state.requested;
  },
};

const TrialRequestedStore = Reflux.createStore(storeConfig) as Reflux.Store &
  TrialRequestedStoreInterface;

export default TrialRequestedStore;
