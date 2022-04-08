import React, {createContext, useCallback, useContext, useEffect, useMemo} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationStore from './organizationStore';
import {useLegacyStore} from './useLegacyStore';

type PersistedStore = Readonly<{[key: string]: any}>;
type PersistedStoreContextValue = [
  PersistedStore,
  React.Dispatch<React.SetStateAction<PersistedStore>>
];

export const PersistedStoreContext = createContext<PersistedStoreContextValue | null>(
  null
);

function usePersistedStore(): PersistedStoreContextValue {
  const context = useContext(PersistedStoreContext);

  if (!context) {
    throw new Error('usePersistedStore was called outside of PersistedStoreProvider');
  }

  return context;
}

// Client-only state with TTL persisted on the server side in a redis store.
export function PersistedStoreProvider(props: {children: React.ReactNode}) {
  const [state, setState] = usePersistedStore();

  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);

  useEffect(() => {
    if (!organization) {
      return undefined;
    }

    let shouldCancelRequest = false;

    api
      .requestPromise(`/organizations/${organization.slug}/client-state/`)
      .then((response: PersistedStore) => {
        if (shouldCancelRequest) {
          return;
        }

        setState(response);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [organization]);

  return (
    <PersistedStoreContext.Provider value={[state, setState]}>
      {props.children}
    </PersistedStoreContext.Provider>
  );
}

type UsePersistedCategory<T> = [T | null, (nextState: T | null) => void];
export function usePersistedStoreCategory<T>(category): UsePersistedCategory<T> {
  const api = useApi();
  const organization = useOrganization();
  const [state, setState] = usePersistedStore();

  const setCategoryState = useCallback(
    (val: T | null) => {
      setState(oldState => ({...oldState, [category]: val}));
    },
    [category, organization]
  );

  useEffect(() => {
    // If a state is set with null, we can clear it from the server.
    if (state[category] === null) {
      api.requestPromise(
        `/organizations/${organization.slug}/client-state/${category}/`,
        {
          method: 'DELETE',
        }
      );
      return;
    }

    // Else we want to sync our state with the server
    api.requestPromise(`/organizations/${organization.slug}/client-state/${category}/`, {
      method: 'PUT',
      data: state[category],
    });
  }, [state[category], organization]);

  const stableState: UsePersistedCategory<T> = useMemo(() => {
    return [state[category] ?? null, setCategoryState];
  }, [state[category], setCategoryState]);

  return stableState;
}
