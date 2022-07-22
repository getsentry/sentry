import {
  useLocalStorageState,
  useSyncedLocalStorageState,
} from 'sentry/utils/useLocalStorageState';

export const SyncComponent = () => {
  const [state, setState] = useLocalStorageState('state', 0);
  const [syncedState, setSyncedState] = useSyncedLocalStorageState('state', state);
  const [otherSyncedState, setOtherSyncedState] = useSyncedLocalStorageState(
    'state',
    state
  );

  return (
    <div>
      LocalStorageSync
      <button onClick={() => setState(state + 1)}>LocalStorage counter {state}</button>
      <button onClick={() => setSyncedState(syncedState + 1)}>
        LocalStorage counter {syncedState}
      </button>
      <button onClick={() => setOtherSyncedState(otherSyncedState + 1)}>
        Other LocalStorage counter {otherSyncedState}
      </button>
    </div>
  );
};

const story = {
  title: 'Utilities/UseLocalStorageState',
  component: SyncComponent,
};
export default story;
