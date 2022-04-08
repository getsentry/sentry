import {createContext, useContext, useEffect, useState} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationStore from './organizationStore';
import {useLegacyStore} from './useLegacyStore';

type PersistedStore = {[key: string]: any};
export const PersistedStoreContext = createContext<
  [PersistedStore, ((string, any) => void) | null]
>([{}, null]);

// Client-only state with TTL persisted on the server side in a redis store.
export function PersistedStoreProvider(props: {children: React.ReactNode}) {
  const [contextValue, setContextValue] = useState<PersistedStore>({});
  const setContextValueForCategory = (category: string, value: any) => {
    setContextValue({...contextValue, [category]: value});
  };
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  useEffect(() => {
    organization &&
      api
        .requestPromise(`/organizations/${organization.slug}/client-state/`)
        .then(setContextValue);
  }, [organization]);
  return (
    <PersistedStoreContext.Provider value={[contextValue, setContextValueForCategory]}>
      {props.children}
    </PersistedStoreContext.Provider>
  );
}

export function usePersistedStore<T>(
  category: string
): [T | null, (next: T | null) => void] {
  const [state, setStateForCategory] = useContext(PersistedStoreContext);
  const org = useOrganization();
  const api = useApi();
  const setState = async (val: T | null) => {
    if (val === null) {
      await api.requestPromise(`/organizations/${org.slug}/client-state/${category}/`, {
        method: 'DELETE',
      });
    } else {
      await api.requestPromise(`/organizations/${org.slug}/client-state/${category}/`, {
        method: 'PUT',
        data: val,
      });
    }

    setStateForCategory && setStateForCategory(category, val);
  };

  return [state[category] || null, setState];
}
