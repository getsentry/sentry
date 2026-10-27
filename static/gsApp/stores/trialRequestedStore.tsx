import {Store} from '@tanstack/react-store';

type State = {
  requested: boolean;
};

const store = new Store<State>({requested: false});

export const TrialRequestedStore = {
  store,

  getState() {
    return store.state;
  },

  onRequested() {
    store.setState(prev => ({...prev, requested: true}));
  },

  onClearNotification() {
    store.setState(prev => ({...prev, requested: false}));
  },

  getTrialRequstedState() {
    return store.state.requested;
  },
};
