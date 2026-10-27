import {createLegacyStore} from 'sentry/stores/createLegacyStore';

type State = {
  requested: boolean;
};

const store = createLegacyStore<State>({requested: false});

export const TrialRequestedStore = {
  ...store,

  onRequested() {
    store.setState(prev => ({...prev, requested: true}));
  },

  onClearNotification() {
    store.setState(prev => ({...prev, requested: false}));
  },

  getTrialRequstedState() {
    return store.getState().requested;
  },
};
