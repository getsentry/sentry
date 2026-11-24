import {useStore} from 'zustand';
import {createStore} from 'zustand/vanilla';

interface TrialRequestedState {
  /**
   * A trial was requested and the sidebar confirmation hasn't been dismissed
   */
  readonly requested: boolean;
}

const store = createStore<TrialRequestedState>()(() => ({requested: false}));

export const TrialRequestedStore = {
  markRequested(): void {
    store.setState({requested: true});
  },

  clearNotification(): void {
    store.setState({requested: false});
  },
};

export function useTrialRequested(): boolean {
  return useStore(store, state => state.requested);
}
