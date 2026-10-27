import {createStore} from 'zustand';

type State = {
  requested: boolean;
};

const store = createStore<State>()(() => ({requested: false}));

export const TrialRequestedStore = {
  ...store,

  onRequested() {
    store.setState({requested: true});
  },

  onClearNotification() {
    store.setState({requested: false});
  },

  getTrialRequstedState() {
    return store.getState().requested;
  },
};
